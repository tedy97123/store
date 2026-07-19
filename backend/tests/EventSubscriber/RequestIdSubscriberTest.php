<?php

namespace App\Tests\EventSubscriber;

use App\EventSubscriber\RequestIdSubscriber;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * Every response should carry a correlation id, honoring an inbound one from an
 * upstream proxy so a request can be traced end-to-end.
 */
final class RequestIdSubscriberTest extends WebTestCase
{
    public function testResponseCarriesAGeneratedRequestId(): void
    {
        $client = static::createClient();
        $client->request('GET', '/health');

        $id = $client->getResponse()->headers->get(RequestIdSubscriber::HEADER);
        self::assertNotNull($id, 'response must include an X-Request-Id header');
        self::assertNotSame('', $id);
    }

    public function testInboundRequestIdIsPropagated(): void
    {
        $client = static::createClient();
        $client->request('GET', '/health', server: ['HTTP_X_REQUEST_ID' => 'trace-abc-123']);

        self::assertSame(
            'trace-abc-123',
            $client->getResponse()->headers->get(RequestIdSubscriber::HEADER),
        );
    }

    public function testOverlongInboundIdIsBounded(): void
    {
        $client = static::createClient();
        $client->request('GET', '/health', server: ['HTTP_X_REQUEST_ID' => str_repeat('a', 500)]);

        $id = $client->getResponse()->headers->get(RequestIdSubscriber::HEADER);
        self::assertLessThanOrEqual(128, \strlen((string) $id));
    }
}
