<?php

namespace App\Service\Payments;

use Symfony\Contracts\HttpClient\HttpClientInterface;

final readonly class SquareOAuthClient
{
    private const DEFAULT_SCOPES = [
        'MERCHANT_PROFILE_READ',
        'ORDERS_READ',
        'ORDERS_WRITE',
        'PAYMENTS_READ',
        'PAYMENTS_WRITE',
    ];

    public function __construct(private HttpClientInterface $httpClient)
    {
    }

    public function isConfigured(): bool
    {
        return '' !== $this->applicationId() && '' !== $this->applicationSecret();
    }

    public function environment(): string
    {
        $environment = strtolower((string) ($_ENV['SQUARE_ENVIRONMENT'] ?? $_SERVER['SQUARE_ENVIRONMENT'] ?? 'sandbox'));

        return 'production' === $environment ? 'production' : 'sandbox';
    }

    /** @return list<string> */
    public function scopes(): array
    {
        $raw = (string) ($_ENV['SQUARE_OAUTH_SCOPES'] ?? $_SERVER['SQUARE_OAUTH_SCOPES'] ?? '');
        if ('' === trim($raw)) {
            return self::DEFAULT_SCOPES;
        }

        return array_values(array_filter(preg_split('/[\s,]+/', trim($raw)) ?: []));
    }

    public function authorizationUrl(string $redirectUri, string $state): string
    {
        if (!$this->isConfigured()) {
            throw new \RuntimeException('Square OAuth is not configured.');
        }

        $params = [
            'client_id' => $this->applicationId(),
            'scope' => implode(' ', $this->scopes()),
            'state' => $state,
            'redirect_uri' => $redirectUri,
        ];

        if ('production' === $this->environment()) {
            $params['session'] = 'false';
        }

        return $this->oauthBaseUrl().'/authorize?'.http_build_query($params, '', '&', PHP_QUERY_RFC3986);
    }

    /**
     * @return array{
     *   accessToken: string,
     *   refreshToken: string|null,
     *   merchantId: string|null,
     *   expiresAt: \DateTimeImmutable|null
     * }
     */
    public function obtainToken(string $code, string $redirectUri): array
    {
        $response = $this->httpClient->request('POST', $this->oauthBaseUrl().'/token', [
            'headers' => [
                'Content-Type' => 'application/json',
                'Accept' => 'application/json',
            ],
            'json' => [
                'client_id' => $this->applicationId(),
                'client_secret' => $this->applicationSecret(),
                'code' => $code,
                'grant_type' => 'authorization_code',
                'redirect_uri' => $redirectUri,
            ],
        ]);

        $data = $response->toArray(false);
        if ($response->getStatusCode() >= 400) {
            throw new \RuntimeException($this->errorMessage($data, 'Square rejected the OAuth authorization code.'));
        }

        return [
            'accessToken' => (string) ($data['access_token'] ?? ''),
            'refreshToken' => isset($data['refresh_token']) ? (string) $data['refresh_token'] : null,
            'merchantId' => isset($data['merchant_id']) ? (string) $data['merchant_id'] : null,
            'expiresAt' => isset($data['expires_at']) ? new \DateTimeImmutable((string) $data['expires_at']) : null,
        ];
    }

    public function revoke(string $accessToken): void
    {
        if ('' === $accessToken) {
            return;
        }

        $response = $this->httpClient->request('POST', $this->oauthBaseUrl().'/revoke', [
            'headers' => [
                'Authorization' => 'Client '.$this->applicationSecret(),
                'Content-Type' => 'application/json',
                'Accept' => 'application/json',
            ],
            'json' => [
                'client_id' => $this->applicationId(),
                'access_token' => $accessToken,
            ],
        ]);

        if ($response->getStatusCode() >= 400) {
            $data = $response->toArray(false);
            throw new \RuntimeException($this->errorMessage($data, 'Could not revoke Square authorization.'));
        }
    }

    private function oauthBaseUrl(): string
    {
        return 'production' === $this->environment()
            ? 'https://connect.squareup.com/oauth2'
            : 'https://connect.squareupsandbox.com/oauth2';
    }

    private function applicationId(): string
    {
        return trim((string) ($_ENV['SQUARE_APPLICATION_ID'] ?? $_SERVER['SQUARE_APPLICATION_ID'] ?? ''));
    }

    private function applicationSecret(): string
    {
        return trim((string) ($_ENV['SQUARE_APPLICATION_SECRET'] ?? $_SERVER['SQUARE_APPLICATION_SECRET'] ?? ''));
    }

    /** @param array<string, mixed> $data */
    private function errorMessage(array $data, string $fallback): string
    {
        $errors = $data['errors'] ?? null;
        if (is_array($errors) && isset($errors[0]) && is_array($errors[0])) {
            return (string) ($errors[0]['detail'] ?? $errors[0]['code'] ?? $fallback);
        }

        return $fallback;
    }
}
