<?php

namespace App\Tests\Controller;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * Health probes must be reachable WITHOUT authentication (load balancers don't
 * carry JWTs) and readiness must reflect real DB connectivity. This also
 * guards that /health stays outside the ^/api JWT firewall.
 */
final class HealthControllerTest extends WebTestCase
{
    public function testLivenessIsPublicAndOk(): void
    {
        $client = static::createClient();
        $client->request('GET', '/health');

        self::assertResponseIsSuccessful();
        self::assertResponseHeaderSame('Content-Type', 'application/json');
        self::assertSame('ok', json_decode($client->getResponse()->getContent(), true)['status']);
    }

    public function testReadinessReportsDatabaseUp(): void
    {
        $client = static::createClient();
        $client->request('GET', '/health/ready');

        self::assertResponseIsSuccessful();
        $body = json_decode($client->getResponse()->getContent(), true);
        self::assertSame('ok', $body['status']);
        self::assertSame('up', $body['checks']['database']);
    }

    public function testHealthNeedsNoToken(): void
    {
        // Explicit: no Authorization header, still 200 (not 401).
        $client = static::createClient();
        $client->request('GET', '/health');

        self::assertResponseStatusCodeSame(200);
    }
}
