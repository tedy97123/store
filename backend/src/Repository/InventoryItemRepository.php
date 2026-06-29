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

    /** @return list<InventoryItem> */
    public function findByStore(Store $store): array
    {
        return $this->createQueryBuilder('i')
            ->andWhere('i.store = :store')
            ->setParameter('store', $store)
            ->join('i.card', 'c')
            ->addSelect('c')
            ->orderBy('c.name', 'ASC')
            ->getQuery()
            ->getResult();
    }
}
