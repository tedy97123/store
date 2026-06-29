<?php

namespace App\EventSubscriber;

use App\MultiTenancy\TenantContext;
use App\Repository\StoreRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\KernelEvents;

class TenantSubscriber implements EventSubscriberInterface
{
    public function __construct(
        private readonly TenantContext $tenantContext,
        private readonly StoreRepository $storeRepository,
        private readonly EntityManagerInterface $entityManager,
    ) {
    }

    public static function getSubscribedEvents(): array
    {
        return [
            KernelEvents::REQUEST => ['onKernelRequest', 5],
        ];
    }

    public function onKernelRequest(RequestEvent $event): void
    {
        if (!$event->isMainRequest()) {
            return;
        }

        $request = $event->getRequest();
        $path = $request->getPathInfo();

        if (str_starts_with($path, '/api/admin')) {
            $this->tenantContext->disableFilter();
            $this->disableDoctrineFilter();

            return;
        }

        if (!preg_match('#^/api/stores/([^/]+)#', $path, $matches)) {
            return;
        }

        $slug = $matches[1];
        if (in_array($slug, ['inventory'], true)) {
            return;
        }

        $store = $this->storeRepository->findOneBySlug($slug);
        if (!$store) {
            throw new NotFoundHttpException(sprintf('Store "%s" not found.', $slug));
        }

        $this->tenantContext->setStore($store);
        $request->attributes->set('store', $store);

        $filter = $this->entityManager->getFilters()->enable('tenant');
        $filter->setParameter('store_id', (string) $store->getId());
    }

    private function disableDoctrineFilter(): void
    {
        if ($this->entityManager->getFilters()->isEnabled('tenant')) {
            $this->entityManager->getFilters()->disable('tenant');
        }
    }
}
