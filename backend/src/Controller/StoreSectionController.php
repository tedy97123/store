<?php

namespace App\Controller;

use App\Entity\InventoryItem;
use App\Entity\Store;
use App\Entity\StoreSection;
use App\Entity\StoreSectionCard;
use App\Repository\InventoryItemRepository;
use App\Repository\StoreRepository;
use App\Repository\StoreSectionCardRepository;
use App\Repository\StoreSectionRepository;
use App\Service\Catalog\CatalogCardResolver;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * "Case Cards" sections — named, ordered groups of a store's inventory listings
 * shown on the store's public Case Cards page.
 *
 * The GET collection is public (it backs the storefront page). Every mutating
 * route is gated on STORE_MANAGE, so only the store owner (or a super-admin)
 * can create, edit, fill, or delete a section.
 */
#[Route('/api/stores/{slug}/sections')]
final class StoreSectionController extends AbstractController
{
    /** Upper bound on rows a single "Pull from inventory" click materialises. */
    private const AUTO_FILL_MAX = 60;

    /** Rarities the auto-fill filter accepts (matched case-insensitively). */
    private const ALLOWED_RARITIES = ['common', 'uncommon', 'rare', 'mythic', 'special', 'bonus'];

    public function __construct(
        private readonly StoreRepository $storeRepository,
        private readonly StoreSectionRepository $sectionRepository,
        private readonly StoreSectionCardRepository $sectionCardRepository,
        private readonly InventoryItemRepository $inventoryItemRepository,
        private readonly CatalogCardResolver $catalogCardResolver,
        private readonly EntityManagerInterface $entityManager,
    ) {
    }

    /**
     * Public: all of a store's sections with their cards, for the storefront
     * Case Cards page. Empty sections are included so the owner can see the
     * scaffolding they've created even before filling it.
     */
    #[Route('', name: 'api_store_sections_list', methods: ['GET'])]
    public function list(string $slug): JsonResponse
    {
        $store = $this->storeRepository->findOneBySlug($slug);
        if (null === $store) {
            return $this->json(['detail' => 'Store not found.'], 404);
        }

        return $this->json(array_map(
            $this->serializeSection(...),
            $this->sectionRepository->findForStore($store),
        ));
    }

    #[Route('', name: 'api_store_sections_create', methods: ['POST'])]
    #[IsGranted('ROLE_USER')]
    public function create(Request $request, string $slug): JsonResponse
    {
        $store = $this->findManagedStore($slug);
        if (!$store instanceof Store) {
            return $this->json(['detail' => 'Store not found.'], 404);
        }

        $payload = $this->decodeBody($request);
        if (!is_array($payload)) {
            return $this->json(['detail' => 'Request body must be a JSON object.'], 400);
        }

        $title = trim((string) ($payload['title'] ?? ''));
        if ('' === $title) {
            return $this->json(['detail' => 'A section title is required.'], 422);
        }

        $section = new StoreSection();
        $section->setStore($store);
        $section->setTitle($this->truncate($title, 120));
        $section->setPosition($this->sectionRepository->nextPosition($store));

        $error = $this->applySettings($section, $payload);
        if (null !== $error) {
            return $this->json(['detail' => $error], 422);
        }

        $this->entityManager->persist($section);
        $this->entityManager->flush();

        return $this->json($this->serializeSection($section), 201);
    }

    #[Route('/{id}', name: 'api_store_sections_update', methods: ['PATCH'])]
    #[IsGranted('ROLE_USER')]
    public function update(Request $request, string $slug, int $id): JsonResponse
    {
        $section = $this->findManagedSection($slug, $id);
        if (!$section instanceof StoreSection) {
            return $this->json(['detail' => 'Section not found.'], 404);
        }

        $payload = $this->decodeBody($request);
        if (!is_array($payload)) {
            return $this->json(['detail' => 'Request body must be a JSON object.'], 400);
        }

        if (array_key_exists('title', $payload)) {
            $title = trim((string) $payload['title']);
            if ('' === $title) {
                return $this->json(['detail' => 'A section title cannot be empty.'], 422);
            }
            $section->setTitle($this->truncate($title, 120));
        }

        $error = $this->applySettings($section, $payload);
        if (null !== $error) {
            return $this->json(['detail' => $error], 422);
        }

        $this->entityManager->flush();

        return $this->json($this->serializeSection($section));
    }

    #[Route('/{id}', name: 'api_store_sections_delete', methods: ['DELETE'])]
    #[IsGranted('ROLE_USER')]
    public function delete(string $slug, int $id): JsonResponse
    {
        $section = $this->findManagedSection($slug, $id);
        if (!$section instanceof StoreSection) {
            return $this->json(['detail' => 'Section not found.'], 404);
        }

        $this->entityManager->remove($section);
        $this->entityManager->flush();

        return $this->json(null, 204);
    }

