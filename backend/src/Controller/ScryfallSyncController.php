<?php

namespace App\Controller;

use App\Message\SyncScryfallCatalogMessage;
use App\Service\Scryfall\ScryfallClient;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Messenger\MessageBusInterface;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/admin/scryfall')]
class ScryfallSyncController extends AbstractController
{
    public function __construct(
        private readonly MessageBusInterface $messageBus,
    ) {
    }

    /**
     * Queues a bulk sync on the messenger worker and returns 202. Even the
     * small `oracle_cards` dataset takes minutes of download + upsert —
     * running it inline pinned a PHP worker past typical proxy timeouts,
     * and `default_cards` (every printing) runs far longer. Progress is
     * visible in the worker logs; the CLI (`app:scryfall:sync`) remains the
     * interactive option.
     */
    #[Route('/sync', name: 'api_admin_scryfall_sync', methods: ['POST'])]
    #[IsGranted('ROLE_SUPER_ADMIN')]
    public function sync(Request $request): JsonResponse
    {
        $payload = json_decode($request->getContent(), true);
        $type = is_array($payload) && is_string($payload['type'] ?? null)
            ? $payload['type']
            : ScryfallClient::BULK_TYPE_ORACLE;

        if (!in_array($type, ScryfallClient::BULK_TYPES, true)) {
            return $this->json([
                'error' => sprintf('Unknown bulk type "%s". Valid types: %s.', $type, implode(', ', ScryfallClient::BULK_TYPES)),
            ], 400);
        }

        $this->messageBus->dispatch(new SyncScryfallCatalogMessage($type));

        return $this->json([
            'status' => 'queued',
            'type' => $type,
        ], 202);
    }
}
