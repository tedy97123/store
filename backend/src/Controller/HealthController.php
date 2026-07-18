<?php

namespace App\Controller;

use Doctrine\DBAL\Connection;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Health probes for load balancers / container orchestration.
 *
 * Deliberately under /health (not /api) so they sit outside the JWT firewall
 * and stay publicly reachable without a token. Kept dependency-light so a
 * liveness check never fails for a reason unrelated to the process being up.
 */
#[Route('/health')]
class HealthController extends AbstractController
{
    public function __construct(
        private readonly Connection $connection,
    ) {
    }

    /**
     * Liveness: is the PHP process up and serving? No I/O — used by
     * orchestrators to decide whether to restart the container.
     */
    #[Route('', name: 'health_live', methods: ['GET'])]
    public function live(): JsonResponse
    {
        return $this->json(['status' => 'ok']);
    }

    /**
     * Readiness: can the app serve real traffic? Pings the database so a
     * broken DB connection takes the instance out of the load-balancer pool
     * (503) instead of serving errors.
     */
    #[Route('/ready', name: 'health_ready', methods: ['GET'])]
    public function ready(): JsonResponse
    {
        try {
            $this->connection->executeQuery('SELECT 1');
        } catch (\Throwable $e) {
            return $this->json([
                'status' => 'unavailable',
                'checks' => ['database' => 'down'],
            ], Response::HTTP_SERVICE_UNAVAILABLE);
        }

        return $this->json([
            'status' => 'ok',
            'checks' => ['database' => 'up'],
        ]);
    }
}
