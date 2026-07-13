<?php

namespace App\Service\Onboarding;

/**
 * Onboarding subscription payments — the store OWNER paying the PLATFORM for a
 * tier. This is distinct from the store↔customer Square integration.
 *
 * PayPal / Apple Pay / Google Pay / card in one flow points to Braintree
 * (a PayPal company) whose Drop-in tokenizes all four to a single payment nonce.
 * Until BRAINTREE_MERCHANT_ID / BRAINTREE_PUBLIC_KEY / BRAINTREE_PRIVATE_KEY are
 * configured we run in "mock" mode: a fake client token is issued and any nonce
 * is accepted, so the wizard is exercisable end-to-end. Live mode requires the
 * Braintree SDK (composer require braintree/braintree_php); credentials without
 * the SDK are a configuration error and fail loudly rather than faking success.
 */
final class PaymentGatewayClient
{
    /** Payment methods the onboarding step offers. */
    public const METHODS = ['paypal', 'apple_pay', 'google_pay', 'card'];

    public function isLive(): bool
    {
        return '' !== $this->env('BRAINTREE_MERCHANT_ID')
            && '' !== $this->env('BRAINTREE_PUBLIC_KEY')
            && '' !== $this->env('BRAINTREE_PRIVATE_KEY');
    }

    public function environment(): string
    {
        $env = strtolower($this->env('BRAINTREE_ENVIRONMENT') ?: 'sandbox');

        return 'production' === $env ? 'production' : 'sandbox';
    }

    /**
     * A client token for the browser SDK. In live mode this would come from
     * Braintree's Gateway::clientToken()->generate().
     *
     * @return array{clientToken: string, mode: string, environment: string, methods: list<string>}
     */
    public function clientToken(): array
    {
        return [
            'clientToken' => $this->isLive()
                ? $this->gateway()->clientToken()->generate()
                : 'mock-'.bin2hex(random_bytes(16)),
            'mode' => $this->isLive() ? 'braintree' : 'mock',
            'environment' => $this->environment(),
            'methods' => self::METHODS,
        ];
    }

    /**
     * Accept a payment-method nonce from the browser and return a durable
     * reference. In live mode this charges the nonce via Braintree; in mock
     * mode we synthesize a reference so the store can be recorded as pending
     * review.
     *
     * @return array{reference: string, status: string}
     *
     * @throws \RuntimeException when Braintree declines or is misconfigured
     */
    public function recordSubscription(string $nonce, string $methodType, int $priceCents): array
    {
        // Free tier needs no payment method.
        if (0 === $priceCents) {
            return ['reference' => 'free', 'status' => 'active'];
        }

        if (!$this->isLive()) {
            return ['reference' => 'mock-txn-'.bin2hex(random_bytes(8)), 'status' => 'active'];
        }

        $result = $this->gateway()->transaction()->sale([
            'amount' => number_format($priceCents / 100, 2, '.', ''),
            'paymentMethodNonce' => $nonce,
            'options' => ['submitForSettlement' => true],
        ]);
        if (!$result->success) {
            throw new \RuntimeException('Payment was declined: '.($result->message ?: 'unknown gateway error.'));
        }

        return ['reference' => (string) $result->transaction->id, 'status' => 'active'];
    }

    private function gateway(): object
    {
        if (!class_exists(\Braintree\Gateway::class)) {
            throw new \RuntimeException(
                'BRAINTREE_* credentials are set but the Braintree SDK is not installed. '
                .'Run "composer require braintree/braintree_php", or remove the credentials to use mock mode.',
            );
        }

        return new \Braintree\Gateway([
            'environment' => $this->environment(),
            'merchantId' => $this->env('BRAINTREE_MERCHANT_ID'),
            'publicKey' => $this->env('BRAINTREE_PUBLIC_KEY'),
            'privateKey' => $this->env('BRAINTREE_PRIVATE_KEY'),
        ]);
    }

    private function env(string $key): string
    {
        return trim((string) ($_ENV[$key] ?? $_SERVER[$key] ?? ''));
    }
}
