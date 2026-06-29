<?php

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProcessorInterface;
use App\Entity\InventoryItem;
use App\Entity\Store;
use App\MultiTenancy\TenantContext;
use App\Repository\CardRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\Uid\Uuid;

/** @implements ProcessorInterface<InventoryItem, InventoryItem> */
final readonly class StoreInventoryProcessor implements ProcessorInterface
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private TenantContext $tenantContext,
        private CardRepository $cardRepository,
    ) {
    }

    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): InventoryItem
    {
        if (!$data instanceof InventoryItem) {
            throw new \InvalidArgumentException('Expected InventoryItem.');
        }

        $store = $this->tenantContext->getStore();
        if (!$store instanceof Store) {
            throw new NotFoundHttpException('Store not found.');
        }

        if (null === $data->getCard() && $data->getCardId()) {
            try {
                $card = $this->cardRepository->find(Uuid::fromString($data->getCardId()));
            } catch (\InvalidArgumentException) {
                throw new BadRequestHttpException('Invalid card id.');
            }
            if (null === $card) {
                throw new NotFoundHttpException('Card not found.');
            }
            $data->setCard($card);
        }

        if (null === $data->getCard()) {
            throw new BadRequestHttpException('Card is required.');
        }

        if (null === $data->getId()) {
            $data->setStore($store);
            $this->entityManager->persist($data);
        }

        $this->entityManager->flush();

        return $data;
    }
}
