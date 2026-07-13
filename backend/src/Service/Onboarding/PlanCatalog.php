<?php

namespace App\Service\Onboarding;

/**
 * The platform's subscription tiers. Kept as code (not a DB table) because the
 * catalog changes rarely and is shared by the onboarding wizard and validation.
 * Prices are in cents, billed monthly.
 */
final class PlanCatalog
{
    /** @var list<array<string, mixed>> */
    private const PLANS = [
        [
            'key' => 'starter',
            'name' => 'Starter',
            'priceCents' => 0,
            'tagline' => 'Get your storefront live for free.',
            'features' => [
                'Up to 500 listed cards',
                'Custom branding & colors',
                'Marketplace storefront',
                'Email support',
            ],
        ],
        [
            'key' => 'pro',
            'name' => 'Pro',
            'priceCents' => 4900,
            'tagline' => 'For growing shops that sell every day.',
            'popular' => true,
            'features' => [
                'Unlimited listed cards',
                'CSV bulk import',
                'Marketplace hero spotlight eligibility',
                'Priority support',
                'Advanced reports',
            ],
        ],
        [
            'key' => 'enterprise',
            'name' => 'Enterprise',
            'priceCents' => 19900,
            'tagline' => 'Multi-location and high-volume sellers.',
            'features' => [
                'Everything in Pro',
                'Multiple staff seats',
                'Dedicated onboarding',
                'SLA & phone support',
                'Custom integrations',
            ],
        ],
    ];

    /** @return list<array<string, mixed>> */
    public function all(): array
    {
        return self::PLANS;
    }

    /** @return list<string> */
    public function keys(): array
    {
        return array_map(static fn (array $plan): string => (string) $plan['key'], self::PLANS);
    }

    /** @return array<string, mixed>|null */
    public function find(string $key): ?array
    {
        foreach (self::PLANS as $plan) {
            if ($plan['key'] === $key) {
                return $plan;
            }
        }

        return null;
    }
}
