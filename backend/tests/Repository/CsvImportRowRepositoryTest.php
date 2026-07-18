<?php

namespace App\Tests\Repository;

use App\Entity\CsvImportJob;
use App\Entity\CsvImportRow;
use App\Repository\CsvImportRowRepository;
use App\Tests\Support\CatalogFixtures;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;

/**
 * Row claiming + requeue is the heart of the import concurrency model. The
 * stale-claim cutoff is what lets job completion recover a crashed handler's
 * abandoned rows WITHOUT stealing a live handler's in-flight rows (which would
 * double-import). These tests pin that distinction and the claim stamping.
 */
final class CsvImportRowRepositoryTest extends KernelTestCase
{
    private EntityManagerInterface $em;
    private CsvImportRowRepository $rows;

    protected function setUp(): void
    {
        self::bootKernel();
        $c = self::getContainer();
        $this->em = $c->get('doctrine')->getManager();
        $this->rows = $c->get(CsvImportRowRepository::class);
    }

    private function jobWithQueuedRows(int $count): CsvImportJob
    {
        $store = (new CatalogFixtures($this->em))->store();
        $job = new CsvImportJob();
        $job->setStore($store);
        $job->setStatus(CsvImportJob::STATUS_QUEUED);
        $job->setOriginalFilename('t.csv');
        $job->setStoragePath('');
        $job->setTotalRows($count);
        $this->em->persist($job);

        for ($i = 0; $i < $count; ++$i) {
            $row = new CsvImportRow();
            $row->setJob($job);
            $row->setRowIndex($i);
            $row->setName('Card '.$i);
            $row->setSetCode('tst');
            $row->setCollectorNumber((string) $i);
            $row->setQuantity(1);
            $row->setStatus(CsvImportRow::STATUS_QUEUED);
            $this->em->persist($row);
        }
        $this->em->flush();

        return $job;
    }

    public function testClaimMarksRowsProcessingAndStampsClaimedAt(): void
    {
        $job = $this->jobWithQueuedRows(5);

        $claimed = $this->rows->claimNextQueued($job, 3);

        self::assertCount(3, $claimed);
        foreach ($claimed as $row) {
            self::assertSame(CsvImportRow::STATUS_PROCESSING, $row->getStatus());
            self::assertNotNull($row->getClaimedAt());
        }
        self::assertSame(2, $this->rows->countByStatus($job)['queued']);
    }

    public function testSecondClaimSkipsAlreadyClaimedRows(): void
    {
        $job = $this->jobWithQueuedRows(5);

        $first = $this->rows->claimNextQueued($job, 3);
        $second = $this->rows->claimNextQueued($job, 3);

        // No row is handed out twice.
        $ids = array_map(static fn (CsvImportRow $r): int => $r->getId(), array_merge($first, $second));
        self::assertCount(\count($ids), array_unique($ids));
        self::assertCount(2, $second);
    }

    public function testRequeueWithCutoffOnlyTakesStaleClaims(): void
    {
        $job = $this->jobWithQueuedRows(2);
        $claimed = $this->rows->claimNextQueued($job, 2);
        [$fresh, $stale] = $claimed;

        // Backdate one claim past the cutoff (simulating a crashed handler).
        $this->em->getConnection()->executeStatement(
            "UPDATE csv_import_rows SET claimed_at = NOW() - INTERVAL '20 minutes' WHERE id = ?",
            [$stale->getId()],
        );

        $requeued = $this->rows->requeueProcessingRows($job, new \DateTimeImmutable('-10 minutes'));

        self::assertSame(1, $requeued);
        $this->em->refresh($fresh);
        $this->em->refresh($stale);
        self::assertSame(CsvImportRow::STATUS_PROCESSING, $fresh->getStatus(), 'live row must not be requeued');
        self::assertSame(CsvImportRow::STATUS_QUEUED, $stale->getStatus(), 'stale row must be requeued');
        self::assertNull($stale->getClaimedAt(), 'requeue clears the claim stamp');
    }

    public function testRequeueWithoutCutoffTakesAllProcessing(): void
    {
        $job = $this->jobWithQueuedRows(3);
        $this->rows->claimNextQueued($job, 3);

        self::assertSame(3, $this->rows->requeueProcessingRows($job));
        self::assertSame(3, $this->rows->countByStatus($job)['queued']);
    }
}
