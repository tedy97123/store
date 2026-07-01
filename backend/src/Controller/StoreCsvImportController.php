<?php

namespace App\Controller;

use App\Entity\CsvImportJob;
use App\Entity\CsvImportRow;
use App\Message\ProcessCsvImportMessage;
use App\Repository\CsvImportJobRepository;
use App\Repository\CsvImportRowRepository;
use App\Repository\StoreRepository;
use App\Service\CsvImport\CsvImportParser;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Messenger\MessageBusInterface;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/stores/{slug}/csv-imports')]
final class StoreCsvImportController extends AbstractController
{
    private const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

    /** @var list<string> */
    private const ALLOWED_MIME_TYPES = [
        'text/csv',
        'text/plain',
        'application/csv',
        'application/vnd.ms-excel',
        'application/octet-stream',
    ];

    public function __construct(
        private readonly StoreRepository $storeRepository,
        private readonly CsvImportJobRepository $jobRepository,
        private readonly CsvImportRowRepository $rowRepository,
        private readonly CsvImportParser $parser,
        private readonly EntityManagerInterface $entityManager,
        private readonly MessageBusInterface $messageBus,
    ) {
    }

    #[Route('', name: 'api_store_csv_import_create', methods: ['POST'])]
    #[IsGranted('ROLE_USER')]
    public function create(Request $request, string $slug): JsonResponse
    {
        $store = $this->storeRepository->findOneBySlug($slug);
        if (null === $store) {
            return $this->json(['detail' => 'Store not found.'], 404);
        }

        $this->denyAccessUnlessGranted('STORE_MANAGE', $store);

        $file = $request->files->get('file');
        if (!$file instanceof UploadedFile) {
            return $this->json(['detail' => 'A CSV file is required.'], 400);
        }

        // Validate the upload BEFORE reading it into memory.
        if (!$file->isValid()) {
            return $this->json(['detail' => 'The uploaded file is invalid or incomplete.'], 400);
        }

        $size = $file->getSize();
        if (null === $size || $size > self::MAX_UPLOAD_BYTES) {
            return $this->json(
                ['detail' => sprintf('CSV exceeds the maximum allowed size of %d MB.', self::MAX_UPLOAD_BYTES >> 20)],
                422,
            );
        }

        if (!$this->looksLikeCsv($file)) {
            return $this->json(['detail' => 'Only CSV files are accepted.'], 422);
        }

        $content = file_get_contents($file->getPathname());
        if (false === $content) {
            return $this->json(['detail' => 'Could not read the uploaded CSV.'], 400);
        }

        try {
            $parsed = $this->parser->parse($content);
        } catch (\InvalidArgumentException $e) {
            return $this->json(['detail' => $e->getMessage()], 422);
        }

        $job = new CsvImportJob();
        $job->setStore($store);
        $job->setOriginalFilename($file->getClientOriginalName() ?: 'import.csv');
        // The pipeline processes persisted DB rows, not an on-disk copy, so we no
        // longer write the file to disk (avoids orphaned-file risk). The column is
        // kept for backwards compatibility and records the source filename only.
        $job->setStoragePath('');
        $job->setTotalRows(count($parsed['rows']));
        $job->setProcessedRows(0);
        $job->setImportedRows(0);
        $job->setFailedRows(count(array_filter($parsed['rows'], static fn (array $row): bool => 'error' === ($row['status'] ?? ''))));

        $this->entityManager->persist($job);
        foreach ($parsed['rows'] as $rowData) {
            $this->entityManager->persist($this->createImportRow($job, $rowData));
        }
        $this->entityManager->flush();

        $this->messageBus->dispatch(new ProcessCsvImportMessage((int) $job->getId()));

        return $this->json($this->serializeJob($job, $request), 201);
    }

    #[Route('', name: 'api_store_csv_import_list', methods: ['GET'])]
    #[IsGranted('ROLE_USER')]
    public function list(string $slug): JsonResponse
    {
        $store = $this->storeRepository->findOneBySlug($slug);
        if (null === $store) {
            return $this->json(['detail' => 'Store not found.'], 404);
        }

        $this->denyAccessUnlessGranted('STORE_MANAGE', $store);

        return $this->json(array_map(
            $this->serializeJobSummary(...),
            $this->jobRepository->findRecentByStore($store),
        ));
    }

