<?php

namespace App\Controller;

use App\Entity\User;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api')]
class MeController extends AbstractController
{
    #[Route('/me', name: 'api_me', methods: ['GET'])]
    #[IsGranted('ROLE_USER')]
    public function me(): JsonResponse
    {
        $user = $this->getUser();
        if (!$user instanceof User) {
            throw $this->createAccessDeniedException();
        }

        $ownedStores = [];
        foreach ($user->getOwnedStores() as $store) {
            $ownedStores[] = [
                'id' => $store->getId(),
                'name' => $store->getName(),
                'slug' => $store->getSlug(),
            ];
        }

        return $this->json([
            'id' => $user->getId(),
            'email' => $user->getEmail(),
            'displayName' => $user->getDisplayName(),
            'roles' => $user->getRoles(),
            'ownedStores' => $ownedStores,
        ]);
    }
}
