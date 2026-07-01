<?php

namespace App\Service\MTGJson;

use Symfony\Contracts\HttpClient\HttpClientInterface;

class MTGJsonClient
{
    private const SET_URL = 'https://mtgjson.com/api/v5/';
    private const MAX_CACHED_SETS = 4;
    private const MAX_SET_RESPONSE_BYTES = 8 * 1024 * 1024;

    /** @var list<string> */
    private const SKIP_SET_CODES = [
        // The List is very large and can exceed PHP's 128 MB memory limit when
        // decoded as one MTGJSON set payload. Scryfall search handles it safely.
        'PLST',
    ];

    /** @var array<string, list<array{name: string, number: string, rarity: string, finishes: list<string>, identifiers: array<string, mixed>}>> */
    private array $setCache = [];

    public function __construct(private readonly HttpClientInterface $httpClient)
    {
    }

    /** @return list<array{name: string, number: string, rarity: string, finishes: list<string>, identifiers: array<string, mixed>}> */
    public function getSetCards(string $setCode): array
    {
        $normalizedSet = strtoupper(trim($setCode));
        if ('' === $normalizedSet) {
            return [];
        }

        if (in_array($normalizedSet, self::SKIP_SET_CODES, true)) {
            $this->setCache[$normalizedSet] = [];

            return [];
        }

        if (isset($this->setCache[$normalizedSet])) {
            return $this->setCache[$normalizedSet];
        }

        $response = $this->httpClient->request('GET', self::SET_URL.$normalizedSet.'.json', [
            'headers' => ['User-Agent' => 'MTGStore/1.0'],
        ]);

        if (200 !== $response->getStatusCode()) {
            $this->setCache[$normalizedSet] = [];

            return [];
        }

        $contentLength = (int) ($response->getHeaders(false)['content-length'][0] ?? 0);
        if ($contentLength > self::MAX_SET_RESPONSE_BYTES) {
            $this->setCache[$normalizedSet] = [];

            return [];
        }

        $payload = $response->toArray(false);
        $cards = $payload['data']['cards'] ?? [];
        if (!is_array($cards)) {
            $cards = [];
        }

        $this->setCache[$normalizedSet] = array_values(array_filter(array_map(
            static function (mixed $card): ?array {
                if (!is_array($card)) {
                    return null;
                }

                $finishes = $card['finishes'] ?? [];
                $identifiers = $card['identifiers'] ?? [];

                return [
                    'name' => (string) ($card['name'] ?? ''),
                    'number' => (string) ($card['number'] ?? ''),
                    'rarity' => (string) ($card['rarity'] ?? ''),
                    'finishes' => is_array($finishes) ? array_values($finishes) : [],
                    'identifiers' => is_array($identifiers) ? $identifiers : [],
                ];
            },
            $cards,
        )));
        if (count($this->setCache) > self::MAX_CACHED_SETS) {
            unset($this->setCache[(string) array_key_first($this->setCache)]);
        }
        unset($payload, $cards);

        return $this->setCache[$normalizedSet];
    }
}