    #[Route('/current', name: 'api_store_csv_import_current', methods: ['GET'])]
    #[IsGranted('ROLE_USER')]
    public function current(Request $request, string $slug): JsonResponse
    {
        $store = $this->storeRepository->findOneBySlug($slug);
        if (null === $store) {
            return $this->json(['detail' => 'Store not found.'], 404);
        }

        $this->denyAccessUnlessGranted('STORE_MANAGE', $store);

        $job = $this->jobRepository->findLatestByStore($store);
        if (null === $job) {
            return $this->json(null);
        }

        return $this->json($this->serializeJob($job, $request));
    }

    #[Route('/{id}', name: 'api_store_csv_import_show', methods: ['GET'])]
    #[IsGranted('ROLE_USER')]
    public function show(Request $request, string $slug, int $id): JsonResponse
    {
        $store = $this->storeRepository->findOneBySlug($slug);
        if (null === $store) {
            return $this->json(['detail' => 'Store not found.'], 404);
        }

        $this->denyAccessUnlessGranted('STORE_MANAGE', $store);

        $job = $this->jobRepository->findOneByStoreAndId($store, $id);
        if (null === $job) {
            return $this->json(['detail' => 'Import job not found.'], 404);
        }

        return $this->json($this->serializeJob($job, $request));
    }

    #[Route('/{id}/pause', name: 'api_store_csv_import_pause', methods: ['POST'])]
    #[IsGranted('ROLE_USER')]
    public function pause(string $slug, int $id): JsonResponse
    {
        $job = $this->findManagedJob($slug, $id);
        if (!$job instanceof CsvImportJob) {
            return $this->json(['detail' => 'Import job not found.'], 404);
        }

        if (in_array($job->getStatus(), [CsvImportJob::STATUS_QUEUED, CsvImportJob::STATUS_PROCESSING], true)) {
            $job->setStatus(CsvImportJob::STATUS_PAUSED);
            $this->entityManager->flush();
        }

        return $this->json($this->serializeJobSummary($job));
    }

    #[Route('/{id}/resume', name: 'api_store_csv_import_resume', methods: ['POST'])]
    #[IsGranted('ROLE_USER')]
    public function resume(string $slug, int $id): JsonResponse
    {
        $job = $this->findManagedJob($slug, $id);
        if (!$job instanceof CsvImportJob) {
            return $this->json(['detail' => 'Import job not found.'], 404);
        }

        if ($this->isActivelyProcessing($job)) {
            return $this->json(['detail' => 'Import is currently processing. Pause it or wait for the running batch to finish before resuming.'], 409);
        }

        if (in_array($job->getStatus(), [CsvImportJob::STATUS_PAUSED, CsvImportJob::STATUS_PROCESSING, CsvImportJob::STATUS_FAILED], true)) {
            $this->requeueJob($job);
        }

        return $this->json($this->serializeJobSummary($job));
    }

    #[Route('/{id}/retry', name: 'api_store_csv_import_retry', methods: ['POST'])]
    #[IsGranted('ROLE_USER')]
    public function retry(string $slug, int $id): JsonResponse
    {
        $job = $this->findManagedJob($slug, $id);
        if (!$job instanceof CsvImportJob) {
            return $this->json(['detail' => 'Import job not found.'], 404);
        }

        if ($this->isActivelyProcessing($job)) {
            return $this->json(['detail' => 'Import is currently processing. Pause it or wait for the running batch to finish before retrying.'], 409);
        }

        if (in_array($job->getStatus(), [CsvImportJob::STATUS_FAILED, CsvImportJob::STATUS_PAUSED, CsvImportJob::STATUS_PROCESSING], true)) {
            $this->requeueJob($job);
        }

        return $this->json($this->serializeJobSummary($job));
    }

