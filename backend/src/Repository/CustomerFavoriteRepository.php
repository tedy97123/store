<?php

namespace App\Repository;

use App\Entity\CustomerFavorite;
use App\Entity\InventoryItem;
use App\Entity\StoreCustomer;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<CustomerFavorite>
 */
class CustomerFavoriteRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, CustomerFavorite::class);
    }

    public function findOneForCustomerAndItem(StoreCustomer $customer, InventoryItem $item): ?CustomerFavorite
    {
        return $this->findOneBy(['customer' => $customer, 'inventoryItem' => $item]);
    }

    /** @return list<CustomerFavorite> */
    public function findForCustomer(StoreCustomer $customer): array
    {
        return $this->createQueryBuilder('favorite')
            ->join('favorite.inventoryItem', 'item')
            ->join('item.card', 'card')
            ->addSelect('item', 'card')
            ->andWhere('favorite.customer = :customer')
            ->setParameter('customer', $customer)
            ->orderBy('favorite.createdAt', 'DESC')
            ->getQuery()
            ->getResult();
    }
}
