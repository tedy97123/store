<?php

namespace App\Service\Scryfall;

/**
 * Cross-process rate limiter for outbound Scryfall requests.
 *
 * The previous throttle lived in a static property, so every PHP process
 * (web worker, each messenger:consume worker, CLI commands) had its own
 * 8 req/s budget — N workers meant ~8N req/s against Scryfall's ~10 req/s
 * guideline. This limiter serialises the interval through an flock()'d
 * timestamp file shared by all processes on the host, so the budget is
 * global no matter how many workers run.
 *
 * Limitation: flock() only coordinates processes on one machine. If the
 * app is ever scaled across hosts, replace this with a shared store
 * (e.g. a Redis token bucket via symfony/rate-limiter).
 */
final class ScryfallRateLimiter
{
    private const DEFAULT_MIN_INTERVAL_MICROSECONDS = 125000; // 8 req/s

    private string $lockFilePath;

    public function __construct(
        string $lockFilePath = '',
        private readonly int $minIntervalMicroseconds = self::DEFAULT_MIN_INTERVAL_MICROSECONDS,
    ) {
        $this->lockFilePath = '' !== $lockFilePath
            ? $lockFilePath
            : sys_get_temp_dir().DIRECTORY_SEPARATOR.'mtgstore_scryfall_rate.lock';
    }

    /**
     * Blocks until this process may issue the next Scryfall request.
     *
     * Waiters queue on the exclusive lock; each holder sleeps out the
     * remaining interval, stamps the file with "now", and releases — so
     * consecutive requests across all processes are spaced by at least
     * the minimum interval. Fails open (no throttling) if the lock file
     * cannot be used, since a missed throttle only risks a 429 that the
     * caller already retries.
     */
    public function acquire(): void
    {
        $handle = @fopen($this->lockFilePath, 'c+');
        if (false === $handle) {
            return;
        }

        try {
            if (!flock($handle, LOCK_EX)) {
                return;
            }

            rewind($handle);
            $last = (float) stream_get_contents($handle);

            $now = microtime(true);
            $nextAllowed = $last + $this->minIntervalMicroseconds / 1_000_000;
            if ($now < $nextAllowed) {
                usleep((int) ceil(($nextAllowed - $now) * 1_000_000));
                $now = microtime(true);
            }

            rewind($handle);
            ftruncate($handle, 0);
            fwrite($handle, sprintf('%.6F', $now));
            fflush($handle);
            flock($handle, LOCK_UN);
        } finally {
            fclose($handle);
        }
    }
}
