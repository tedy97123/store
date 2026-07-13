<?php

namespace App\Controller;

use App\Entity\Store;
use App\Repository\StoreRepository;
use App\Service\Store\StoreApplicationMailer;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * Platform-admin review of self-serve store applications. Approving flips the
 * store live (status=approved, isActive=true); rejecting records a reason and
 * keeps the storefront dark.
 */
#[Route('/api/admin')]
#[IsGranted('ROLE_SUPER_ADMIN')]
class StoreApprovalController extends AbstractController
{
    public function __construct(
        private readonly StoreRepository $storeRepository,
        private readonly EntityManagerInterface $entityManager,
        private readonly StoreApplicationMailer $mailer,
        private readonly LoggerInterface $logger,
    ) {
    }

    #[Route('/stores/{id}/approve', name: 'api_admin_store_approve', methods: ['POST'])]
    public function approve(int $id): JsonResponse
    {
        $store = $this->storeRepository->find($id);
        if (!$store instanceof Store) {
            return $this->json(['error' => 'Store not found.'], Response::HTTP_NOT_FOUND);
        }

        $store->setStatus(Store::STATUS_APPROVED)
            ->setIsActive(true)
            ->setRejectionReason(null);

        $this->entityManager->flush();

        // Notify the owner — but never let a mail failure fail the approval.
        try {
            $this->mailer->sendApproved($store);
        } catch (\Throwable $e) {
            $this->logger->error('Failed to send store approval email.', ['store' => $store->getId(), 'error' => $e->getMessage()]);
        }

        return $this->json($this->serialize($store));
    }

    #[Route('/stores/{id}/reject', name: 'api_admin_store_reject', methods: ['POST'])]
    public function reject(int $id, Request $request): JsonResponse
    {
        $store = $this->storeRepository->find($id);
        if (!$store instanceof Store) {
            return $this->json(['error' => 'Store not found.'], Response::HTTP_NOT_FOUND);
        }

        /** @var array<string, mixed> $payload */
        $payload = json_decode($request->getContent(), true) ?? [];
        $reason = trim((string) ($payload['reason'] ?? ''));

        $store->setStatus(Store::STATUS_REJECTED)
            ->setIsActive(false)
            ->setRejectionReason('' !== $reason ? $reason : null);

        $this->entityManager->flush();

        try {
            $this->mailer->sendRejected($store, '' !== $reason ? $reason : null);
        } catch (\Throwable $e) {
            $this->logger->error('Failed to send store rejection email.', ['store' => $store->getId(), 'error' => $e->getMessage()]);
        }

        return $this->json($this->serialize($store));
    }

    /** @return array<string, mixed> */
    private function serialize(Store $store): array
    {
        return [
            'id' => $store->getId(),
            'name' => $store->getName(),
            'slug' => $store->getSlug(),
            'status' => $store->getStatus(),
            'isActive' => $store->isActive(),
            'rejectionReason' => $store->getRejectionReason(),
        ];
    }
}
