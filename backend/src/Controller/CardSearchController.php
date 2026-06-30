<?php

namespace App\Controller;

use App\Repository\CardRepository;
use App\Service\Catalog\CatalogCardResolver;
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
        private readonly CatalogCardResolver $catalogCardResolver,
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

        $setCode = strtolower(trim((string) $request->query->get('set', '')));
        $collectorNumber = strtolower(trim((string) $request->query->get('collectorNumber', '')));
        $rarity = strtolower(trim((string) $request->query->get('rarity', '')));
        $finish = strtolower(trim((string) $request->query->get('finish', '')));
        if (!in_array($finish, ['foil', 'nonfoil'], true)) {
            $finish = '';
        }

        $local = array_filter(
            $this->cardRepository->searchByName($query, 60),
            fn (\App\Entity\Card $card): bool => $this->catalogCardResolver->matchesFilters($card, $setCode, $collectorNumber, $rarity, $finish),
        );
        $remote = $this->scryfallClient->searchRemoteAndUpsert(
            $query,
            40,
            '' !== $setCode ? $setCode : null,
            '' !== $finish ? $finish : null,
        );
        $merged = [];
        foreach (array_merge($local, $remote) as $card) {
            if ($this->catalogCardResolver->matchesFilters($card, $setCode, $collectorNumber, $rarity, $finish)) {
                $merged[(string) $card->getId()] = $card;
            }
        }

        return $this->json(array_map(
            $this->catalogCardResolver->serializeCard(...),
            array_slice(array_values($merged), 0, 40),
        ));
    }

    #[Route('/resolve-batch', name: 'api_catalog_resolve_batch', methods: ['POST'])]
    #[IsGranted('ROLE_USER')]
    public function resolveBatch(Request $request): JsonResponse
    {
        /** @var array{rows?: list<array<string, mixed>>} $payload */
        $payload = json_decode($request->getContent(), true) ?? [];
        $rows = is_array($payload['rows'] ?? null) ? $payload['rows'] : [];
        $results = [];

        foreach ($rows as $row) {
            $rowIndex = (int) ($row['rowIndex'] ?? count($results));
            $name = trim((string) ($row['name'] ?? ''));
            $setCode = trim((string) ($row['set'] ?? ''));
            $collectorNumber = trim((string) ($row['collectorNumber'] ?? ''));
            $rarity = trim((string) ($row['rarity'] ?? ''));
            $finish = ((bool) ($row['foil'] ?? false)) ? 'foil' : 'nonfoil';

            if ('' === $name || '' === $setCode) {
                $results[] = [
                    'rowIndex' => $rowIndex,
                    'error' => 'Name and set are required for MTGJSON matching.',
                ];
                continue;
            }

            $resolution = $this->catalogCardResolver->resolve($name, $setCode, $collectorNumber, $rarity, $finish);
            if ($resolution->isResolved() && $resolution->card instanceof \App\Entity\Card) {
                $results[] = [
                    'rowIndex' => $rowIndex,
                    'card' => $this->catalogCardResolver->serializeCard($resolution->card),
                ];
                continue;
            }
            $results[] = [
                'rowIndex' => $rowIndex,
                'error' => $resolution->error ?? 'No matching MTGJSON or Scryfall printing found.',
            ];
        }

        return $this->json(['results' => $results]);
    }
}