    /**
     * Manual fill: append one or more of the store's inventory listings to the
     * section. Listings already in the section (or not belonging to the store)
     * are skipped silently, so the client can re-send a selection idempotently.
     */
    #[Route('/{id}/items', name: 'api_store_sections_add_items', methods: ['POST'])]
    #[IsGranted('ROLE_USER')]
    public function addItems(Request $request, string $slug, int $id): JsonResponse
    {
        $section = $this->findManagedSection($slug, $id);
        if (!$section instanceof StoreSection) {
            return $this->json(['detail' => 'Section not found.'], 404);
        }

        $store = $section->getStore();
        if (!$store instanceof Store) {
            return $this->json(['detail' => 'Section is not attached to a store.'], 409);
        }

        $payload = $this->decodeBody($request);
        $ids = $this->readInventoryItemIds($payload);
        if (null === $ids) {
            return $this->json(['detail' => 'Provide inventoryItemId or a non-empty inventoryItemIds array.'], 422);
        }

        $existing = $this->existingInventoryItemIds($section);
        $position = $this->sectionCardRepository->nextPosition($section);
        $added = 0;

        foreach ($ids as $itemId) {
            if (isset($existing[$itemId])) {
                continue;
            }

            $item = $this->inventoryItemRepository->findOneByStoreAndId($store, $itemId);
            if (!$item instanceof InventoryItem) {
                continue;
            }

            $section->addCard($this->makeCard($item, $position++));
            $existing[$itemId] = true;
            ++$added;
        }

        if ($added > 0) {
            $this->entityManager->flush();
            $this->entityManager->refresh($section);
        }

        return $this->json($this->serializeSection($section));
    }

    #[Route('/{id}/items/{cardId}', name: 'api_store_sections_remove_item', methods: ['DELETE'])]
    #[IsGranted('ROLE_USER')]
    public function removeItem(string $slug, int $id, int $cardId): JsonResponse
    {
        $section = $this->findManagedSection($slug, $id);
        if (!$section instanceof StoreSection) {
            return $this->json(['detail' => 'Section not found.'], 404);
        }

        foreach ($section->getCards() as $card) {
            if ($card->getId() === $cardId) {
                $section->removeCard($card);
                $this->entityManager->flush();
                break;
            }
        }

        $this->entityManager->refresh($section);

        return $this->json($this->serializeSection($section));
    }

    /**
     * Auto fill: replace the section's contents with the store's inventory
     * listings matching the (optionally updated) price range + rarity. This is
     * the "Pull from inventory" button — a one-shot materialisation, re-runnable
     * to refresh. The resulting rows stay editable afterwards.
     */
    #[Route('/{id}/auto-fill', name: 'api_store_sections_auto_fill', methods: ['POST'])]
    #[IsGranted('ROLE_USER')]
    public function autoFill(Request $request, string $slug, int $id): JsonResponse
    {
        $section = $this->findManagedSection($slug, $id);
        if (!$section instanceof StoreSection) {
            return $this->json(['detail' => 'Section not found.'], 404);
        }

        $store = $section->getStore();
        if (!$store instanceof Store) {
            return $this->json(['detail' => 'Section is not attached to a store.'], 409);
        }

        $payload = $this->decodeBody($request);
        if (is_array($payload) && [] !== $payload) {
            // Let the same request that clicks "Pull" also save the criteria.
            $section->setMode(StoreSection::MODE_AUTO);
            $error = $this->applySettings($section, $payload + ['mode' => StoreSection::MODE_AUTO]);
            if (null !== $error) {
                return $this->json(['detail' => $error], 422);
            }
        }

        $min = $section->getAutoMinPriceCents();
        $max = $section->getAutoMaxPriceCents();
        if (null !== $min && null !== $max && $min > $max) {
            return $this->json(['detail' => 'Minimum price cannot exceed maximum price.'], 422);
        }

        $matches = $this->inventoryItemRepository->findForAutoSection(
            $store,
            $min,
            $max,
            $section->getAutoRarity(),
            self::AUTO_FILL_MAX,
        );

        $section->clearCards();
        $this->entityManager->flush();

        $position = 0;
        foreach ($matches as $item) {
            $section->addCard($this->makeCard($item, $position++));
        }
        $this->entityManager->flush();
        $this->entityManager->refresh($section);

        return $this->json($this->serializeSection($section));
    }

