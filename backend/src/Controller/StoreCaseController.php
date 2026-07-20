<?php

namespace App\Controller;

use App\Entity\Store;
use App\Entity\StoreCase;
use App\Repository\StoreCaseRepository;
use App\Repository\StoreRepository;
use App\Service\CaseCards\ColorIdentityParser;
use App\Service\CaseCards\SectionSerializer;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * Display cases — the top level of the Case Cards feature. A store has any
 * number of named physical cases ("Front Counter", "Wall Case"), each divided
 * into sections. The GET collection is public (it backs the storefront Case
 * Cards page, nested cases → sections → cards); mutations require STORE_MANAGE.
 *
 * Section-level operations live in StoreSectionController.
 */
#[Route('/api/stores/{slug}/cases')]
final class StoreCaseController extends AbstractController
{
    public function __construct(
        private readonly StoreRepository $storeRepository,
        private readonly StoreCaseRepository $caseRepository,
        private readonly SectionSerializer $serializer,
        private readonly ColorIdentityParser $colorIdentityParser,
        private readonly EntityManagerInterface $entityManager,
    ) {
    }

    /** Public: the store's cases with sections and cards, for the storefront page. */
    #[Route('', name: 'api_store_cases_list', methods: ['GET'])]
    public function list(string $slug): JsonResponse
    {
        $store = $this->storeRepository->findOneBySlug($slug);
        if (null === $store) {
            return $this->json(['detail' => 'Store not found.'], 404);
        }

        return $this->json(array_map(
            $this->serializeCase(...),
            $this->caseRepository->findForStore($store),
        ));
    }

    /** The color-filter vocabulary, for admin autocomplete. Public and static. */
    #[Route('/filter-suggestions', name: 'api_store_cases_filter_suggestions', methods: ['GET'])]
    public function filterSuggestions(): JsonResponse
    {
        return $this->json(['colorIdentities' => $this->colorIdentityParser->suggestions()]);
    }

    #[Route('', name: 'api_store_cases_create', methods: ['POST'])]
    #[IsGranted('ROLE_USER')]
    public function create(Request $request, string $slug): JsonResponse
    {
        $store = $this->findManagedStore($slug);
        if (!$store instanceof Store) {
            return $this->json(['detail' => 'Store not found.'], 404);
        }

        $payload = json_decode($request->getContent(), true);
        $name = trim((string) (is_array($payload) ? ($payload['name'] ?? '') : ''));
        if ('' === $name) {
            return $this->json(['detail' => 'A case name is required.'], 422);
        }

        $case = new StoreCase();
        $case->setStore($store);
        $case->setName(mb_substr($name, 0, 120));
        $case->setPosition($this->caseRepository->nextPosition($store));

        $this->entityManager->persist($case);
        $this->entityManager->flush();

        return $this->json($this->serializeCase($case), 201);
    }

    #[Route('/{id}', name: 'api_store_cases_update', methods: ['PATCH'])]
    #[IsGranted('ROLE_USER')]
    public function update(Request $request, string $slug, int $id): JsonResponse
    {
        $case = $this->findManagedCase($slug, $id);
        if (!$case instanceof StoreCase) {
            return $this->json(['detail' => 'Case not found.'], 404);
        }

        $payload = json_decode($request->getContent(), true);
        if (is_array($payload) && array_key_exists('name', $payload)) {
            $name = trim((string) $payload['name']);
            if ('' === $name) {
                return $this->json(['detail' => 'A case name cannot be empty.'], 422);
            }
            $case->setName(mb_substr($name, 0, 120));
        }

        $this->entityManager->flush();

        return $this->json($this->serializeCase($case));
    }

    #[Route('/{id}', name: 'api_store_cases_delete', methods: ['DELETE'])]
    #[IsGranted('ROLE_USER')]
    public function delete(string $slug, int $id): JsonResponse
    {
        $case = $this->findManagedCase($slug, $id);
        if (!$case instanceof StoreCase) {
            return $this->json(['detail' => 'Case not found.'], 404);
        }

        $this->entityManager->remove($case);
        $this->entityManager->flush();

        return $this->json(null, 204);
    }

    private function findManagedStore(string $slug): ?Store
    {
        $store = $this->storeRepository->findOneBySlug($slug);
        if (null === $store) {
            return null;
        }

        $this->denyAccessUnlessGranted('STORE_MANAGE', $store);

        return $store;
    }

    private function findManagedCase(string $slug, int $id): ?StoreCase
    {
        $store = $this->findManagedStore($slug);
        if (!$store instanceof Store) {
            return null;
        }

        return $this->caseRepository->findOneForStore($store, $id);
    }

    private function serializeCase(StoreCase $case): array
    {
        return $this->serializer->serializeCase($case);
    }
}
