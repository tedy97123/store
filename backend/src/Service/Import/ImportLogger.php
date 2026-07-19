<?php

namespace App\Service\Import;

use App\Entity\CsvImportJob;
use Psr\Log\LoggerInterface;

/**
 * Per-import run logging.
 *
 * Every CSV import job gets its own newline-delimited JSON log file at
 * `%kernel.logs_dir%/imports/import-<jobId>.log`, so an operator can open the
 * exact run and see its full timeline — lifecycle transitions, per-batch
 * resolution, failed rows, retries, and manual resolutions — without sifting
 * the shared application log. Each event is also mirrored to the main PSR-3
 * logger (tagged with the job id) so it shows up in centralized logging too.
 *
 * Writes are best-effort and never throw: import processing must not fail
 * because a log line could not be written.
 */
final class ImportLogger
{
    public function __construct(
        private readonly LoggerInterface $logger,
        private readonly string $importLogDir,
    ) {
    }

    /**
     * Records one structured event for a job.
     *
     * @param array<string, mixed> $context
     */
    public function log(CsvImportJob $job, string $event, array $context = [], string $level = 'info'): void
    {
        $jobId = (int) $job->getId();
        $record = [
            // Timestamp is provided by the caller-independent clock; kept ISO-8601.
            'ts' => (new \DateTimeImmutable())->format(\DateTimeInterface::ATOM),
            'jobId' => $jobId,
            'store' => $job->getStore()?->getSlug(),
            'level' => $level,
            'event' => $event,
        ] + $context;

        $this->writeLine($jobId, $record);

        // Mirror to the app logger so import events are also centrally visible.
        $this->logger->log($level, 'import[{jobId}] {event}', ['jobId' => $jobId, 'event' => $event] + $context);
    }

    /** Absolute path of a job's dedicated log file. */
    public function pathFor(int $jobId): string
    {
        return rtrim($this->importLogDir, '/').'/import-'.$jobId.'.log';
    }

    /** @param array<string, mixed> $record */
    private function writeLine(int $jobId, array $record): void
    {
        try {
            if (!is_dir($this->importLogDir) && !@mkdir($this->importLogDir, 0775, true) && !is_dir($this->importLogDir)) {
                return;
            }

            $line = json_encode($record, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
            if (false === $line) {
                return;
            }

            @file_put_contents($this->pathFor($jobId), $line."\n", FILE_APPEND | LOCK_EX);
        } catch (\Throwable) {
            // Logging must never break the import.
        }
    }
}
