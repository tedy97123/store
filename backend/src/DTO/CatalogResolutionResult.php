<?php

namespace App\DTO;

use App\Entity\Card;

final readonly class CatalogResolutionResult
{
    public function __construct(
        public ?Card $card,
        public ?string $error = null,
    ) {
    }

    public function isResolved(): bool
    {
        return $this->card instanceof Card;
    }
}
