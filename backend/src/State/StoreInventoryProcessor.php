<?php

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProcessorInterface;
use App\Entity\InventoryItem;
use App\Entity\Store;
use App\MultiTenancy\TenantContext;
use App\Repository\CardRepository;
use App\Service\Scryfall\ScryfallClient;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
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
        private ScryfallClient $scryfallClient,
        private LoggerInterface $logger,
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

        // Grab the complete Scryfall payload for this card the first time it is
        // stocked, so we keep every detail Scryfall offers. Best-effort: never
        // block adding inventory if Scryfall is slow or unreachable.
        $card = $data->getCard();
        if (null === $card->getScryfallData()) {
            try {
                $this->scryfallClient->fetchCardById($card->getId());
            } catch (\Throwable $e) {
                $this->logger->warning('Scryfall enrichment failed for card {id}: {error}', [
                    'id' => (string) $card->getId(),
                    'error' => $e->getMessage(),
                ]);
            }
        }

        if (null === $data->getId()) {
            $data->setStore($store);
            $this->entityManager->persist($data);
        }

        $this->entityManager->flush();

        return $data;
    }
}
