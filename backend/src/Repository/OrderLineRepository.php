<?php

namespace App\Repository;

use App\Entity\OrderLine;
use App\Entity\StoreSection;
use App\Enum\OrderStatus;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<OrderLine>
 */
class OrderLineRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, OrderLine::class);
    }

    /**
     * The section's pull sheet: case-card lines of orders still in an "open"
     * status (sold, not yet pulled/handed over), oldest order first. Order and
     * card are eagerly joined for display.
     *
     * @param list<OrderStatus> $openStatuses
     *
     * @return list<OrderLine>
     */
    public function findOpenPullLinesForSection(StoreSection $section, array $openStatuses): array
    {
        return $this->createQueryBuilder('l')
            ->join('l.sectionCard', 'sc')
            ->join('l.parentOrder', 'o')->addSelect('o')
            ->leftJoin('l.card', 'c')->addSelect('c')
            ->andWhere('sc.section = :section')
            ->andWhere('o.status IN (:statuses)')
            ->andWhere('l.caseQuantity > 0')
            ->setParameter('section', $section)
            ->setParameter('statuses', $openStatuses)
            ->orderBy('o.createdAt', 'ASC')
            ->addOrderBy('l.id', 'ASC')
            ->getQuery()
            ->getResult();
    }
}
