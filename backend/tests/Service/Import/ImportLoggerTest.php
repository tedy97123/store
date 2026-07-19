<?php

namespace App\Tests\Service\Import;

use App\Entity\CsvImportJob;
use App\Service\Import\ImportLogger;
use App\Tests\Support\CatalogFixtures;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;

/**
 * Each import run writes its own dedicated JSONL log file, so an operator can
 * open exactly that run's timeline.
 */
final class ImportLoggerTest extends KernelTestCase
{
    private EntityManagerInterface $em;
    private ImportLogger $importLogger;
    /** @var list<string> */
    private array $createdFiles = [];

    protected function setUp(): void
    {
        self::bootKernel();
        $c = self::getContainer();
        $this->em = $c->get('doctrine')->getManager();
        $this->importLogger = $c->get(ImportLogger::class);
    }

    protected function tearDown(): void
    {
        foreach ($this->createdFiles as $file) {
            @unlink($file);
        }
        parent::tearDown();
    }

    private function job(): CsvImportJob
    {
        $store = (new CatalogFixtures($this->em))->store();
        $job = new CsvImportJob();
        $job->setStore($store);
        $job->setStatus(CsvImportJob::STATUS_PROCESSING);
        $job->setOriginalFilename('t.csv');
        $job->setStoragePath('');
        $job->setTotalRows(1);
        $this->em->persist($job);
        $this->em->flush();

        return $job;
    }

    public function testWritesOneJsonLinePerEventToTheJobFile(): void
    {
        $job = $this->job();
        $path = $this->importLogger->pathFor((int) $job->getId());
        $this->createdFiles[] = $path;

        $this->importLogger->log($job, 'batch_claimed', ['rows' => 25]);
        $this->importLogger->log($job, 'row_failed', ['rowIndex' => 3, 'error' => 'no match'], 'warning');

        self::assertFileExists($path);
        $lines = array_values(array_filter(explode("\n", file_get_contents($path))));
        self::assertCount(2, $lines);

        $first = json_decode($lines[0], true);
        self::assertSame('batch_claimed', $first['event']);
        self::assertSame((int) $job->getId(), $first['jobId']);
        self::assertSame($job->getStore()->getSlug(), $first['store']);
        self::assertSame(25, $first['rows']);
        self::assertSame('info', $first['level']);

        $second = json_decode($lines[1], true);
        self::assertSame('row_failed', $second['event']);
        self::assertSame('warning', $second['level']);
        self::assertSame('no match', $second['error']);
    }

    public function testDifferentJobsWriteToDifferentFiles(): void
    {
        $jobA = $this->job();
        $jobB = $this->job();
        $this->createdFiles[] = $this->importLogger->pathFor((int) $jobA->getId());
        $this->createdFiles[] = $this->importLogger->pathFor((int) $jobB->getId());

        $this->importLogger->log($jobA, 'completed', ['imported' => 5]);
        $this->importLogger->log($jobB, 'completed', ['imported' => 9]);

        self::assertNotSame(
            $this->importLogger->pathFor((int) $jobA->getId()),
            $this->importLogger->pathFor((int) $jobB->getId()),
        );
        self::assertStringContainsString('"imported":5', file_get_contents($this->importLogger->pathFor((int) $jobA->getId())));
        self::assertStringContainsString('"imported":9', file_get_contents($this->importLogger->pathFor((int) $jobB->getId())));
    }
}
