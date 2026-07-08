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
        return $this->createQueryBuilder('o')
            ->leftJoin('o.lines', 'line')
            ->addSelect('line')
            ->andWhere('o.store = :store')
            ->setParameter('store', $store)
            ->orderBy('o.createdAt', 'DESC')
            ->getQuery()
            ->getResult();
    }

    /** @return list<Order> */
    public function findByStoreAndCustomerEmail(Store $store, string $email): array
    {
        return $this->createQueryBuilder('o')
            ->leftJoin('o.lines', 'line')
            ->addSelect('line')
            ->andWhere('o.store = :store')
            ->andWhere('LOWER(o.customerEmail) = LOWER(:email)')
            ->setParameter('store', $store)
            ->setParameter('email', $email)
            ->orderBy('o.createdAt', 'DESC')
            ->getQuery()
            ->getResult();
    }
}
