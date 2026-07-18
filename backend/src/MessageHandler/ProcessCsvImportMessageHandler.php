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
use App\Service\Scryfall\ScryfallClient;
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
        private ScryfallClient $scryfallClient,
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

            // Resolve the whole batch up front: local natural-key matches first,
            // then ONE Scryfall collection call (75 identifiers per request) for
            // the misses — instead of a rate-limited search round-trip per row.
            $preResolved = $this->preResolveRows($rows);

            /** @var list<array{CsvImportRow, \App\Entity\InventoryItem}> $pendingItemLinks */
            $pendingItemLinks = [];

            foreach ($rows as $row) {
                // Rows are already marked PROCESSING by claimNextQueued().
                $row->setError(null);
                $card = $preResolved[spl_object_id($row)] ?? null;

                if (!$card instanceof Card) {
                    // Slow path for rows the batch couldn't place: full resolver
                    // (local → Scryfall search → MTGJSON) with its error detail.
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

                    $card = $resolution->card;
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
                    $card,
                    $quantity,
                    $condition,
                    $row->isFoil(),
                    '' !== $notes ? $notes : null,
                    false,
                );

                $row->setStatus(CsvImportRow::STATUS_IMPORTED);
                $row->setCard($this->serializeImportCard($card));
                $row->setImportedItemId($item->getId());
                if (null === $item->getId()) {
                    // Freshly created items have no id until the batch flush;
                    // link them afterwards so the row always references its item.
                    $pendingItemLinks[] = [$row, $item];
                }
            }

            $this->flushBatchAndQueueNext($job, $pendingItemLinks);
        } catch (\Throwable $e) {
            $this->markJobFailed($message->jobId, $e);
        }
    }

    /**
     * Batch card resolution for a claimed set of rows.
     *
     * Phase 1 matches each row against the local catalog by natural key
     * (indexed set + collector number). Phase 2 sends all remaining rows to
     * Scryfall's collection endpoint in chunks of 75 identifiers — turning
     * up to N rate-limited searches into ceil(N/75) requests. Anything still
     * unmatched falls through to the caller's per-row resolver.
     *
     * @param list<CsvImportRow> $rows
     *
     * @return array<int, Card> keyed by spl_object_id() of the row
     */
    private function preResolveRows(array $rows): array
    {
        $resolved = [];
        $missing = [];

        foreach ($rows as $row) {
            $finish = $row->isFoil() ? 'foil' : 'nonfoil';
            $card = $this->catalogCardResolver->matchLocal(
                $row->getName(),
                $row->getSetCode(),
                $row->getCollectorNumber(),
                $row->getRarity(),
                $finish,
            );

            if ($card instanceof Card) {
                $resolved[spl_object_id($row)] = $card;
                continue;
            }

            if ('' !== trim($row->getSetCode()) && '' !== trim($row->getCollectorNumber())) {
                $missing[] = $row;
            }
        }

        if ([] === $missing) {
            return $resolved;
        }

        try {
            $fetched = $this->scryfallClient->fetchCollectionBySetCollectors(array_map(
                static fn (CsvImportRow $row): array => [
                    'set' => $row->getSetCode(),
                    'collectorNumber' => $row->getCollectorNumber(),
                ],
                $missing,
            ));
        } catch (\Throwable) {
            // Batch fetch is an optimisation; rows fall back to per-row resolution.
            return $resolved;
        }

        foreach ($missing as $row) {
            $card = $fetched[ScryfallClient::collectionKey($row->getSetCode(), $row->getCollectorNumber())] ?? null;
            if ($card instanceof Card && $this->catalogCardResolver->isAcceptableMatch(
                $card,
                $row->getName(),
                $row->getSetCode(),
                $row->getCollectorNumber(),
                $row->getRarity(),
                $row->isFoil() ? 'foil' : 'nonfoil',
            )) {
                $resolved[spl_object_id($row)] = $card;
            }
        }

        return $resolved;
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

    /** @param list<array{CsvImportRow, \App\Entity\InventoryItem}> $pendingItemLinks */
    private function flushBatchAndQueueNext(CsvImportJob $job, array $pendingItemLinks = []): void
    {
        $this->syncCounters($job);
        $this->entityManager->flush();

        // Newly created inventory items received their ids in the flush above;
        // backfill the imported_item_id on rows that pointed at them.
        $linked = false;
        foreach ($pendingItemLinks as [$row, $item]) {
            if (null !== $item->getId() && $row->getImportedItemId() !== $item->getId()) {
                $row->setImportedItemId($item->getId());
                $linked = true;
            }
        }
        if ($linked) {
            $this->entityManager->flush();
        }

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
        $job->setErrorMessage($this->formatFailureMessage($e));
        $job->setFinishedAt(new \DateTimeImmutable());
        $manager->flush();
    }

    private function formatFailureMessage(\Throwable $e): string
    {
        $message = $e->getMessage();
        if (strlen($message) <= 250) {
            return $message;
        }

        return substr($message, 0, 247).'...';
    }
}
