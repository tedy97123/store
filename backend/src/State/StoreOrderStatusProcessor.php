<?php

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProcessorInterface;
use App\Entity\CustomerNotification;
use App\Entity\InventoryItem;
use App\Entity\Order;
use App\Entity\Store;
use App\Entity\User;
use App\Enum\OrderStatus;
use App\Repository\CustomerNotificationRepository;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Email;

/**
 * Handles PATCH /stores/{slug}/orders/{id}: validates the status transition
 * against the OrderStatus state machine, restocks inventory on
 * cancel/refund, and notifies the customer (in-app + email) of the outcome.
 *
 * @implements ProcessorInterface<Order, Order>
 */
final readonly class StoreOrderStatusProcessor implements ProcessorInterface
{
    private const FROM_ADDRESS = 'no-reply@store.local';

    public function __construct(
        private EntityManagerInterface $entityManager,
        private UserRepository $userRepository,
        private CustomerNotificationRepository $notificationRepository,
        private MailerInterface $mailer,
    ) {
    }

    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): Order
    {
        if (!$data instanceof Order) {
            throw new \InvalidArgumentException('Expected Order.');
        }

        $originalStatus = $this->originalStatus($data);
        $newStatus = $data->getStatus();
        $notification = null;

        if ($originalStatus instanceof OrderStatus && $originalStatus !== $newStatus) {
            if (!$originalStatus->canTransitionTo($newStatus)) {
                throw new UnprocessableEntityHttpException(sprintf(
                    'Cannot change order status from "%s" to "%s".',
                    $originalStatus->value,
                    $newStatus->value,
                ));
            }

            if ($newStatus->returnsStock()) {
                $this->restock($data);
            }

            $notification = $this->buildCustomerNotification($data, $newStatus);
        }

        $this->entityManager->persist($data);
        $this->entityManager->flush();

        // Email only after the status change is durably saved, so a failed
        // flush can never produce a "your order is ready" email for a
        // transition that was rolled back.
        if ($notification instanceof CustomerNotification) {
            $this->sendEmail($data, $notification);
        }

        return $data;
    }

    private function originalStatus(Order $order): ?OrderStatus
    {
        $original = $this->entityManager->getUnitOfWork()->getOriginalEntityData($order)['status'] ?? null;
        if ($original instanceof OrderStatus) {
            return $original;
        }
        if (is_string($original)) {
            return OrderStatus::tryFrom($original);
        }

        return null;
    }

    /** Return each line's quantity to the listing it was sold from. */
    private function restock(Order $order): void
    {
        foreach ($order->getLines() as $line) {
            $item = $line->getInventoryItem();
            if ($item instanceof InventoryItem) {
                $item->setQuantity($item->getQuantity() + $line->getQuantity());
            }
        }
    }

    private function buildCustomerNotification(Order $order, OrderStatus $status): ?CustomerNotification
    {
        [$type, $title, $bodyTemplate] = match (true) {
            $status->isFulfilled() => [
                CustomerNotification::TYPE_ORDER_FULFILLED,
                'Order fulfilled',
                'Your order %s from %s has been fulfilled.',
            ],
            OrderStatus::CANCELLED === $status => [
                CustomerNotification::TYPE_ORDER_CANCELLED,
                'Order cancelled',
                'Your order %s from %s has been cancelled.',
            ],
            OrderStatus::REFUNDED === $status => [
                CustomerNotification::TYPE_ORDER_REFUNDED,
                'Order refunded',
                'Your order %s from %s has been refunded.',
            ],
            default => [null, null, null],
        };
        if (null === $type) {
            return null;
        }

        $email = $order->getCustomerEmail();
        $store = $order->getStore();
        if (null === $email || '' === $email || !$store instanceof Store) {
            return null;
        }

        $user = $this->userRepository->findOneByEmailInsensitive($email);
        if (!$user instanceof User) {
            return null;
        }
        if ($this->notificationRepository->findOneForOrder($user, $order, $type) instanceof CustomerNotification) {
            return null;
        }

        $notification = (new CustomerNotification())
            ->setUser($user)
            ->setStore($store)
            ->setRelatedOrder($order)
            ->setType($type)
            ->setTitle($title)
            ->setBody(sprintf($bodyTemplate, $order->getReference(), $store->getName() ?? 'this store'));

        $this->entityManager->persist($notification);

        return $notification;
    }

    private function sendEmail(Order $order, CustomerNotification $notification): void
    {
        $to = $notification->getUser()?->getEmail();
        if (null === $to || '' === $to) {
            return;
        }

        try {
            $this->mailer->send((new Email())
                ->from(self::FROM_ADDRESS)
                ->to($to)
                ->subject(sprintf('%s - %s', $notification->getTitle(), $order->getReference()))
                ->text(sprintf(
                    "%s\n\nOrder: %s\nStore: %s\nTotal: $%0.2f\n\nYou can view this order from your account page.",
                    $notification->getBody(),
                    $order->getReference(),
                    $order->getStore()?->getName() ?? 'Store',
                    $order->getTotalCents() / 100,
                )));
        } catch (TransportExceptionInterface) {
            // The in-app notification is already persisted; a down mail
            // transport (e.g. Mailpit not running locally) must not fail the
            // status change.
        }
    }
}
