<?php

namespace App\Repository;

use App\Entity\InventoryItem;
use App\Entity\Store;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<InventoryItem>
 */
class InventoryItemRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, InventoryItem::class);
    }

    /**
     * One page of a store's inventory, card eagerly joined. Ordered by card
     * name with the item id as a stable tiebreaker so LIMIT/OFFSET pages
     * never overlap or skip rows when many printings share a name.
     *
     * @return list<InventoryItem>
     */
    public function findPageByStore(Store $store, int $offset, int $limit): array
    {
        return $this->createQueryBuilder('i')
            ->andWhere('i.store = :store')
            ->setParameter('store', $store)
            ->join('i.card', 'c')
            ->addSelect('c')
            ->orderBy('c.name', 'ASC')
            ->addOrderBy('i.id', 'ASC')
            ->setFirstResult($offset)
            ->setMaxResults($limit)
            ->getQuery()
            ->getResult();
    }

    public function countByStore(Store $store): int
    {
        return (int) $this->createQueryBuilder('i')
            ->select('COUNT(i.id)')
            ->andWhere('i.store = :store')
            ->setParameter('store', $store)
            ->getQuery()
            ->getSingleScalarResult();
    }

    /**
     * Keyset (cursor) page: items with id > $afterId, ascending. Backed by
     * idx_inventory_store_id_id, each page is an O(page-size) index range
     * scan — unlike OFFSET pages, walking the whole inventory is linear, and
     * because the cursor is an immutable id, concurrent inserts/deletes can
     * never shift rows into (duplicate) or out of (skip) later pages.
     *
     * @return list<InventoryItem>
     */
    public function findByStoreAfterId(Store $store, int $afterId, int $limit): array
    {
        return $this->createQueryBuilder('i')
            ->andWhere('i.store = :store')
            ->andWhere('i.id > :afterId')
            ->setParameter('store', $store)
            ->setParameter('afterId', $afterId)
            ->join('i.card', 'c')
            ->addSelect('c')
            ->orderBy('i.id', 'ASC')
            ->setMaxResults($limit)
            ->getQuery()
            ->getResult();
    }

    public function findOneByStoreAndId(Store $store, int $id): ?InventoryItem
    {
        return $this->createQueryBuilder('i')
            ->join('i.card', 'c')
            ->addSelect('c')
            ->andWhere('i.store = :store')
            ->andWhere('i.id = :id')
            ->setParameter('store', $store)
            ->setParameter('id', $id)
            ->getQuery()
            ->getOneOrNullResult();
    }
}
