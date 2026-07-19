<?php

namespace App\Monitoring;

/**
 * Thin, dependency-light wrapper around the Sentry SDK.
 *
 * Error tracking is OFF by default: with no SENTRY_DSN configured this is a
 * no-op, so nothing is sent in dev/test or when the operator hasn't opted in.
 * Set SENTRY_DSN in production to start capturing unhandled exceptions (HTTP
 * 5xx) and terminal messenger failures with request/job context.
 *
 * We use the raw sentry/sentry SDK rather than sentry-symfony because the
 * latter depends on symfony/monolog-bundle, which is not yet Symfony 8.1
 * compatible.
 */
final class ErrorReporter
{
    private bool $initialized = false;

    public function __construct(
        private readonly ?string $dsn,
        private readonly string $environment,
        private readonly ?string $release = null,
    ) {
    }

    public function isEnabled(): bool
    {
        return null !== $this->dsn && '' !== $this->dsn;
    }

    /**
     * Report a throwable with optional tags/extra context. Silently does
     * nothing when disabled, and never lets a reporting failure propagate.
     *
     * @param array<string, scalar|null> $tags
     * @param array<string, mixed>       $extra
     */
    public function report(\Throwable $throwable, array $tags = [], array $extra = []): void
    {
        if (!$this->isEnabled()) {
            return;
        }

        try {
            $this->init();

            \Sentry\withScope(function (\Sentry\State\Scope $scope) use ($throwable, $tags, $extra): void {
                foreach ($tags as $key => $value) {
                    $scope->setTag($key, (string) $value);
                }
                if ([] !== $extra) {
                    $scope->setContext('detail', $extra);
                }
                \Sentry\captureException($throwable);
            });
        } catch (\Throwable) {
            // Monitoring must never break the request or the worker.
        }
    }

    private function init(): void
    {
        if ($this->initialized) {
            return;
        }

        \Sentry\init([
            'dsn' => $this->dsn,
            'environment' => $this->environment,
            'release' => $this->release ?: null,
        ]);
        $this->initialized = true;
    }
}
