<?php

namespace App\EventSubscriber;

use Psr\Log\LoggerInterface;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Event\ExceptionEvent;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpKernel\Event\ResponseEvent;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\KernelEvents;
use Symfony\Component\Uid\Uuid;

/**
 * Request correlation + structured error logging.
 *
 * Assigns every request a correlation id (honoring an inbound `X-Request-Id`
 * from an upstream proxy/gateway, else generating one), echoes it back on the
 * response, and logs unhandled exceptions with structured context keyed by that
 * id. This is the groundwork for tracing a single request across logs without
 * pulling in an APM stack — and lets a client quote the id when reporting an
 * error.
 */
final class RequestIdSubscriber implements EventSubscriberInterface
{
    public const ATTRIBUTE = '_request_id';
    public const HEADER = 'X-Request-Id';

    public function __construct(
        private readonly LoggerInterface $logger,
    ) {
    }

    public static function getSubscribedEvents(): array
    {
        return [
            // Run early so the id is available to everything downstream, but
            // after the built-in request-context setup.
            KernelEvents::REQUEST => ['onKernelRequest', 100],
            KernelEvents::RESPONSE => ['onKernelResponse', -100],
            KernelEvents::EXCEPTION => ['onKernelException', 0],
        ];
    }

    public function onKernelRequest(RequestEvent $event): void
    {
        if (!$event->isMainRequest()) {
            return;
        }

        $event->getRequest()->attributes->set(self::ATTRIBUTE, $this->resolveId($event->getRequest()));
    }

    public function onKernelResponse(ResponseEvent $event): void
    {
        if (!$event->isMainRequest()) {
            return;
        }

        $id = $event->getRequest()->attributes->get(self::ATTRIBUTE);
        if (is_string($id) && '' !== $id) {
            $event->getResponse()->headers->set(self::HEADER, $id);
        }
    }

    public function onKernelException(ExceptionEvent $event): void
    {
        if (!$event->isMainRequest()) {
            return;
        }

        $throwable = $event->getThrowable();
        $request = $event->getRequest();
        $status = $throwable instanceof HttpExceptionInterface ? $throwable->getStatusCode() : 500;

        $context = [
            'request_id' => $request->attributes->get(self::ATTRIBUTE),
            'method' => $request->getMethod(),
            'path' => $request->getPathInfo(),
            'status' => $status,
            'exception' => $throwable::class,
        ];

        // 5xx are real faults (error); expected 4xx client errors are noise at
        // error level, so log them at a lower severity.
        if ($status >= 500) {
            $this->logger->error('Unhandled exception: {message}', $context + ['message' => $throwable->getMessage(), 'exception_object' => $throwable]);
        } else {
            $this->logger->info('Request failed: {message}', $context + ['message' => $throwable->getMessage()]);
        }
    }

    private function resolveId(Request $request): string
    {
        $incoming = $request->headers->get(self::HEADER);
        if (is_string($incoming) && '' !== trim($incoming)) {
            // Bound the length so an upstream can't inject an unbounded header
            // value into our logs/response.
            return substr(trim($incoming), 0, 128);
        }

        return Uuid::v4()->toRfc4122();
    }
}
