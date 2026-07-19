<?php

namespace App\Security;

use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;

/**
 * Small helper for applying a named rate limiter inside a controller action and
 * returning a proper 429 (with Retry-After) when the limit is exceeded.
 *
 * Kept separate from login throttling (which the security firewall handles):
 * this is for application endpoints where the cost is ours to protect —
 * catalog search (upstream Scryfall budget) and CSV upload (import pipeline).
 */
final class ApiRateLimit
{
    /**
     * Consumes one token for $key from $factory. Returns a 429 JSON response
     * when the request should be rejected, or null when it may proceed.
     */
    public static function enforce(RateLimiterFactoryInterface $factory, string $key, string $message = 'Too many requests. Please slow down.'): ?JsonResponse
    {
        $limit = $factory->create($key)->consume(1);
        if ($limit->isAccepted()) {
            return null;
        }

        $retryAfter = max(1, $limit->getRetryAfter()->getTimestamp() - time());

        return new JsonResponse(
            ['code' => Response::HTTP_TOO_MANY_REQUESTS, 'message' => $message],
            Response::HTTP_TOO_MANY_REQUESTS,
            [
                'Retry-After' => (string) $retryAfter,
                'X-RateLimit-Remaining' => (string) $limit->getRemainingTokens(),
            ],
        );
    }
}
