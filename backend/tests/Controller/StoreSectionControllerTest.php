<?php

namespace App\Tests\Controller;

use App\Entity\Store;
use App\Entity\StoreSection;
use App\Entity\User;
use App\Tests\Support\CatalogFixtures;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * Case Cards sections: an owner can create sections, fill them manually or by
 * pulling from inventory (price range + rarity), and the public page can read
 * them — while a non-owner is locked out of every mutation.
 */
final class StoreSectionControllerTest extends WebTestCase
{
    private EntityManagerInterface $em;
    private CatalogFixtures $fixtures;
    private object $client;
    private ?string $bearer = null;

    protected function setUp(): void
    {
        $this->client = static::createClient();
        $c = static::getContainer();
        $this->em = $c->get('doctrine')->getManager();
        $this->fixtures = new CatalogFixtures($this->em);
    }

    /**
     * The /api firewall is stateless JWT, so auth cannot ride a session cookie
     * across requests — every request carries a freshly minted Bearer token.
     */
    private function authenticate(User $user): void
    {
        $this->bearer = static::getContainer()
            ->get(JWTTokenManagerInterface::class)
            ->create($user);
    }

    private function anonymous(): void
    {
        $this->bearer = null;
    }

    private function jsonRequest(string $method, string $url, array $body = null): array
    {
        $server = ['CONTENT_TYPE' => 'application/json'];
        if (null !== $this->bearer) {
            $server['HTTP_AUTHORIZATION'] = 'Bearer '.$this->bearer;
        }

        $this->client->request(
            $method,
            $url,
            server: $server,
            content: null === $body ? '' : json_encode($body),
        );

        $raw = $this->client->getResponse()->getContent();

        return '' === $raw ? [] : (json_decode($raw, true) ?? []);
    }

    public function testOwnerCreatesSection(): void
    {
        $store = $this->fixtures->store();
        $this->authenticate($store->getOwner());

        $body = $this->jsonRequest('POST', "/api/stores/{$store->getSlug()}/sections", [
            'title' => 'Vintage Power',
            'mode' => 'manual',
        ]);

        self::assertSame(201, $this->client->getResponse()->getStatusCode());
        self::assertSame('Vintage Power', $body['title']);
        self::assertSame('manual', $body['mode']);
        self::assertSame([], $body['cards']);
        self::assertIsInt($body['id']);
    }

    public function testCreateSectionRequiresTitle(): void
    {
        $store = $this->fixtures->store();
        $this->authenticate($store->getOwner());

        $this->jsonRequest('POST', "/api/stores/{$store->getSlug()}/sections", ['title' => '  ']);

        self::assertSame(422, $this->client->getResponse()->getStatusCode());
    }

    public function testManualAddAndRemoveItem(): void
    {
        $store = $this->fixtures->store();
        $card = $this->fixtures->card(101);
        $item = $this->fixtures->inventoryItem($store, $card, 3);
        $this->authenticate($store->getOwner());

        $section = $this->createSection($store, 'Manual');

        // Add the listing.
        $body = $this->jsonRequest(
            'POST',
            "/api/stores/{$store->getSlug()}/sections/{$section->getId()}/items",
            ['inventoryItemId' => $item->getId()],
        );
        self::assertResponseIsSuccessful();
        self::assertCount(1, $body['cards']);
        self::assertSame($item->getId(), $body['cards'][0]['inventoryItem']['id']);
        $sectionCardId = $body['cards'][0]['id'];

        // Re-adding the same listing is a no-op (idempotent).
        $body = $this->jsonRequest(
            'POST',
            "/api/stores/{$store->getSlug()}/sections/{$section->getId()}/items",
            ['inventoryItemIds' => [$item->getId()]],
        );
        self::assertCount(1, $body['cards']);

        // Remove it.
        $body = $this->jsonRequest(
            'DELETE',
            "/api/stores/{$store->getSlug()}/sections/{$section->getId()}/items/{$sectionCardId}",
        );
        self::assertResponseIsSuccessful();
        self::assertCount(0, $body['cards']);
    }

    public function testAddItemFromAnotherStoreIsIgnored(): void
    {
        $store = $this->fixtures->store();
        $other = $this->fixtures->store();
        $card = $this->fixtures->card(102);
        $foreignItem = $this->fixtures->inventoryItem($other, $card, 1);
        $this->authenticate($store->getOwner());

        $section = $this->createSection($store, 'Manual');

        $body = $this->jsonRequest(
            'POST',
            "/api/stores/{$store->getSlug()}/sections/{$section->getId()}/items",
            ['inventoryItemId' => $foreignItem->getId()],
        );

        self::assertResponseIsSuccessful();
        self::assertCount(0, $body['cards']);
    }

