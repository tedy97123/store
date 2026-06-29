<?php

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProcessorInterface;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

/** @implements ProcessorInterface<User, User> */
final readonly class UserAdminProcessor implements ProcessorInterface
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private UserPasswordHasherInterface $passwordHasher,
    ) {
    }

    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): User
    {
        if (!$data instanceof User) {
            throw new \InvalidArgumentException('Expected User.');
        }

        if ($plainPassword = $data->getPlainPassword()) {
            $data->setPassword($this->passwordHasher->hashPassword($data, $plainPassword));
            $data->eraseCredentials();
        }

        if (null === $data->getId()) {
            $this->entityManager->persist($data);
        }

        $this->entityManager->flush();

        return $data;
    }
}
