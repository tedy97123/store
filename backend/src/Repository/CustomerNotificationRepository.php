<?php

namespace App\Repository;

use App\Entity\CustomerNotification;
use App\Entity\Order;
use App\Entity\Store;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<CustomerNotification> */
class CustomerNotificationRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, CustomerNotification::class);
    }

    /** @return list<CustomerNotification> */
    public function findForUserAndStore(User $user, Store $store): array
    {
        return $this->createQueryBuilder('notification')
            ->leftJoin('notification.relatedOrder', 'relatedOrder')
            ->addSelect('relatedOrder')
            ->andWhere('notification.user = :user')
            ->andWhere('notification.store = :store')
            ->setParameter('user', $user)
            ->setParameter('store', $store)
            ->orderBy('notification.createdAt', 'DESC')
            ->getQuery()
            ->getResult();
    }

    public function findOneForOrder(User $user, Order $order, string $type): ?CustomerNotification
    {
        return $this->findOneBy([
            'user' => $user,
            'relatedOrder' => $order,
            'type' => $type,
        ]);
    }
}
