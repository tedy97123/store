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
