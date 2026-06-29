<?php

namespace App\Repository;

use App\Entity\Card;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Card>
 */
class CardRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Card::class);
    }

    /** @return list<Card> */
    public function searchByName(string $query, int $limit = 20): array
    {
        return $this->createQueryBuilder('c')
            ->andWhere('LOWER(c.name) LIKE :query')
            ->setParameter('query', '%'.strtolower($query).'%')
            ->orderBy('c.name', 'ASC')
            ->setMaxResults($limit)
            ->getQuery()
            ->getResult();
    }
}