    public function testAutoFillPullsByPriceAndRarity(): void
    {
        $store = $this->fixtures->store();
        // Three listings: a cheap common, a mid rare, and an expensive mythic.
        $cheap = $this->fixtures->inventoryItem($store, $this->fixtures->card(201, ['rarity' => 'common']), 1, priceCents: 200);
        $mid = $this->fixtures->inventoryItem($store, $this->fixtures->card(202, ['rarity' => 'rare']), 1, priceCents: 2500);
        $pricey = $this->fixtures->inventoryItem($store, $this->fixtures->card(203, ['rarity' => 'mythic']), 1, priceCents: 9000);
        $this->authenticate($store->getOwner());

        $section = $this->createSection($store, 'Rares $10–$50', StoreSection::MODE_AUTO);

        $body = $this->jsonRequest(
            'POST',
            "/api/stores/{$store->getSlug()}/sections/{$section->getId()}/auto-fill",
            ['autoMinPriceCents' => 1000, 'autoMaxPriceCents' => 5000, 'autoRarity' => 'rare'],
        );

        self::assertResponseIsSuccessful();
        self::assertCount(1, $body['cards']);
        self::assertSame($mid->getId(), $body['cards'][0]['inventoryItem']['id']);
        self::assertSame('auto', $body['mode']);
        self::assertSame(1000, $body['autoMinPriceCents']);
        self::assertSame('rare', $body['autoRarity']);
    }

    public function testAutoFillIsRepeatableAndReplacesContents(): void
    {
        $store = $this->fixtures->store();
        $a = $this->fixtures->inventoryItem($store, $this->fixtures->card(301, ['rarity' => 'rare']), 1, priceCents: 1500);
        $this->authenticate($store->getOwner());
        $section = $this->createSection($store, 'Auto', StoreSection::MODE_AUTO);

        $first = $this->jsonRequest(
            'POST',
            "/api/stores/{$store->getSlug()}/sections/{$section->getId()}/auto-fill",
            ['autoRarity' => 'rare'],
        );
        self::assertCount(1, $first['cards']);

        // A second pull with the same criteria yields the same single card, not a duplicate.
        $second = $this->jsonRequest(
            'POST',
            "/api/stores/{$store->getSlug()}/sections/{$section->getId()}/auto-fill",
        );
        self::assertCount(1, $second['cards']);
        self::assertSame($a->getId(), $second['cards'][0]['inventoryItem']['id']);
    }

    public function testPublicCanReadSectionsWithoutAuth(): void
    {
        $store = $this->fixtures->store();
        $item = $this->fixtures->inventoryItem($store, $this->fixtures->card(401), 1);
        $this->authenticate($store->getOwner());
        $section = $this->createSection($store, 'Featured');
        $this->jsonRequest(
            'POST',
            "/api/stores/{$store->getSlug()}/sections/{$section->getId()}/items",
            ['inventoryItemId' => $item->getId()],
        );

        // Anonymous read — no Bearer token attached.
        $this->anonymous();
        $body = $this->jsonRequest('GET', "/api/stores/{$store->getSlug()}/sections");
        self::assertResponseIsSuccessful();
        self::assertCount(1, $body);
        self::assertSame('Featured', $body[0]['title']);
        self::assertCount(1, $body[0]['cards']);
    }

    public function testNonOwnerCannotMutate(): void
    {
        $store = $this->fixtures->store();
        $section = $this->createSectionDirect($store, 'Owned');
        $intruder = $this->fixtures->user(['ROLE_USER']);
        $this->authenticate($intruder);

        $this->jsonRequest('POST', "/api/stores/{$store->getSlug()}/sections", ['title' => 'Nope']);
        self::assertSame(403, $this->client->getResponse()->getStatusCode());

        $this->jsonRequest('DELETE', "/api/stores/{$store->getSlug()}/sections/{$section->getId()}");
        self::assertSame(403, $this->client->getResponse()->getStatusCode());
    }

    public function testAnonymousCannotCreate(): void
    {
        $store = $this->fixtures->store();
        $this->jsonRequest('POST', "/api/stores/{$store->getSlug()}/sections", ['title' => 'Nope']);

        self::assertSame(401, $this->client->getResponse()->getStatusCode());
    }

    private function createSection(Store $store, string $title, string $mode = StoreSection::MODE_MANUAL): StoreSection
    {
        $body = $this->jsonRequest('POST', "/api/stores/{$store->getSlug()}/sections", [
            'title' => $title,
            'mode' => $mode,
        ]);
        self::assertSame(201, $this->client->getResponse()->getStatusCode());

        return $this->em->getRepository(StoreSection::class)->find($body['id']);
    }

    private function createSectionDirect(Store $store, string $title): StoreSection
    {
        $section = new StoreSection();
        $section->setStore($store);
        $section->setTitle($title);
        $section->setPosition(0);
        $this->em->persist($section);
        $this->em->flush();

        return $section;
    }
}
