<?php

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\Pagination\TraversablePaginator;
use ApiPlatform\State\ProviderInterface;
use App\Entity\InventoryItem;
use App\Entity\Store;
use App\MultiTenancy\TenantContext;
use App\Repository\InventoryItemRepository;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Paginated store inventory collection.
 *
 * Previously this hydrated and serialized a store's ENTIRE inventory in one
 * response — a per-store scaling wall (a 100k-listing store meant 100k
 * entities per request). Pagination is now applied at the SQL level; clients
 * page with `?page=` and `?itemsPerPage=` (capped) and the frontend walks
 * pages until a short one.
 *
 * @implements ProviderInterface<InventoryItem>
 */
final readonly class StoreInventoryCollectionProvider implements ProviderInterface
{
    private const DEFAULT_ITEMS_PER_PAGE = 500;
    private const MAX_ITEMS_PER_PAGE = 500;

    public function __construct(
        private InventoryItemRepository $inventoryRepository,
        private TenantContext $tenantContext,
    ) {
    }

    public function provide(Operation $operation, array $uriVariables = [], array $context = []): object|array|null
    {
        $store = $this->tenantContext->getStore();
        if (!$store instanceof Store) {
            throw new NotFoundHttpException('Store not found.');
        }

        $filters = is_array($context['filters'] ?? null) ? $context['filters'] : [];
        $itemsPerPage = (int) ($filters['itemsPerPage'] ?? self::DEFAULT_ITEMS_PER_PAGE);
        $itemsPerPage = min(self::MAX_ITEMS_PER_PAGE, max(1, $itemsPerPage));

        // Keyset path (preferred; used by the frontend walk): ?afterId=N
        // returns the next id-ordered slice. O(page) via the (store_id, id)
        // index, no COUNT query, and immune to concurrent-write page drift
        // (an OFFSET walk both skips and duplicates rows when items are
        // inserted/deleted between page requests).
        if (isset($filters['afterId'])) {
            $afterId = max(0, (int) $filters['afterId']);

            return $this->inventoryRepository->findByStoreAfterId($store, $afterId, $itemsPerPage);
        }

        $page = max(1, (int) ($filters['page'] ?? 1));
        $items = $this->inventoryRepository->findPageByStore($store, ($page - 1) * $itemsPerPage, $itemsPerPage);
        $total = $this->inventoryRepository->countByStore($store);

        return new TraversablePaginator(new \ArrayIterator($items), $page, $itemsPerPage, $total);
    }
}
