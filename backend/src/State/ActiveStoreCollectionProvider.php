<?php

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProviderInterface;
use App\Entity\Store;
use App\Repository\StoreRepository;

/** @implements ProviderInterface<Store> */
final readonly class ActiveStoreCollectionProvider implements ProviderInterface
{
    public function __construct(
        private StoreRepository $storeRepository,
    ) {
    }

    public function provide(Operation $operation, array $uriVariables = [], array $context = []): array
    {
        return $this->storeRepository->findActiveStores();
    }
}