    #[Route('/{id}/retry-failed', name: 'api_store_csv_import_retry_failed', methods: ['POST'])]
    #[IsGranted('ROLE_USER')]
    public function retryFailed(string $slug, int $id): JsonResponse
    {
        $job = $this->findManagedJob($slug, $id);
        if (!$job instanceof CsvImportJob) {
            return $this->json(['detail' => 'Import job not found.'], 404);
        }

        if (CsvImportJob::STATUS_QUEUED === $job->getStatus() || $this->isActivelyProcessing($job)) {
            return $this->json(['detail' => 'Import is already running. Pause or wait for it to finish before retrying failed cards.'], 409);
        }

        $retriedRows = $this->rowRepository->retryFailedRows($job);

        if ($retriedRows > 0) {
            $job->setFailedRows(max(0, $job->getFailedRows() - $retriedRows));
            $job->setProcessedRows(max(0, $job->getProcessedRows() - $retriedRows));
            $this->requeueJob($job);
        }

        return $this->json($this->serializeJobSummary($job));
    }

    #[Route('/{id}/cancel', name: 'api_store_csv_import_cancel', methods: ['POST'])]
    #[IsGranted('ROLE_USER')]
    public function cancel(string $slug, int $id): JsonResponse
    {
        $job = $this->findManagedJob($slug, $id);
        if (!$job instanceof CsvImportJob) {
            return $this->json(['detail' => 'Import job not found.'], 404);
        }

        if (!in_array($job->getStatus(), [CsvImportJob::STATUS_COMPLETED, CsvImportJob::STATUS_FAILED, CsvImportJob::STATUS_CANCELLED], true)) {
            $job->setStatus(CsvImportJob::STATUS_CANCELLED);
            $job->setFinishedAt(new \DateTimeImmutable());
            $this->entityManager->flush();
        }

        return $this->json($this->serializeJobSummary($job));
    }

    /**
     * A job is genuinely processing when its status is PROCESSING and it still has
     * rows in the `processing` state (a handler is actively working the batch). In
     * that case requeue/resume/retry must be rejected with a 409 to avoid double work.
     */
    private function isActivelyProcessing(CsvImportJob $job): bool
    {
        if (CsvImportJob::STATUS_PROCESSING !== $job->getStatus()) {
            return false;
        }

        return $this->rowRepository->countByStatus($job)['processing'] > 0;
    }

    private function looksLikeCsv(UploadedFile $file): bool
    {
        $extension = strtolower((string) $file->getClientOriginalExtension());
        if ('' !== $extension && 'csv' !== $extension && 'txt' !== $extension) {
            return false;
        }

        // Do not call getMimeType() here: it requires Symfony MIME guessers such
        // as the PHP fileinfo extension, which may be disabled in local/dev
        // runtimes. The parser validates the actual CSV shape after this guard.
        $mime = (string) $file->getClientMimeType();

        return '' === $mime || in_array(strtolower($mime), self::ALLOWED_MIME_TYPES, true);
    }

    private function findManagedJob(string $slug, int $id): ?CsvImportJob
    {
        $store = $this->storeRepository->findOneBySlug($slug);
        if (null === $store) {
            return null;
        }

        $this->denyAccessUnlessGranted('STORE_MANAGE', $store);

        return $this->jobRepository->findOneByStoreAndId($store, $id);
    }

    private function serializeJobSummary(CsvImportJob $job): array
    {
        return [
            'id' => $job->getId(),
            'status' => $job->getStatus(),
            'originalFilename' => $job->getOriginalFilename(),
            'totalRows' => $job->getTotalRows(),
            'processedRows' => $job->getProcessedRows(),
            'importedRows' => $job->getImportedRows(),
            'failedRows' => $job->getFailedRows(),
            'errorMessage' => $job->getErrorMessage(),
            'createdAt' => $job->getCreatedAt()->format(DATE_ATOM),
            'updatedAt' => $job->getUpdatedAt()->format(DATE_ATOM),
            'startedAt' => $job->getStartedAt()?->format(DATE_ATOM),
            'finishedAt' => $job->getFinishedAt()?->format(DATE_ATOM),
        ];
    }

    private function requeueJob(CsvImportJob $job): void
    {
        $this->rowRepository->requeueProcessingRows($job);
        $job->setStatus(CsvImportJob::STATUS_QUEUED);
        $job->setErrorMessage(null);
        $job->setFinishedAt(null);
        $this->entityManager->flush();
        $this->messageBus->dispatch(new ProcessCsvImportMessage((int) $job->getId()));
    }

