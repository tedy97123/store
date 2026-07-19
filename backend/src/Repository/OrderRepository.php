<?php

namespace App\Repository;

use App\Entity\Order;
use App\Entity\Store;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\DBAL\ArrayParameterType;
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

    /**
     * One page of a store's orders, newest first, with lines AND their cards
     * fetch-joined (serializing lines without the card join caused one lazy
     * card SELECT per order line — N+1).
     *
     * Two-step fetch: page the order ids first (LIMIT/OFFSET on a to-many
     * fetch join truncates joined ROWS, not orders — the classic Doctrine
     * pagination pitfall), then load those ids with the joins.
     *
     * @return list<Order>
     */
    public function findPageByStore(Store $store, int $offset, int $limit): array
    {
        $ids = $this->createQueryBuilder('o')
            ->select('o.id')
            ->andWhere('o.store = :store')
            ->setParameter('store', $store)
            ->orderBy('o.createdAt', 'DESC')
            ->addOrderBy('o.id', 'DESC')
            ->setFirstResult($offset)
            ->setMaxResults($limit)
            ->getQuery()
            ->getSingleColumnResult();

        if ([] === $ids) {
            return [];
        }

        return $this->createQueryBuilder('o')
            ->leftJoin('o.lines', 'line')
            ->addSelect('line')
            ->leftJoin('line.card', 'card')
            ->addSelect('card')
            ->andWhere('o.id IN (:ids)')
            ->setParameter('ids', array_map('intval', $ids), ArrayParameterType::INTEGER)
            ->orderBy('o.createdAt', 'DESC')
            ->addOrderBy('o.id', 'DESC')
            ->getQuery()
            ->getResult();
    }

    public function countByStore(Store $store): int
    {
        return (int) $this->createQueryBuilder('o')
            ->select('COUNT(o.id)')
            ->andWhere('o.store = :store')
            ->setParameter('store', $store)
            ->getQuery()
            ->getSingleScalarResult();
    }

    /**
     * A customer's orders in one store, newest first. Backed by the
     * (store_id, LOWER(customer_email)) expression index and bounded —
     * previously an unindexed, unlimited scan of the store's whole order
     * table per "my orders" view.
     *
     * @return list<Order>
     */
    public function findByStoreAndCustomerEmail(Store $store, string $email, int $limit = 500): array
    {
        // Same two-step pattern as findPageByStore: a LIMIT combined with the
        // to-many lines fetch join would truncate joined rows, not orders.
        $ids = $this->createQueryBuilder('o')
            ->select('o.id')
            ->andWhere('o.store = :store')
            ->andWhere('LOWER(o.customerEmail) = LOWER(:email)')
            ->setParameter('store', $store)
            ->setParameter('email', $email)
            ->orderBy('o.createdAt', 'DESC')
            ->addOrderBy('o.id', 'DESC')
            ->setMaxResults($limit)
            ->getQuery()
            ->getSingleColumnResult();

        if ([] === $ids) {
            return [];
        }

        return $this->createQueryBuilder('o')
            ->leftJoin('o.lines', 'line')
            ->addSelect('line')
            ->leftJoin('line.card', 'card')
            ->addSelect('card')
            ->andWhere('o.id IN (:ids)')
            ->setParameter('ids', array_map('intval', $ids), ArrayParameterType::INTEGER)
            ->orderBy('o.createdAt', 'DESC')
            ->addOrderBy('o.id', 'DESC')
            ->getQuery()
            ->getResult();
    }
}
