<?php

namespace App\Service\Auth;

use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * A minimal, provider-agnostic OpenID Connect client. Point it at any OIDC
 * issuer (Google, Microsoft Entra, Okta, Auth0, Keycloak, …) via env and it
 * discovers the endpoints automatically:
 *
 *   SSO_OIDC_ISSUER          e.g. https://accounts.google.com
 *   SSO_OIDC_CLIENT_ID
 *   SSO_OIDC_CLIENT_SECRET
 *   SSO_OIDC_SCOPES          optional, default "openid email profile"
 *   SSO_PROVIDER_NAME        optional label shown on the button
 */
final class OidcClient
{
    /** @var array<string, mixed>|null */
    private ?array $discoveryCache = null;

    public function __construct(private readonly HttpClientInterface $httpClient)
    {
    }

    public function isConfigured(): bool
    {
        return '' !== $this->issuer() && '' !== $this->clientId() && '' !== $this->clientSecret();
    }

    public function providerName(): string
    {
        $name = trim((string) ($_ENV['SSO_PROVIDER_NAME'] ?? $_SERVER['SSO_PROVIDER_NAME'] ?? ''));

        return '' !== $name ? $name : 'Single sign-on';
    }

    public function authorizationUrl(string $redirectUri, string $state): string
    {
        $params = [
            'client_id' => $this->clientId(),
            'response_type' => 'code',
            'scope' => $this->scopes(),
            'redirect_uri' => $redirectUri,
            'state' => $state,
        ];

        return $this->endpoint('authorization_endpoint').'?'.http_build_query($params, '', '&', PHP_QUERY_RFC3986);
    }

    public function exchangeCode(string $code, string $redirectUri): string
    {
        $response = $this->httpClient->request('POST', $this->endpoint('token_endpoint'), [
            'headers' => ['Accept' => 'application/json'],
            'body' => [
                'grant_type' => 'authorization_code',
                'code' => $code,
                'redirect_uri' => $redirectUri,
                'client_id' => $this->clientId(),
                'client_secret' => $this->clientSecret(),
            ],
        ]);

        $data = $response->toArray(false);
        $accessToken = (string) ($data['access_token'] ?? '');
        if ('' === $accessToken) {
            $detail = (string) ($data['error_description'] ?? $data['error'] ?? '');
            throw new \RuntimeException(
                '' !== $detail ? 'SSO token exchange failed: '.$detail : 'SSO provider did not return an access token.',
            );
        }

        return $accessToken;
    }

    /** @return array{email: string, name: string} */
    public function fetchUserInfo(string $accessToken): array
    {
        $response = $this->httpClient->request('GET', $this->endpoint('userinfo_endpoint'), [
            'headers' => ['Authorization' => 'Bearer '.$accessToken, 'Accept' => 'application/json'],
        ]);

        $data = $response->toArray(false);
        $email = strtolower(trim((string) ($data['email'] ?? '')));
        if ('' === $email) {
            throw new \RuntimeException('SSO provider did not return an email address.');
        }
        // We link accounts by email, so an unverified claim would let anyone
        // registering that address at the provider take over a local account.
        if (in_array($data['email_verified'] ?? null, [false, 'false', 0, '0'], true)) {
            throw new \RuntimeException('SSO provider reports this email address as unverified.');
        }

        $name = trim((string) ($data['name'] ?? ($data['given_name'] ?? '')));

        return ['email' => $email, 'name' => '' !== $name ? $name : $email];
    }

    private function endpoint(string $key): string
    {
        $discovery = $this->discovery();
        $value = (string) ($discovery[$key] ?? '');
        if ('' === $value) {
            throw new \RuntimeException(sprintf('OIDC discovery is missing "%s".', $key));
        }

        return $value;
    }

    /** @return array<string, mixed> */
    private function discovery(): array
    {
        if (null !== $this->discoveryCache) {
            return $this->discoveryCache;
        }

        $url = rtrim($this->issuer(), '/').'/.well-known/openid-configuration';
        $response = $this->httpClient->request('GET', $url, ['headers' => ['Accept' => 'application/json']]);
        if ($response->getStatusCode() >= 400) {
            throw new \RuntimeException('Could not load OIDC discovery document.');
        }

        return $this->discoveryCache = $response->toArray(false);
    }

    private function scopes(): string
    {
        $scopes = trim((string) ($_ENV['SSO_OIDC_SCOPES'] ?? $_SERVER['SSO_OIDC_SCOPES'] ?? ''));

        return '' !== $scopes ? $scopes : 'openid email profile';
    }

    private function issuer(): string
    {
        return trim((string) ($_ENV['SSO_OIDC_ISSUER'] ?? $_SERVER['SSO_OIDC_ISSUER'] ?? ''));
    }

    private function clientId(): string
    {
        return trim((string) ($_ENV['SSO_OIDC_CLIENT_ID'] ?? $_SERVER['SSO_OIDC_CLIENT_ID'] ?? ''));
    }

    private function clientSecret(): string
    {
        return trim((string) ($_ENV['SSO_OIDC_CLIENT_SECRET'] ?? $_SERVER['SSO_OIDC_CLIENT_SECRET'] ?? ''));
    }
}