    private function serializeJob(CsvImportJob $job, Request $request): array
    {
        $rowStatus = (string) $request->query->get('rowStatus', '');
        if (!in_array($rowStatus, ['queued', 'processing', 'imported', 'error'], true)) {
            $rowStatus = '';
        }
        $rowLimit = min(250, max(25, $request->query->getInt('rowLimit', 75)));
        $requestedOffset = $request->query->getInt('rowOffset', -1);
        $totalRows = $job->getTotalRows();
        $processedRows = $job->getProcessedRows();
        $rowOffset = max(0, $requestedOffset);
        if ($requestedOffset < 0) {
            $rowOffset = max(0, min($processedRows, $totalRows) - 15);
        }

        $statusCounts = $this->rowRepository->countByStatus($job);
        if ('' !== $rowStatus && $requestedOffset < 0) {
            $rowOffset = 0;
        }
        $rows = $this->rowRepository->findWindow($job, $rowOffset, $rowLimit, '' !== $rowStatus ? $rowStatus : null);

        return [
            'id' => $job->getId(),
            'status' => $job->getStatus(),
            'originalFilename' => $job->getOriginalFilename(),
            'storagePath' => $job->getStoragePath(),
            'totalRows' => $job->getTotalRows(),
            'processedRows' => $job->getProcessedRows(),
            'importedRows' => $job->getImportedRows(),
            'failedRows' => $job->getFailedRows(),
            'queuedRows' => $statusCounts['queued'],
            'processingRows' => $statusCounts['processing'],
            'errorMessage' => $job->getErrorMessage(),
            'createdAt' => $job->getCreatedAt()->format(DATE_ATOM),
            'updatedAt' => $job->getUpdatedAt()->format(DATE_ATOM),
            'startedAt' => $job->getStartedAt()?->format(DATE_ATOM),
            'finishedAt' => $job->getFinishedAt()?->format(DATE_ATOM),
            'rowOffset' => $rowOffset,
            'rowLimit' => $rowLimit,
            'rows' => array_map($this->serializeRow(...), $rows),
        ];
    }

    /** @param array<string, mixed> $rowData */
    private function createImportRow(CsvImportJob $job, array $rowData): CsvImportRow
    {
        return (new CsvImportRow())
            ->setJob($job)
            ->setRowIndex((int) ($rowData['rowIndex'] ?? 0))
            ->setName($this->truncate((string) ($rowData['name'] ?? ''), 255))
            ->setGame($this->truncate((string) ($rowData['game'] ?? ''), 80))
            ->setSetCode($this->truncate((string) ($rowData['set'] ?? ''), 120))
            ->setCondition($this->truncate((string) ($rowData['condition'] ?? 'NM'), 16))
            ->setIsFoil((bool) ($rowData['isFoil'] ?? false))
            ->setRarity($this->truncate((string) ($rowData['rarity'] ?? ''), 80))
            ->setQuantity((int) ($rowData['quantity'] ?? 0))
            ->setVariant($this->truncate((string) ($rowData['variant'] ?? ''), 255))
            ->setCollectorNumber($this->truncate((string) ($rowData['collectorNumber'] ?? ''), 80))
            ->setStatus((string) ($rowData['status'] ?? CsvImportRow::STATUS_QUEUED))
            ->setCard(isset($rowData['card']) && is_array($rowData['card']) ? $rowData['card'] : null)
            ->setError(isset($rowData['error']) ? (string) $rowData['error'] : null)
            ->setImportedItemId(isset($rowData['importedItemId']) ? (int) $rowData['importedItemId'] : null);
    }

    private function truncate(string $value, int $maxLength): string
    {
        return strlen($value) > $maxLength ? substr($value, 0, $maxLength) : $value;
    }

    /** @return array<string, mixed> */
    private function serializeRow(CsvImportRow $row): array
    {
        return [
            'rowIndex' => $row->getRowIndex(),
            'name' => $row->getName(),
            'game' => $row->getGame(),
            'set' => $row->getSetCode(),
            'condition' => $row->getCondition(),
            'isFoil' => $row->isFoil(),
            'rarity' => $row->getRarity(),
            'quantity' => $row->getQuantity(),
            'variant' => $row->getVariant(),
            'collectorNumber' => $row->getCollectorNumber(),
            'status' => $row->getStatus(),
            'card' => $row->getCard(),
            'error' => $row->getError(),
            'importedItemId' => $row->getImportedItemId(),
        ];
    }
}
