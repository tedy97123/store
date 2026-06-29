<?php

namespace App\Service\Scryfall;

use App\Entity\Card;
use App\Repository\CardRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\HttpClient\HttpClientInterface;

class ScryfallClient
{
    private const BULK_DATA_URL = 'https://api.scryfall.com/bulk-data';
    private const SEARCH_URL = 'https://api.scryfall.com/cards/search';

    public function __construct(
        private readonly HttpClientInterface $httpClient,
        private readonly EntityManagerInterface $entityManager,
        private readonly CardRepository $cardRepository,
    ) {
    }

    /** @return array{download_uri: string, updated_at: string} */
    public function getOracleCardsBulkInfo(): array
    {
        $response = $this->httpClient->request('GET', self::BULK_DATA_URL, [
            'headers' => ['User-Agent' => 'MTGStore/1.0'],
        ]);

        $payload = $response->toArray();
        foreach ($payload['data'] as $item) {
            if (($item['type'] ?? '') === 'oracle_cards') {
                return [
                    'download_uri' => $item['download_uri'],
                    'updated_at' => $item['updated_at'],
                ];
            }
        }

        throw new \RuntimeException('oracle_cards bulk data not found.');
    }

    /**
     * @param callable(int, int, int): void|null $onProgress
     *
     * @return array{inserted: int, updated: int, total: int}
     */
    public function syncOracleCards(?callable $onProgress = null): array
    {
        $info = $this->getOracleCardsBulkInfo();
        $response = $this->httpClient->request('GET', $info['download_uri'], [
            'headers' => ['User-Agent' => 'MTGStore/1.0'],
        ]);

        $content = $response->getContent();
        /** @var list<array<string, mixed>> $cards */
        $cards = json_decode($content, true, flags: JSON_THROW_ON_ERROR);

        $inserted = 0;
        $updated = 0;
        $batchSize = 500;
        $total = count($cards);

        foreach (array_chunk($cards, $batchSize) as $chunkIndex => $chunk) {
            foreach ($chunk as $cardData) {
                $result = $this->upsertFromScryfallData($cardData);
                if ($result === 'inserted') {
                    ++$inserted;
                } elseif ($result === 'updated') {
                    ++$updated;
                }
            }

            $this->entityManager->flush();
            $this->entityManager->clear();

            if (null !== $onProgress) {
                $processed = min(($chunkIndex + 1) * $batchSize, $total);
                $onProgress($processed, $total, $inserted + $updated);
            }
        }

        return ['inserted' => $inserted, 'updated' => $updated, 'total' => $total];
    }

    /** @return list<Card> */
    public function searchRemoteAndUpsert(string $query, int $limit = 20): array
    {
        $response = $this->httpClient->request('GET', self::SEARCH_URL, [
            'headers' => ['User-Agent' => 'MTGStore/1.0'],
            'query' => ['q' => $query, 'unique' => 'cards'],
        ]);

        if (404 === $response->getStatusCode()) {
            return [];
        }

        $payload = $response->toArray();
        $cards = [];
        foreach (array_slice($payload['data'] ?? [], 0, $limit) as $cardData) {
            $this->upsertFromScryfallData($cardData);
            $id = Uuid::fromString($cardData['id']);
            $card = $this->cardRepository->find($id);
            if ($card instanceof Card) {
                $cards[] = $card;
            }
        }

        $this->entityManager->flush();

        return $cards;
    }

    /** @param array<string, mixed> $data */
    private function upsertFromScryfallData(array $data): string
    {
        if (!isset($data['id'], $data['oracle_id'], $data['name'])) {
            return 'skipped';
        }

        $id = Uuid::fromString($data['id']);
        $existing = $this->cardRepository->find($id);
        $card = $existing ?? new Card($id);
        $isNew = null === $existing;

        $card
            ->setOracleId(Uuid::fromString($data['oracle_id']))
            ->setName((string) $data['name'])
            ->setSetCode((string) ($data['set'] ?? ''))
            ->setCollectorNumber((string) ($data['collector_number'] ?? ''))
            ->setRarity(isset($data['rarity']) ? (string) $data['rarity'] : null)
            ->setManaCost(isset($data['mana_cost']) ? (string) $data['mana_cost'] : null)
            ->setTypeLine(isset($data['type_line']) ? (string) $data['type_line'] : null)
            ->setOracleText(isset($data['oracle_text']) ? (string) $data['oracle_text'] : null)
            ->setCmc(isset($data['cmc']) ? (float) $data['cmc'] : null)
            ->setImageUris(isset($data['image_uris']) && is_array($data['image_uris']) ? $data['image_uris'] : null)
            ->setPrices(isset($data['prices']) && is_array($data['prices']) ? $data['prices'] : null)
            ->setScryfallUpdatedAt(isset($data['updated_at']) ? new \DateTimeImmutable((string) $data['updated_at']) : null);

        if ($isNew) {
            $this->entityManager->persist($card);

            return 'inserted';
        }

        return 'updated';
    }
}
