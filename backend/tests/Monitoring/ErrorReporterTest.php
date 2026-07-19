<?php

namespace App\Tests\Monitoring;

use App\Monitoring\ErrorReporter;
use PHPUnit\Framework\TestCase;

/**
 * Error tracking must be off (and inert) unless a SENTRY_DSN is configured, and
 * reporting must never throw — monitoring can't be allowed to break a request
 * or a worker.
 */
final class ErrorReporterTest extends TestCase
{
    public function testDisabledWithoutDsn(): void
    {
        self::assertFalse((new ErrorReporter(null, 'test'))->isEnabled());
        self::assertFalse((new ErrorReporter('', 'test'))->isEnabled());
    }

    public function testEnabledWithDsn(): void
    {
        self::assertTrue((new ErrorReporter('https://public@example.invalid/1', 'prod'))->isEnabled());
    }

    public function testReportIsANoOpAndNeverThrowsWhenDisabled(): void
    {
        $reporter = new ErrorReporter(null, 'test');
        // Must return cleanly (no Sentry init, no exception) when disabled.
        $reporter->report(new \RuntimeException('boom'), ['k' => 'v'], ['extra' => 1]);
        $this->addToAssertionCount(1);
    }
}
