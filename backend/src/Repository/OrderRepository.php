<?php

namespace App\Repository;

use App\Entity\Order;
use App\Entity\Store;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\ORM\QueryBuilder;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Order>
 */
class OrderRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Order::class);
    }

    /** @return list<Order> */
    public function findByStore(Store $store): array
    {
        return $this->createStoreOrdersQueryBuilder($store)
            ->getQuery()
            ->getResult();
    }

    /** @return list<Order> */
    public function findByStoreAndCustomerEmail(Store $store, string $email): array
    {
        return $this->createStoreOrdersQueryBuilder($store)
            ->andWhere('LOWER(o.customerEmail) = LOWER(:email)')
            ->setParameter('email', $email)
            ->getQuery()
            ->getResult();
    }

    /**
     * Orders with lines and each line's card fetch-joined in one query —
     * serializing line imageUris/setCode otherwise lazy-loads one card per
     * line (N+1).
     */
    private function createStoreOrdersQueryBuilder(Store $store): QueryBuilder
    {
        return $this->createQueryBuilder('o')
            ->leftJoin('o.lines', 'line')
            ->addSelect('line')
            ->leftJoin('line.card', 'card')
            ->addSelect('card')
            ->andWhere('o.store = :store')
            ->setParameter('store', $store)
            ->orderBy('o.createdAt', 'DESC');
    }
}
