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

        $item = $this->inventoryRepository->find($uriVariables['id'] ?? null);
        if (!$item instanceof InventoryItem || $item->getStore()?->getId() !== $store->getId()) {
            throw new NotFoundHttpException('Inventory item not found.');
        }

        return $item;
    }
}
