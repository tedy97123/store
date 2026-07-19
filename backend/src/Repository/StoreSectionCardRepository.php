<?php

namespace App\Repository;

use App\Entity\StoreSection;
use App\Entity\StoreSectionCard;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<StoreSectionCard>
 */
class StoreSectionCardRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, StoreSectionCard::class);
    }

    public function nextPosition(StoreSection $section): int
    {
        $max = $this->createQueryBuilder('sc')
            ->select('MAX(sc.position)')
            ->andWhere('sc.section = :section')
            ->setParameter('section', $section)
            ->getQuery()
            ->getSingleScalarResult();

        return null === $max ? 0 : ((int) $max) + 1;
    }
}
