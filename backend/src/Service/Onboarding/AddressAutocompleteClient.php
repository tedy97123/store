<?php

namespace App\Service\Onboarding;

use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * Server-side address autocomplete. Proxies Mapbox's geocoding API when a token
 * is configured (keeps the key off the client), and falls back to a small mock
 * so the onboarding wizard is fully functional in local/dev without any key.
 *
 * Configure with MAPBOX_ACCESS_TOKEN. Any provider can slot in behind this
 * interface later (Google Places, Nominatim, …).
 */
final readonly class AddressAutocompleteClient
{
    public function __construct(private HttpClientInterface $httpClient)
    {
    }

    public function isConfigured(): bool
    {
        return '' !== $this->token();
    }

    /**
     * @return list<array{
     *   label: string,
     *   addressLine1: string,
     *   city: string,
     *   region: string,
     *   postalCode: string,
     *   country: string,
     *   latitude: float|null,
     *   longitude: float|null
     * }>
     */
    public function search(string $query, ?string $country = null): array
    {
        $query = trim($query);
        if ('' === $query) {
            return [];
        }

        if (!$this->isConfigured()) {
            return $this->mockSuggestions($query);
        }

        try {
            return $this->searchMapbox($query, $country);
        } catch (\Throwable) {
            // Never let a provider hiccup break the wizard — degrade to mock.
            return $this->mockSuggestions($query);
        }
    }

    /** @return list<array<string, mixed>> */
    private function searchMapbox(string $query, ?string $country): array
    {
        $params = [
            'access_token' => $this->token(),
            'autocomplete' => 'true',
            'types' => 'address',
            'limit' => 5,
        ];
        if (null !== $country && '' !== trim($country)) {
            $params['country'] = strtolower(trim($country));
        }

        $response = $this->httpClient->request(
            'GET',
            'https://api.mapbox.com/geocoding/v5/mapbox.places/'.rawurlencode($query).'.json',
            ['query' => $params],
        );

        if ($response->getStatusCode() >= 400) {
            throw new \RuntimeException('Geocoding provider error.');
        }

        $data = $response->toArray(false);
        $features = is_array($data['features'] ?? null) ? $data['features'] : [];

        $results = [];
        foreach ($features as $feature) {
            if (!is_array($feature)) {
                continue;
            }
            $results[] = $this->mapFeature($feature);
        }

        return $results;
    }

    /** @param array<string, mixed> $feature @return array<string, mixed> */
    private function mapFeature(array $feature): array
    {
        $context = is_array($feature['context'] ?? null) ? $feature['context'] : [];
        $center = is_array($feature['center'] ?? null) ? $feature['center'] : [];

        $streetNumber = isset($feature['address']) ? (string) $feature['address'].' ' : '';
        $streetName = (string) ($feature['text'] ?? '');

        return [
            'label' => (string) ($feature['place_name'] ?? trim($streetNumber.$streetName)),
            'addressLine1' => trim($streetNumber.$streetName),
            'city' => $this->contextValue($context, 'place'),
            'region' => $this->contextValue($context, 'region'),
            'postalCode' => $this->contextValue($context, 'postcode'),
            'country' => $this->contextShortCode($context, 'country'),
            'longitude' => isset($center[0]) ? (float) $center[0] : null,
            'latitude' => isset($center[1]) ? (float) $center[1] : null,
        ];
    }

    /** @param list<mixed> $context */
    private function contextValue(array $context, string $prefix): string
    {
        foreach ($context as $item) {
            if (is_array($item) && str_starts_with((string) ($item['id'] ?? ''), $prefix.'.')) {
                return (string) ($item['text'] ?? '');
            }
        }

        return '';
    }

    /** @param list<mixed> $context */
    private function contextShortCode(array $context, string $prefix): string
    {
        foreach ($context as $item) {
            if (is_array($item) && str_starts_with((string) ($item['id'] ?? ''), $prefix.'.')) {
                $code = (string) ($item['short_code'] ?? '');

                return strtoupper(substr($code, 0, 2));
            }
        }

        return '';
    }

    /** @return list<array<string, mixed>> */
    private function mockSuggestions(string $query): array
    {
        // Deterministic, obviously-fake suggestions so the wizard is testable
        // end-to-end without a geocoding key. Replace by setting MAPBOX_ACCESS_TOKEN.
        $samples = [
            ['line' => 'Main St', 'city' => 'Springfield', 'region' => 'Illinois', 'postal' => '62701', 'lat' => 39.7817, 'lng' => -89.6501],
            ['line' => 'Market St', 'city' => 'San Francisco', 'region' => 'California', 'postal' => '94103', 'lat' => 37.7749, 'lng' => -122.4194],
            ['line' => 'Broadway', 'city' => 'New York', 'region' => 'New York', 'postal' => '10007', 'lat' => 40.7128, 'lng' => -74.006],
        ];

        $results = [];
        foreach ($samples as $i => $s) {
            $line1 = sprintf('%d %s', (($i + 1) * 100) + (strlen($query) % 100), $s['line']);
            $results[] = [
                'label' => sprintf('%s, %s, %s %s (sample)', $line1, $s['city'], $s['region'], $s['postal']),
                'addressLine1' => $line1,
                'city' => $s['city'],
                'region' => $s['region'],
                'postalCode' => $s['postal'],
                'country' => 'US',
                'latitude' => $s['lat'],
                'longitude' => $s['lng'],
            ];
        }

        return $results;
    }

    private function token(): string
    {
        return trim((string) ($_ENV['MAPBOX_ACCESS_TOKEN'] ?? $_SERVER['MAPBOX_ACCESS_TOKEN'] ?? ''));
    }
}
