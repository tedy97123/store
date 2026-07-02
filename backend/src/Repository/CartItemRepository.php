<?php

namespace App\Repository;

use App\Entity\CartItem;
use App\Entity\InventoryItem;
use App\Entity\StoreCustomer;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<CartItem>
 */
class CartItemRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, CartItem::class);
    }

    public function findOneForCustomerAndItem(StoreCustomer $customer, InventoryItem $item): ?CartItem
    {
        return $this->findOneBy(['customer' => $customer, 'inventoryItem' => $item]);
    }

    /** @return list<CartItem> */
    public function findForCustomer(StoreCustomer $customer): array
    {
        return $this->createQueryBuilder('cartItem')
            ->join('cartItem.inventoryItem', 'item')
            ->join('item.card', 'card')
            ->addSelect('item', 'card')
            ->andWhere('cartItem.customer = :customer')
            ->setParameter('customer', $customer)
            ->orderBy('cartItem.createdAt', 'DESC')
            ->getQuery()
            ->getResult();
    }
}
