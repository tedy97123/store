<?php

namespace App\Controller;

use App\Repository\CardRepository;
use App\Service\Scryfall\ScryfallClient;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/catalog')]
class CardSearchController extends AbstractController
{
    public function __construct(
        private readonly CardRepository $cardRepository,
        private readonly ScryfallClient $scryfallClient,
    ) {
    }

    #[Route('/search', name: 'api_catalog_search', methods: ['GET'])]
    #[IsGranted('ROLE_USER')]
    public function search(Request $request): JsonResponse
    {
        $query = trim((string) $request->query->get('q', ''));
        if ('' === $query) {
            return $this->json([]);
        }

        $local = $this->cardRepository->searchByName($query, 20);
        if (count($local) >= 5) {
            return $this->json(array_map($this->serializeCard(...), $local));
        }

        $remote = $this->scryfallClient->searchRemoteAndUpsert($query, 20);
        $merged = [];
        foreach (array_merge($local, $remote) as $card) {
            $merged[(string) $card->getId()] = $card;
        }

        return $this->json(array_map($this->serializeCard(...), array_values($merged)));
    }

    private function serializeCard(\App\Entity\Card $card): array
    {
        return [
            'id' => (string) $card->getId(),
            'oracleId' => (string) $card->getOracleId(),
            'name' => $card->getName(),
            'setCode' => $card->getSetCode(),
            'collectorNumber' => $card->getCollectorNumber(),
            'rarity' => $card->getRarity(),
            'manaCost' => $card->getManaCost(),
            'typeLine' => $card->getTypeLine(),
            'imageUrl' => $card->getImageUrl(),
        ];
    }
}
