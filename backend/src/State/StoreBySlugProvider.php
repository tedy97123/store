<?php

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProviderInterface;
use App\Entity\Store;
use App\Repository\StoreRepository;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/** @implements ProviderInterface<Store> */
final readonly class StoreBySlugProvider implements ProviderInterface
{
    public function __construct(
        private StoreRepository $storeRepository,
    ) {
    }

    public function provide(Operation $operation, array $uriVariables = [], array $context = []): ?Store
    {
        $slug = $uriVariables['slug'] ?? null;
        if (!is_string($slug)) {
            return null;
        }

        $store = $this->storeRepository->findOneBySlug($slug);
        if (!$store) {
            throw new NotFoundHttpException(sprintf('Store "%s" not found.', $slug));
        }

        return $store;
    }
}
