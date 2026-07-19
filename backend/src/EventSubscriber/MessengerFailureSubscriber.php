<?php

namespace App\EventSubscriber;

use App\Monitoring\ErrorReporter;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\Messenger\Event\WorkerMessageFailedEvent;

/**
 * Reports terminal messenger failures (a message that has exhausted its retries
 * and is about to be sent to the dead-letter transport) to error tracking, so a
 * persistently failing CSV import or catalog sync surfaces the same way an HTTP
 * 5xx does. No-op unless SENTRY_DSN is configured.
 */
final class MessengerFailureSubscriber implements EventSubscriberInterface
{
    public function __construct(
        private readonly ErrorReporter $errorReporter,
    ) {
    }

    public static function getSubscribedEvents(): array
    {
        return [
            WorkerMessageFailedEvent::class => 'onMessageFailed',
        ];
    }

    public function onMessageFailed(WorkerMessageFailedEvent $event): void
    {
        // Only the final failure matters; intermediate retries will be retried.
        if ($event->willRetry()) {
            return;
        }

        $this->errorReporter->report($event->getThrowable(), [
            'transport' => $event->getReceiverName(),
            'message' => $event->getEnvelope()->getMessage()::class,
        ]);
    }
}
