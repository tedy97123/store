<?php

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProviderInterface;
use App\Entity\InventoryItem;
use App\Entity\Store;
use App\MultiTenancy\TenantContext;
use App\Repository\InventoryItemRepository;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/** @implements ProviderInterface<InventoryItem> */
final readonly class StoreInventoryItemProvider implements ProviderInterface
{
    public function __construct(
        private InventoryItemRepository $inventoryRepository,
        private TenantContext $tenantContext,
    ) {
    }

    public function provide(Operation $operation, array $uriVariables = [], array $context = []): ?InventoryItem
    {
        $store = $this->tenantContext->getStore();
        if (!$store instanceof Store) {
            throw new NotFoundHttpException('Store not found.');
        }

        // Eager-fetch the card (JOIN + addSelect) so the fully hydrated Card —
        // including scryfallData, which powers getCardFaces() for multi-faced
        // cards — is available to the serializer. A bare find() leaves card as a
        // lazy proxy whose scryfallData-derived virtual fields serialize empty.
        $id = $uriVariables['id'] ?? null;
        $item = is_numeric($id) ? $this->inventoryRepository->findOneByStoreAndId($store, (int) $id) : null;
        if (!$item instanceof InventoryItem) {
            throw new NotFoundHttpException('Inventory item not found.');
        }

        return $item;
    }
}
