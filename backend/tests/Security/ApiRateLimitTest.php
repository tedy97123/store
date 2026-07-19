<?php

namespace App\Tests\Security;

use App\Security\ApiRateLimit;
use Psr\Cache\CacheItemPoolInterface;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;

/**
 * The API rate-limit helper lets a request through until the named limiter is
 * exhausted, then returns a 429 with Retry-After. Exercised against the real
 * configured limiters (catalog_search, csv_upload).
 */
final class ApiRateLimitTest extends KernelTestCase
{
    protected function setUp(): void
    {
        // The limiter cache is filesystem-backed (not covered by the DB
        // rollback), so reset it for deterministic counts.
        self::bootKernel();
        /** @var CacheItemPoolInterface $pool */
        $pool = self::getContainer()->get('cache.rate_limiter');
        $pool->clear();
    }

    public function testAllowsUpToTheLimitThenReturns429(): void
    {
        /** @var RateLimiterFactoryInterface $factory */
        $factory = self::getContainer()->get('limiter.csv_upload'); // limit: 20 / minute
        $key = 'store:test-key';

        // First 20 are accepted (helper returns null → request proceeds).
        for ($i = 1; $i <= 20; ++$i) {
            self::assertNull(ApiRateLimit::enforce($factory, $key), "request $i should be allowed");
        }

        // The 21st is rejected with a proper 429 + Retry-After.
        $response = ApiRateLimit::enforce($factory, $key);
        self::assertNotNull($response);
        self::assertSame(Response::HTTP_TOO_MANY_REQUESTS, $response->getStatusCode());
        self::assertTrue($response->headers->has('Retry-After'));
        self::assertGreaterThan(0, (int) $response->headers->get('Retry-After'));
    }

    public function testKeysAreIsolated(): void
    {
        /** @var RateLimiterFactoryInterface $factory */
        $factory = self::getContainer()->get('limiter.csv_upload');

        // Exhaust one key.
        for ($i = 0; $i < 21; ++$i) {
            ApiRateLimit::enforce($factory, 'store:a');
        }
        self::assertNotNull(ApiRateLimit::enforce($factory, 'store:a'), 'exhausted key is throttled');

        // A different key is unaffected.
        self::assertNull(ApiRateLimit::enforce($factory, 'store:b'), 'a separate key has its own budget');
    }

    public function testCatalogSearchLimiterIsWired(): void
    {
        // Sanity: the search limiter resolves and grants its first token.
        /** @var RateLimiterFactoryInterface $factory */
        $factory = self::getContainer()->get('limiter.catalog_search');
        self::assertNull(ApiRateLimit::enforce($factory, 'user:someone'));
    }
}
