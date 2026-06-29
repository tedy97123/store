<?php

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProcessorInterface;
use App\Entity\Card;
use App\Entity\Order;
use App\Entity\OrderLine;
use App\Entity\Store;
use App\MultiTenancy\TenantContext;
use App\Repository\CardRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\Uid\Uuid;

/** @implements ProcessorInterface<Order, Order> */
final readonly class StoreOrderProcessor implements ProcessorInterface
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private TenantContext $tenantContext,
        private CardRepository $cardRepository,
    ) {
    }

    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): Order
    {
        if (!$data instanceof Order) {
            throw new \InvalidArgumentException('Expected Order.');
        }

        $store = $this->tenantContext->getStore();
        if (!$store instanceof Store) {
            throw new NotFoundHttpException('Store not found.');
        }

        $inputLines = $data->getInputLines();
        if ([] === $inputLines) {
            throw new BadRequestHttpException('An order must contain at least one line.');
        }

        $data->setStore($store);
        $data->setReference($this->generateReference());

        $total = 0;
        foreach ($inputLines as $i => $lineData) {
            if (!is_array($lineData)) {
                throw new BadRequestHttpException(sprintf('Line %d is invalid.', $i));
            }

            $quantity = (int) ($lineData['quantity'] ?? 0);
            $priceCents = (int) ($lineData['priceCents'] ?? 0);
            if ($quantity < 1) {
                throw new BadRequestHttpException(sprintf('Line %d must have a quantity of at least 1.', $i));
            }
            if ($priceCents < 0) {
                throw new BadRequestHttpException(sprintf('Line %d has an invalid price.', $i));
            }

            $card = null;
            $cardId = $lineData['cardId'] ?? null;
            if (is_string($cardId) && '' !== $cardId) {
                try {
                    $card = $this->cardRepository->find(Uuid::fromString($cardId));
                } catch (\InvalidArgumentException) {
                    throw new BadRequestHttpException(sprintf('Line %d has an invalid card id.', $i));
                }
                if (!$card instanceof Card) {
                    throw new NotFoundHttpException(sprintf('Line %d references an unknown card.', $i));
                }
            }

            $cardName = (string) ($lineData['cardName'] ?? $card?->getName() ?? '');
            if ('' === $cardName) {
                throw new BadRequestHttpException(sprintf('Line %d requires a card or card name.', $i));
            }

            $line = (new OrderLine())
                ->setCard($card)
                ->setCardName($cardName)
                ->setQuantity($quantity)
                ->setPriceCents($priceCents);

            $data->addLine($line);
            $total += $quantity * $priceCents;
        }

        $data->setTotalCents($total);

        $this->entityManager->persist($data);
        $this->entityManager->flush();

        return $data;
    }

    private function generateReference(): string
    {
        return 'ORD-'.strtoupper(bin2hex(random_bytes(4)));
    }
}
