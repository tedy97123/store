<?php

namespace App\Controller;

use App\Service\Scryfall\ScryfallClient;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/admin/scryfall')]
class ScryfallSyncController extends AbstractController
{
    public function __construct(
        private readonly ScryfallClient $scryfallClient,
    ) {
    }

    #[Route('/sync', name: 'api_admin_scryfall_sync', methods: ['POST'])]
    #[IsGranted('ROLE_SUPER_ADMIN')]
    public function sync(): JsonResponse
    {
        $result = $this->scryfallClient->syncOracleCards();

        return $this->json([
            'status' => 'completed',
            'inserted' => $result['inserted'],
            'updated' => $result['updated'],
            'total' => $result['total'],
        ]);
    }
}
