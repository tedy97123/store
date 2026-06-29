<?php

namespace App\Controller;

use App\Entity\User;
use App\Repository\UserRepository;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Validator\Constraints as Assert;
use Symfony\Component\Validator\Validator\ValidatorInterface;

#[Route('/api')]
class AuthController extends AbstractController
{
    public function __construct(
        private readonly UserRepository $userRepository,
        private readonly UserPasswordHasherInterface $passwordHasher,
        private readonly ValidatorInterface $validator,
    ) {
    }

    #[Route('/register', name: 'api_register', methods: ['POST'])]
    public function register(Request $request): JsonResponse
    {
        /** @var array<string, mixed> $payload */
        $payload = json_decode($request->getContent(), true) ?? [];

        $email = isset($payload['email']) ? trim((string) $payload['email']) : '';
        $password = isset($payload['password']) ? (string) $payload['password'] : '';
        $displayName = isset($payload['displayName']) ? trim((string) $payload['displayName']) : '';

        $violations = $this->validator->validate($email, [new Assert\NotBlank(), new Assert\Email()]);
        $violations->addAll($this->validator->validate($password, [new Assert\NotBlank(), new Assert\Length(min: 8)]));
        $violations->addAll($this->validator->validate($displayName, [new Assert\NotBlank()]));

        if (count($violations) > 0) {
            return $this->json(['error' => (string) $violations->get(0)->getMessage()], Response::HTTP_BAD_REQUEST);
        }

        if ($this->userRepository->findOneBy(['email' => $email])) {
            return $this->json(['error' => 'Email already registered.'], Response::HTTP_CONFLICT);
        }

        $user = (new User())
            ->setEmail($email)
            ->setDisplayName($displayName)
            ->setRoles(['ROLE_USER'])
            ->setPassword($this->passwordHasher->hashPassword(new User(), $password));

        $this->userRepository->save($user, true);

        return $this->json([
            'id' => $user->getId(),
            'email' => $user->getEmail(),
            'displayName' => $user->getDisplayName(),
        ], Response::HTTP_CREATED);
    }
}
