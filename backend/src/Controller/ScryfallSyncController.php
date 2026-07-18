<?php

namespace App\Controller;

use App\Service\Scryfall\ScryfallClient;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/admin/scryfall')]
class ScryfallSyncController extends AbstractController
{
    public function __construct(
        private readonly ScryfallClient $scryfallClient,
    ) {
    }

    /**
     * Synchronous bulk sync. Defaults to the smaller `oracle_cards` dataset
     * so the request stays within HTTP timeout territory; the full
     * `default_cards` (all printings) sync should run via the CLI/cron:
     * `php bin/console app:scryfall:sync` (streams, safe to run long).
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

        $result = $this->scryfallClient->syncBulkCards(null, $type);

        return $this->json([
            'status' => 'completed',
            'type' => $type,
            'inserted' => $result['inserted'],
            'updated' => $result['updated'],
            'total' => $result['total'],
        ]);
    }
}
