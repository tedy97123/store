<?php

namespace App\MessageHandler;

use App\Entity\Card;
use App\Entity\CsvImportJob;
use App\Entity\CsvImportRow;
use App\Enum\CardCondition;
use App\Message\ProcessCsvImportMessage;
use App\Repository\CsvImportJobRepository;
use App\Repository\CsvImportRowRepository;
use App\Service\Catalog\CatalogCardResolver;
use App\Service\Inventory\StoreInventoryWriter;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;
use Symfony\Component\Messenger\MessageBusInterface;

#[AsMessageHandler]
final readonly class ProcessCsvImportMessageHandler
{
    public function __construct(
        private CsvImportJobRepository $jobRepository,
        private CsvImportRowRepository $rowRepository,
        private CatalogCardResolver $catalogCardResolver,
        private StoreInventoryWriter $inventoryWriter,
        private EntityManagerInterface $entityManager,
        private ManagerRegistry $managerRegistry,
        private MessageBusInterface $messageBus,
    ) {
    }

    public function __invoke(ProcessCsvImportMessage $message): void
    {
        $job = $this->jobRepository->find($message->jobId);
        if (!$job instanceof CsvImportJob) {
            return;
        }

        if (in_array($job->getStatus(), [CsvImportJob::STATUS_COMPLETED, CsvImportJob::STATUS_PAUSED, CsvImportJob::STATUS_CANCELLED], true)) {
            return;
        }

        $store = $job->getStore();
        if (null === $store) {
            $job->setStatus(CsvImportJob::STATUS_FAILED);
            $job->setErrorMessage('Store not found.');
            $job->setFinishedAt(new \DateTimeImmutable());
            $this->entityManager->flush();
            return;
        }

        try {
            $job->setStatus(CsvImportJob::STATUS_PROCESSING);
            if (null === $job->getStartedAt()) {
                $job->setStartedAt(new \DateTimeImmutable());
            }
            $this->syncCounters($job);
            $this->entityManager->flush();

            $batchSize = 25;
            // Atomically claim the next batch so concurrent handlers never collide.
            $rows = $this->rowRepository->claimNextQueued($job, $batchSize);
            if ([] === $rows) {
                $this->completeJob($job);
                return;
            }

            foreach ($rows as $row) {
                // Rows are already marked PROCESSING by claimNextQueued().
                $row->setError(null);
                $resolution = $this->catalogCardResolver->resolve(
                    $row->getName(),
                    $row->getSetCode(),
                    $row->getCollectorNumber(),
                    $row->getRarity(),
                    $row->isFoil() ? 'foil' : 'nonfoil',
                );

                if (!$resolution->isResolved() || !$resolution->card instanceof Card) {
                    $row->setStatus(CsvImportRow::STATUS_ERROR);
                    $row->setError($resolution->error ?? 'No matching MTGJSON or Scryfall printing found.');
                    continue;
                }

                $notes = [
                    '' !== $row->getGame() ? 'Game: '.$row->getGame() : '',
                    '' !== $row->getVariant() ? 'Variant: '.$row->getVariant() : '',
                ];
                $notes = implode("\n", array_values(array_filter($notes)));
                $condition = CardCondition::tryFrom($row->getCondition()) ?? CardCondition::NM;
                $quantity = max(0, $row->getQuantity());

                $item = $this->inventoryWriter->write(
                    $store,
                    $resolution->card,
                    $quantity,
                    $condition,
                    $row->isFoil(),
                    '' !== $notes ? $notes : null,
                    false,
                );

                $row->setStatus(CsvImportRow::STATUS_IMPORTED);
                $row->setCard($this->serializeImportCard($resolution->card));
                $row->setImportedItemId($item->getId());
            }

            $this->flushBatchAndQueueNext($job);
        } catch (\Throwable $e) {
            $this->markJobFailed($message->jobId, $e);
        }
    }

    /** @return array<string, mixed> */
    private function serializeImportCard(Card $card): array
    {
        return [
            'id' => (string) $card->getId(),
            'oracleId' => (string) $card->getOracleId(),
            'name' => $card->getName(),
            'setCode' => $card->getSetCode(),
            'collectorNumber' => $card->getCollectorNumber(),
            'rarity' => $card->getRarity(),
            'imageUrl' => $card->getImageUrl(),
            'imageUris' => $card->getImageUris(),
            'prices' => $card->getPrices(),
        ];
    }

    private function flushBatchAndQueueNext(CsvImportJob $job): void
    {
        $this->syncCounters($job);
        $this->entityManager->flush();
        $this->entityManager->refresh($job);

        if (CsvImportJob::STATUS_PROCESSING !== $job->getStatus()) {
            return;
        }

        if ($this->rowRepository->countByStatus($job)['queued'] > 0) {
            $this->messageBus->dispatch(new ProcessCsvImportMessage((int) $job->getId()));
            return;
        }

        $this->completeJob($job);
    }

    /**
     * Marks the job completed only when no rows remain queued or processing.
     * Rows still stuck in PROCESSING (e.g. a crashed/abandoned handler) are
     * requeued and processing continues instead of declaring a false completion.
     */
    private function completeJob(CsvImportJob $job): void
    {
        $counts = $this->rowRepository->countByStatus($job);

        if ($counts['processing'] > 0) {
            $this->rowRepository->requeueProcessingRows($job);
            $this->syncCounters($job);
            $this->entityManager->flush();
            $this->messageBus->dispatch(new ProcessCsvImportMessage((int) $job->getId()));
            return;
        }

        if ($counts['queued'] > 0) {
            $this->syncCounters($job);
            $this->entityManager->flush();
            $this->messageBus->dispatch(new ProcessCsvImportMessage((int) $job->getId()));
            return;
        }

        $this->syncCounters($job);
        $job->setStatus(CsvImportJob::STATUS_COMPLETED);
        $job->setFinishedAt(new \DateTimeImmutable());
        $this->entityManager->flush();
    }

    private function syncCounters(CsvImportJob $job): void
    {
        $counts = $this->rowRepository->countByStatus($job);
        $job->setImportedRows($counts['imported']);
        $job->setFailedRows($counts['error']);
        $job->setProcessedRows($counts['imported'] + $counts['error']);
    }

    private function markJobFailed(int $jobId, \Throwable $e): void
    {
        $manager = $this->entityManager->isOpen()
            ? $this->entityManager
            : $this->managerRegistry->resetManager();

        $job = $manager->getRepository(CsvImportJob::class)->find($jobId);
        if (!$job instanceof CsvImportJob) {
            return;
        }

        $job->setStatus(CsvImportJob::STATUS_FAILED);
        $job->setErrorMessage($e->getMessage());
        $job->setFinishedAt(new \DateTimeImmutable());
        $manager->flush();
    }
}
