<?php

namespace App\Tests\Security;

use Psr\Cache\CacheItemPoolInterface;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * Brute-force protection: repeated failed logins from the same client must be
 * throttled (HTTP 429) once the configured attempt limit is exceeded, instead
 * of allowing unlimited password guesses.
 */
final class LoginThrottlingTest extends WebTestCase
{
    protected function setUp(): void
    {
        // The rate limiter stores counts in a filesystem cache pool, which is
        // NOT rolled back by the DB test transaction and would otherwise leak
        // throttle state between tests/runs. Reset it so each test is isolated.
        self::bootKernel();
        /** @var CacheItemPoolInterface $pool */
        $pool = self::getContainer()->get('cache.rate_limiter');
        $pool->clear();
        self::ensureKernelShutdown();
    }

    public function testFailedLoginsAreThrottledAfterMaxAttempts(): void
    {
        $client = static::createClient();
        // Keep the rate-limiter (and its cache storage) alive across requests;
        // a kernel reboot per request would also reset an in-memory limiter.
        $client->disableReboot();

        $seen = [];
        for ($i = 1; $i <= 7; ++$i) {
            $client->request(
                'POST',
                '/api/login',
                server: ['CONTENT_TYPE' => 'application/json', 'REMOTE_ADDR' => '203.0.113.7'],
                content: json_encode(['email' => 'victim@test.local', 'password' => 'wrong-guess']),
            );
            $seen[$i] = $client->getResponse()->getStatusCode();
        }

        // First attempts are rejected as bad credentials (401); once the limit
        // (5) is exceeded the firewall short-circuits with 429 Too Many Requests.
        self::assertSame(401, $seen[1], 'first attempt should be a normal auth failure');
        self::assertContains(429, $seen, 'repeated failures must eventually be throttled (429)');
        self::assertSame(429, $seen[7], 'the 7th attempt (past the limit of 5) must be throttled');
    }

    public function testThrottlingIsPerClientIp(): void
    {
        $client = static::createClient();
        $client->disableReboot();

        // Exhaust the limit for one IP.
        for ($i = 0; $i < 7; ++$i) {
            $client->request(
                'POST',
                '/api/login',
                server: ['CONTENT_TYPE' => 'application/json', 'REMOTE_ADDR' => '203.0.113.8'],
                content: json_encode(['email' => 'victim@test.local', 'password' => 'wrong']),
            );
        }
        self::assertSame(429, $client->getResponse()->getStatusCode());

        // A different client IP is unaffected (still a normal 401, not throttled).
        $client->request(
            'POST',
            '/api/login',
            server: ['CONTENT_TYPE' => 'application/json', 'REMOTE_ADDR' => '198.51.100.9'],
            content: json_encode(['email' => 'victim@test.local', 'password' => 'wrong']),
        );
        self::assertSame(401, $client->getResponse()->getStatusCode());
    }
}
