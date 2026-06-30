<?php

namespace App\Service\Inventory;

use App\Entity\Card;
use App\Entity\InventoryItem;
use App\Entity\Store;
use App\Enum\CardCondition;
use App\Repository\InventoryItemRepository;
use App\Service\Scryfall\ScryfallClient;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;

final readonly class StoreInventoryWriter
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private InventoryItemRepository $inventoryItemRepository,
        private ScryfallClient $scryfallClient,
        private LoggerInterface $logger,
    ) {
    }

    public function write(
        Store $store,
        Card $card,
        int $quantity,
        CardCondition $condition,
        bool $isFoil,
        ?string $notes = null,
        bool $flush = true,
    ): InventoryItem {
        // Enrich based on missing price/Scryfall data regardless of flush mode.
        // The import path calls write(flush: false); without this it would never enrich.
        if (null === $card->getScryfallData()) {
            try {
                $this->scryfallClient->fetchCardById($card->getId());
            } catch (\Throwable $e) {
                $this->logger->warning('Scryfall enrichment failed for card {id}: {error}', [
                    'id' => (string) $card->getId(),
                    'error' => $e->getMessage(),
                ]);
            }
        }

        $item = $this->inventoryItemRepository->findOneBy([
            'store' => $store,
            'card' => $card,
            'condition' => $condition,
            'isFoil' => $isFoil,
        ]);

        if (!$item instanceof InventoryItem) {
            $item = $this->findScheduledInventoryItem($store, $card, $condition, $isFoil);
        }

        if (!$item instanceof InventoryItem) {
            $item = new InventoryItem();
            $item->setStore($store);
            $item->setCard($card);
            $item->setCondition($condition);
            $item->setIsFoil($isFoil);
            $item->setQuantity(0);
            $this->entityManager->persist($item);
        }

        $item->setQuantity($item->getQuantity() + $quantity);
        $item->setPriceCents($this->resolvePriceCents($card, $isFoil));

        if (null !== $notes && '' !== trim($notes)) {
            $item->setNotes($notes);
        }

        if ($flush) {
            $this->entityManager->flush();
        }

        return $item;
    }

    private function resolvePriceCents(Card $card, bool $isFoil): int
    {
        $prices = $card->getPrices();
        if (!is_array($prices)) {
            return 0;
        }

        $candidates = $isFoil
            ? [
                $prices['usd_foil'] ?? null,
                $prices['usd_etched'] ?? null,
                $prices['usd'] ?? null,
            ]
            : [
                $prices['usd'] ?? null,
                $prices['usd_foil'] ?? null,
            ];

        foreach ($candidates as $candidate) {
            if (!is_string($candidate) || '' === $candidate) {
                continue;
            }

            $parsed = (float) $candidate;
            if ($parsed > 0) {
                return (int) round($parsed * 100);
            }
        }

        return 0;
    }

    private function findScheduledInventoryItem(
        Store $store,
        Card $card,
        CardCondition $condition,
        bool $isFoil,
    ): ?InventoryItem {
        $target = $this->inventoryKey($store, $card, $condition, $isFoil);
        if (null === $target) {
            return null;
        }

        // Build a keyed map of pending (not-yet-flushed) inventory items so repeated
        // lookups within a batch are O(1) instead of an O(n^2) nested scan.
        $pending = [];
        foreach ($this->entityManager->getUnitOfWork()->getScheduledEntityInsertions() as $entity) {
            if (!$entity instanceof InventoryItem) {
                continue;
            }

            $key = $this->inventoryKey($entity->getStore(), $entity->getCard(), $entity->getCondition(), $entity->isFoil());
            if (null !== $key && !isset($pending[$key])) {
                $pending[$key] = $entity;
            }
        }

        return $pending[$target] ?? null;
    }

    /**
     * Builds a stable composite key (store id + card id + condition + foil) used to
     * deduplicate pending inventory items. Uuid is rendered via toRfc4122() so the
     * comparison is exact/strict; returns null when identifiers are not yet available.
     */
    private function inventoryKey(?Store $store, ?Card $card, CardCondition $condition, bool $isFoil): ?string
    {
        $storeId = $store?->getId();
        $cardId = $card?->getId();
        if (null === $storeId || null === $cardId) {
            return null;
        }

        return sprintf('%d|%s|%s|%s', $storeId, $cardId->toRfc4122(), $condition->value, $isFoil ? '1' : '0');
    }
}
