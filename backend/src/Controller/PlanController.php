<?php

namespace App\Controller;

use App\Service\Onboarding\PlanCatalog;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api')]
class PlanController extends AbstractController
{
    public function __construct(private readonly PlanCatalog $planCatalog)
    {
    }

    #[Route('/plans', name: 'api_plans', methods: ['GET'])]
    public function list(): JsonResponse
    {
        return $this->json(['plans' => $this->planCatalog->all()]);
    }
}
