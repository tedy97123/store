<?php

namespace App\Repository;

use App\Entity\CsvImportJob;
use App\Entity\CsvImportRow;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<CsvImportRow> */
class CsvImportRowRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, CsvImportRow::class);
    }

    /** @return list<CsvImportRow> */
    public function findWindow(CsvImportJob $job, int $offset, int $limit, ?string $status = null): array
    {
        $qb = $this->createQueryBuilder('row')
            ->andWhere('row.job = :job')
            ->setParameter('job', $job)
            ->orderBy('row.rowIndex', 'ASC')
            ->setFirstResult($offset)
            ->setMaxResults($limit);

        if (null !== $status) {
            $qb->andWhere('row.status = :status')->setParameter('status', $status);
        }

        return $qb->getQuery()->getResult();
    }

    /** @return list<CsvImportRow> */
    public function findNextQueued(CsvImportJob $job, int $limit): array
    {
        return $this->findWindow($job, 0, $limit, CsvImportRow::STATUS_QUEUED);
    }

    /**
     * Atomically claim the next batch of queued rows for a job, marking them as
     * PROCESSING so that two concurrent handlers can never grab the same rows.
     *
     * Uses `SELECT ... FOR UPDATE SKIP LOCKED` (MySQL 8 / PostgreSQL) inside a
     * transaction so locked rows are skipped instead of blocking. Falls back to a
     * plain locking SELECT on drivers that do not support SKIP LOCKED.
     *
     * @return list<CsvImportRow>
     */
    public function claimNextQueued(CsvImportJob $job, int $limit): array
    {
        if ($limit < 1) {
            return [];
        }

        $entityManager = $this->getEntityManager();
        $connection = $entityManager->getConnection();
        $platform = $connection->getDatabasePlatform();
        // SKIP LOCKED is supported on MySQL 8+ and PostgreSQL; detect by platform class
        // (DBAL 4 removed AbstractPlatform::getName()).
        $supportsSkipLocked = $platform instanceof \Doctrine\DBAL\Platforms\AbstractMySQLPlatform
            || $platform instanceof \Doctrine\DBAL\Platforms\PostgreSQLPlatform;

        return $entityManager->wrapInTransaction(function () use ($job, $limit, $connection, $supportsSkipLocked): array {
            $sql = 'SELECT id FROM csv_import_rows WHERE job_id = :job AND status = :status ORDER BY row_index ASC LIMIT :limit FOR UPDATE';
            if ($supportsSkipLocked) {
                $sql .= ' SKIP LOCKED';
            }

            $ids = $connection->executeQuery(
                $sql,
                [
                    'job' => $job->getId(),
                    'status' => CsvImportRow::STATUS_QUEUED,
                    'limit' => $limit,
                ],
                [
                    'job' => \PDO::PARAM_INT,
                    'status' => \PDO::PARAM_STR,
                    'limit' => \PDO::PARAM_INT,
                ],
            )->fetchFirstColumn();

            if ([] === $ids) {
                return [];
            }

            $ids = array_map('intval', $ids);

            $connection->executeStatement(
                'UPDATE csv_import_rows SET status = :processing WHERE id IN (:ids)',
                [
                    'processing' => CsvImportRow::STATUS_PROCESSING,
                    'ids' => $ids,
                ],
                [
                    'processing' => \PDO::PARAM_STR,
                    'ids' => \Doctrine\DBAL\ArrayParameterType::INTEGER,
                ],
            );

            $rows = $this->createQueryBuilder('row')
                ->andWhere('row.id IN (:ids)')
                ->setParameter('ids', $ids)
                ->orderBy('row.rowIndex', 'ASC')
                ->getQuery()
                ->getResult();

            // Refresh so the managed entities reflect the committed PROCESSING status.
            $manager = $this->getEntityManager();
            foreach ($rows as $row) {
                $manager->refresh($row);
            }

            return $rows;
        });
    }

    /** @return array{queued: int, processing: int, imported: int, error: int} */
    public function countByStatus(CsvImportJob $job): array
    {
        $counts = [
            CsvImportRow::STATUS_QUEUED => 0,
            CsvImportRow::STATUS_PROCESSING => 0,
            CsvImportRow::STATUS_IMPORTED => 0,
            CsvImportRow::STATUS_ERROR => 0,
        ];

        $rows = $this->createQueryBuilder('row')
            ->select('row.status status, COUNT(row.id) rowCount')
            ->andWhere('row.job = :job')
            ->setParameter('job', $job)
            ->groupBy('row.status')
            ->getQuery()
            ->getArrayResult();

        foreach ($rows as $row) {
            $status = (string) ($row['status'] ?? '');
            if (array_key_exists($status, $counts)) {
                $counts[$status] = (int) $row['rowCount'];
            }
        }

        return [
            'queued' => $counts[CsvImportRow::STATUS_QUEUED],
            'processing' => $counts[CsvImportRow::STATUS_PROCESSING],
            'imported' => $counts[CsvImportRow::STATUS_IMPORTED],
            'error' => $counts[CsvImportRow::STATUS_ERROR],
        ];
    }

    public function retryFailedRows(CsvImportJob $job): int
    {
        return $this->createQueryBuilder('row')
            ->update()
            ->set('row.status', ':queued')
            ->set('row.error', ':error')
            ->set('row.card', ':card')
            ->set('row.importedItemId', ':importedItemId')
            ->andWhere('row.job = :job')
            ->andWhere('row.status = :failed')
            ->setParameter('queued', CsvImportRow::STATUS_QUEUED)
            ->setParameter('error', null)
            ->setParameter('card', null)
            ->setParameter('importedItemId', null)
            ->setParameter('job', $job)
            ->setParameter('failed', CsvImportRow::STATUS_ERROR)
            ->getQuery()
            ->execute();
    }

    public function requeueProcessingRows(CsvImportJob $job): int
    {
        return $this->createQueryBuilder('row')
            ->update()
            ->set('row.status', ':queued')
            ->andWhere('row.job = :job')
            ->andWhere('row.status = :processing')
            ->setParameter('queued', CsvImportRow::STATUS_QUEUED)
            ->setParameter('job', $job)
            ->setParameter('processing', CsvImportRow::STATUS_PROCESSING)
            ->getQuery()
            ->execute();
    }
}
