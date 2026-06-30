<?php

namespace App\Repository;

use App\Entity\CustomerWantListEntry;
use App\Entity\StoreCustomer;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<CustomerWantListEntry>
 */
class CustomerWantListEntryRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, CustomerWantListEntry::class);
    }

    /** @return list<CustomerWantListEntry> */
    public function findForCustomer(StoreCustomer $customer): array
    {
        return $this->createQueryBuilder('entry')
            ->leftJoin('entry.card', 'card')
            ->addSelect('card')
            ->andWhere('entry.customer = :customer')
            ->setParameter('customer', $customer)
            ->orderBy('entry.createdAt', 'DESC')
            ->getQuery()
            ->getResult();
    }
}
