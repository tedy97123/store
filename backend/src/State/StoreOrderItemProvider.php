<?php

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProviderInterface;
use App\Entity\Order;
use App\Entity\Store;
use App\MultiTenancy\TenantContext;
use App\Repository\OrderRepository;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/** @implements ProviderInterface<Order> */
final readonly class StoreOrderItemProvider implements ProviderInterface
{
    public function __construct(
        private OrderRepository $orderRepository,
        private TenantContext $tenantContext,
    ) {
    }

    public function provide(Operation $operation, array $uriVariables = [], array $context = []): ?Order
    {
        $store = $this->tenantContext->getStore();
        if (!$store instanceof Store) {
            throw new NotFoundHttpException('Store not found.');
        }

        $order = $this->orderRepository->find($uriVariables['id'] ?? null);
        if (!$order instanceof Order || $order->getStore()?->getId() !== $store->getId()) {
            throw new NotFoundHttpException('Order not found.');
        }

        return $order;
    }
}
