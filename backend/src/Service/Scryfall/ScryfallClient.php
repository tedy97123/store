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
    private const CARD_URL = 'https://api.scryfall.com/cards/';
    private const COLLECTION_URL = 'https://api.scryfall.com/cards/collection';
    private const MIN_REQUEST_INTERVAL_MICROSECONDS = 125000;

    private static int $lastRequestAt = 0;

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

        if (200 !== $response->getStatusCode()) {
            throw new \RuntimeException(sprintf('Scryfall bulk-data request failed with status %d.', $response->getStatusCode()));
        }

        $payload = $response->toArray();
        $items = $payload['data'] ?? null;
        if (!is_array($items)) {
            throw new \RuntimeException('Scryfall bulk-data response is missing a "data" array.');
        }

        foreach ($items as $item) {
            if (!is_array($item) || ($item['type'] ?? '') !== 'oracle_cards') {
                continue;
            }

            $downloadUri = $item['download_uri'] ?? null;
            $updatedAt = $item['updated_at'] ?? null;
            if (!is_string($downloadUri) || '' === $downloadUri || !is_string($updatedAt) || '' === $updatedAt) {
                throw new \RuntimeException('oracle_cards bulk data entry is missing download_uri or updated_at.');
            }

            return [
                'download_uri' => $downloadUri,
                'updated_at' => $updatedAt,
            ];
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

        if (200 !== $response->getStatusCode()) {
            throw new \RuntimeException(sprintf('Scryfall bulk download failed with status %d.', $response->getStatusCode()));
        }

        // Stream the (~100+ MB) bulk JSON to a temp file instead of holding the
        // entire HTTP body string in memory. We open a writable resource and let
        // HttpClient::stream() push chunks into it as they arrive.
        $tmpPath = tempnam(sys_get_temp_dir(), 'scryfall_oracle_');
        if (false === $tmpPath) {
            throw new \RuntimeException('Unable to allocate a temp file for the Scryfall bulk download.');
        }

        $handle = fopen($tmpPath, 'wb');
        if (false === $handle) {
            @unlink($tmpPath);
            throw new \RuntimeException('Unable to open the temp file for the Scryfall bulk download.');
        }

        try {
            foreach ($this->httpClient->stream($response) as $chunk) {
                $content = $chunk->getContent();
                if ('' !== $content) {
                    fwrite($handle, $content);
                }
                unset($content);
            }
            fclose($handle);
            // Free the response so its internal buffers can be reclaimed promptly.
            unset($response);

            // NOTE: We still decode the whole document at once here, so peak
            // memory is bounded by the decoded card array, not the raw body.
            // The clear()-every-batch loop below further bounds Doctrine's UoW
            // growth. This bounds — but does not eliminate — peak memory; a true
            // streaming JSON parser (e.g. halaxa/json-machine) iterating the
            // top-level array without materialising it is the longer-term fix,
            // but that would add a composer dependency.
            $content = file_get_contents($tmpPath);
            if (false === $content) {
                throw new \RuntimeException('Unable to read the downloaded Scryfall bulk file.');
            }

            /** @var list<array<string, mixed>> $cards */
            $cards = json_decode($content, true, flags: JSON_THROW_ON_ERROR);
            unset($content);
        } finally {
            if (is_resource($handle)) {
                fclose($handle);
            }
            @unlink($tmpPath);
        }

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
            // Detach managed entities every batch to bound the unit-of-work size.
            $this->entityManager->clear();
            // Drop the processed chunk so it can be garbage collected.
            unset($chunk);

            if (null !== $onProgress) {
                $processed = min(($chunkIndex + 1) * $batchSize, $total);
                $onProgress($processed, $total, $inserted + $updated);
            }
        }

        return ['inserted' => $inserted, 'updated' => $updated, 'total' => $total];
    }

    /** @return list<Card> */
    public function searchRemoteAndUpsert(string $query, int $limit = 20, ?string $setCode = null, ?string $finish = null): array
    {
        $scryfallQuery = $query;
        if (null !== $setCode && '' !== $setCode) {
            $scryfallQuery .= ' set:'.strtolower($setCode);
        }
        if ('foil' === $finish) {
            $scryfallQuery .= ' is:foil';
        } elseif ('nonfoil' === $finish) {
            $scryfallQuery .= ' is:nonfoil';
        }

        $response = $this->requestWithRateLimit('GET', self::SEARCH_URL, [
            'headers' => ['User-Agent' => 'MTGStore/1.0'],
            'query' => ['q' => $scryfallQuery, 'unique' => 'prints'],
        ]);

        $status = $response->getStatusCode();
        // Scryfall returns 404 when a search yields no results — treat as empty.
        if (404 === $status) {
            return [];
        }

        if ($status < 200 || $status >= 300) {
            throw new \RuntimeException(sprintf('Scryfall search request failed with status %d.', $status));
        }

        // Use toArray(false) so a non-throwing decode lets us guard the shape ourselves.
        $payload = $response->toArray(false);
        $data = $payload['data'] ?? null;
        if (!is_array($data)) {
            return [];
        }

        $cards = [];
        foreach (array_slice($data, 0, $limit) as $cardData) {
            if (!is_array($cardData) || !isset($cardData['id'])) {
                continue;
            }

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

    /**
     * @param list<array{set: string, collectorNumber: string}> $identifiers
     *
     * @return array<string, Card> keyed by "set|collectorNumber"
     */
    public function fetchCollectionBySetCollectors(array $identifiers): array
    {
        $unique = [];
        foreach ($identifiers as $identifier) {
            $set = strtolower(trim($identifier['set']));
            $collectorNumber = trim($identifier['collectorNumber']);
            if ('' === $set || '' === $collectorNumber) {
                continue;
            }

            $unique[$this->collectionKey($set, $collectorNumber)] = [
                'set' => $set,
                'collector_number' => $collectorNumber,
            ];
        }

        $matchedIds = [];
        foreach (array_chunk($unique, 75, true) as $chunk) {
            $response = $this->requestWithRateLimit('POST', self::COLLECTION_URL, [
                'headers' => ['User-Agent' => 'MTGStore/1.0'],
                'json' => ['identifiers' => array_values($chunk)],
            ]);

            $status = $response->getStatusCode();
            if ($status < 200 || $status >= 300) {
                continue;
            }

            $payload = $response->toArray(false);
            $data = $payload['data'] ?? null;
            if (!is_array($data)) {
                continue;
            }

            foreach ($data as $cardData) {
                if (!is_array($cardData) || !isset($cardData['id'])) {
                    continue;
                }

                $this->upsertFromScryfallData($cardData);
                $key = $this->collectionKey(
                    (string) ($cardData['set'] ?? ''),
                    (string) ($cardData['collector_number'] ?? ''),
                );
                $matchedIds[$key] = Uuid::fromString((string) $cardData['id']);
            }

            $this->entityManager->flush();
        }

        $matches = [];
        foreach ($matchedIds as $key => $id) {
            $card = $this->cardRepository->find($id);
            if ($card instanceof Card) {
                $matches[$key] = $card;
            }
        }

        return $matches;
    }

    /**
     * Fetch the full card payload for a single card from Scryfall by its id and
     * persist every field (plus the complete raw payload) locally.
     *
     * Returns null when the card cannot be found on Scryfall.
     */
    public function fetchCardById(Uuid $id): ?Card
    {
        $response = $this->requestWithRateLimit('GET', self::CARD_URL.$id->toRfc4122(), [
            'headers' => ['User-Agent' => 'MTGStore/1.0'],
        ]);

        if (200 !== $response->getStatusCode()) {
            return null;
        }

        $data = $response->toArray(false);
        if (($data['object'] ?? null) === 'error') {
            return null;
        }

        $this->upsertFromScryfallData($data);
        $this->entityManager->flush();

        return $this->cardRepository->find($id);
    }

    /** @param array<string, mixed> $options */
    private function requestWithRateLimit(string $method, string $url, array $options): \Symfony\Contracts\HttpClient\ResponseInterface
    {
        $now = (int) floor(microtime(true) * 1_000_000);
        $elapsed = $now - self::$lastRequestAt;
        if ($elapsed < self::MIN_REQUEST_INTERVAL_MICROSECONDS) {
            usleep(self::MIN_REQUEST_INTERVAL_MICROSECONDS - $elapsed);
        }

        $response = $this->httpClient->request($method, $url, $options);
        self::$lastRequestAt = (int) floor(microtime(true) * 1_000_000);

        if (429 !== $response->getStatusCode()) {
            return $response;
        }

        $headers = $response->getHeaders(false);
        $retryAfter = isset($headers['retry-after'][0]) ? (float) $headers['retry-after'][0] : 1.0;
        usleep(max(1, (int) ceil($retryAfter * 1_000_000)));

        $response = $this->httpClient->request($method, $url, $options);
        self::$lastRequestAt = (int) floor(microtime(true) * 1_000_000);

        return $response;
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
            ->setName($this->truncate((string) $data['name'], 255))
            ->setSetCode($this->truncate((string) ($data['set'] ?? ''), 10))
            ->setCollectorNumber($this->truncate((string) ($data['collector_number'] ?? ''), 20))
            ->setRarity(isset($data['rarity']) ? $this->truncate((string) $data['rarity'], 20) : null)
            ->setManaCost(isset($data['mana_cost']) ? $this->truncate((string) $data['mana_cost'], 64) : null)
            ->setTypeLine(isset($data['type_line']) ? $this->truncate((string) $data['type_line'], 255) : null)
            ->setOracleText(isset($data['oracle_text']) ? (string) $data['oracle_text'] : null)
            ->setCmc(isset($data['cmc']) ? (float) $data['cmc'] : null)
            ->setImageUris(isset($data['image_uris']) && is_array($data['image_uris']) ? $data['image_uris'] : null)
            ->setPrices(isset($data['prices']) && is_array($data['prices']) ? $data['prices'] : null)
            ->setSetName(isset($data['set_name']) ? $this->truncate((string) $data['set_name'], 255) : null)
            ->setColors(isset($data['colors']) && is_array($data['colors']) ? array_values($data['colors']) : null)
            ->setColorIdentity(isset($data['color_identity']) && is_array($data['color_identity']) ? array_values($data['color_identity']) : null)
            ->setKeywords(isset($data['keywords']) && is_array($data['keywords']) ? array_values($data['keywords']) : null)
            ->setPower(isset($data['power']) ? $this->truncate((string) $data['power'], 16) : null)
            ->setToughness(isset($data['toughness']) ? $this->truncate((string) $data['toughness'], 16) : null)
            ->setLoyalty(isset($data['loyalty']) ? $this->truncate((string) $data['loyalty'], 16) : null)
            ->setArtist(isset($data['artist']) ? $this->truncate((string) $data['artist'], 255) : null)
            ->setFlavorText(isset($data['flavor_text']) ? (string) $data['flavor_text'] : null)
            ->setLegalities(isset($data['legalities']) && is_array($data['legalities']) ? $data['legalities'] : null)
            ->setFinishes(isset($data['finishes']) && is_array($data['finishes']) ? array_values($data['finishes']) : null)
            ->setGames(isset($data['games']) && is_array($data['games']) ? array_values($data['games']) : null)
            ->setReleasedAt(isset($data['released_at']) ? new \DateTimeImmutable((string) $data['released_at']) : null)
            ->setLang(isset($data['lang']) ? $this->truncate((string) $data['lang'], 16) : null)
            ->setLayout(isset($data['layout']) ? $this->truncate((string) $data['layout'], 32) : null)
            ->setScryfallUri(isset($data['scryfall_uri']) ? $this->truncate((string) $data['scryfall_uri'], 512) : null)
            ->setScryfallData($data)
            ->setScryfallUpdatedAt(isset($data['updated_at']) ? new \DateTimeImmutable((string) $data['updated_at']) : null);

        if ($isNew) {
            $this->entityManager->persist($card);

            return 'inserted';
        }

        return 'updated';
    }

    private function truncate(string $value, int $maxLength): string
    {
        return strlen($value) > $maxLength ? substr($value, 0, $maxLength) : $value;
    }

    private function collectionKey(string $set, string $collectorNumber): string
    {
        return strtolower(trim($set)).'|'.strtolower(trim($collectorNumber));
    }
}