    /**
     * Apply the settable fields common to create/update/auto-fill: mode and the
     * three auto-criteria columns. Returns an error string on invalid input, or
     * null on success. Only keys actually present in the payload are touched.
     */
    private function applySettings(StoreSection $section, array $payload): ?string
    {
        if (array_key_exists('mode', $payload)) {
            $mode = (string) $payload['mode'];
            if (!in_array($mode, [StoreSection::MODE_MANUAL, StoreSection::MODE_AUTO], true)) {
                return 'Mode must be "manual" or "auto".';
            }
            $section->setMode($mode);
        }

        if (array_key_exists('autoMinPriceCents', $payload)) {
            $min = $this->readNullableNonNegativeInt($payload['autoMinPriceCents']);
            if (false === $min) {
                return 'autoMinPriceCents must be a non-negative integer or null.';
            }
            $section->setAutoMinPriceCents($min);
        }

        if (array_key_exists('autoMaxPriceCents', $payload)) {
            $max = $this->readNullableNonNegativeInt($payload['autoMaxPriceCents']);
            if (false === $max) {
                return 'autoMaxPriceCents must be a non-negative integer or null.';
            }
            $section->setAutoMaxPriceCents($max);
        }

        if (array_key_exists('autoRarity', $payload)) {
            $raw = $payload['autoRarity'];
            if (null === $raw || '' === $raw) {
                $section->setAutoRarity(null);
            } else {
                $rarity = strtolower(trim((string) $raw));
                if (!in_array($rarity, self::ALLOWED_RARITIES, true)) {
                    return 'autoRarity must be one of: '.implode(', ', self::ALLOWED_RARITIES).'.';
                }
                $section->setAutoRarity($rarity);
            }
        }

        return null;
    }

    /**
     * @return list<int>|null null when the payload carries no usable id(s)
     */
    private function readInventoryItemIds(mixed $payload): ?array
    {
        if (!is_array($payload)) {
            return null;
        }

        $raw = [];
        if (array_key_exists('inventoryItemId', $payload)) {
            $raw[] = $payload['inventoryItemId'];
        }
        if (isset($payload['inventoryItemIds']) && is_array($payload['inventoryItemIds'])) {
            $raw = array_merge($raw, $payload['inventoryItemIds']);
        }

        $ids = [];
        foreach ($raw as $value) {
            if (is_int($value) || (is_string($value) && ctype_digit($value))) {
                $id = (int) $value;
                if ($id > 0) {
                    $ids[$id] = true;
                }
            }
        }

        return [] === $ids ? null : array_keys($ids);
    }

    /**
     * @return int|null|false false = invalid; int/null = the parsed value
     */
    private function readNullableNonNegativeInt(mixed $value): int|null|false
    {
        if (null === $value || '' === $value) {
            return null;
        }
        if (is_int($value) && $value >= 0) {
            return $value;
        }
        if (is_string($value) && ctype_digit($value)) {
            return (int) $value;
        }

        return false;
    }

    /** @return array<int, true> inventory item ids already placed in the section */
    private function existingInventoryItemIds(StoreSection $section): array
    {
        $ids = [];
        foreach ($section->getCards() as $card) {
            $item = $card->getInventoryItem();
            if ($item instanceof InventoryItem && null !== $item->getId()) {
                $ids[$item->getId()] = true;
            }
        }

        return $ids;
    }

    private function makeCard(InventoryItem $item, int $position): StoreSectionCard
    {
        $card = new StoreSectionCard();
        $card->setInventoryItem($item);
        $card->setPosition($position);

        return $card;
    }

    private function findManagedStore(string $slug): ?Store
    {
        $store = $this->storeRepository->findOneBySlug($slug);
        if (null === $store) {
            return null;
        }

        $this->denyAccessUnlessGranted('STORE_MANAGE', $store);

        return $store;
    }

    private function findManagedSection(string $slug, int $id): ?StoreSection
    {
        $store = $this->findManagedStore($slug);
        if (!$store instanceof Store) {
            return null;
        }

        return $this->sectionRepository->findOneForStore($store, $id);
    }

    private function decodeBody(Request $request): mixed
    {
        $content = $request->getContent();
        if ('' === $content) {
            return [];
        }

        return json_decode($content, true);
    }

    private function truncate(string $value, int $maxLength): string
    {
        return strlen($value) > $maxLength ? substr($value, 0, $maxLength) : $value;
    }

    private function serializeSection(StoreSection $section): array
    {
        $cards = [];
        foreach ($section->getCards() as $card) {
            $item = $card->getInventoryItem();
            if (!$item instanceof InventoryItem) {
                continue;
            }
            $cards[] = [
                'id' => $card->getId(),
                'position' => $card->getPosition(),
                'inventoryItem' => $this->serializeInventoryItem($item),
            ];
        }

        return [
            'id' => $section->getId(),
            'title' => $section->getTitle(),
            'position' => $section->getPosition(),
            'mode' => $section->getMode(),
            'autoMinPriceCents' => $section->getAutoMinPriceCents(),
            'autoMaxPriceCents' => $section->getAutoMaxPriceCents(),
            'autoRarity' => $section->getAutoRarity(),
            'createdAt' => $section->getCreatedAt()->format(DATE_ATOM),
            'cards' => $cards,
        ];
    }

    private function serializeInventoryItem(InventoryItem $item): array
    {
        $card = $item->getCard();

        return [
            'id' => $item->getId(),
            'priceCents' => $item->getPriceCents(),
            'quantity' => $item->getQuantity(),
            'condition' => $item->getCondition()->value,
            'isFoil' => $item->isFoil(),
            'card' => null !== $card ? $this->catalogCardResolver->serializeCard($card) : null,
        ];
    }
}
