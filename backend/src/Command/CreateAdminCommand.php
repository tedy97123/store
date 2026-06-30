<?php

namespace App\Command;

use App\Entity\User;
use App\Repository\UserRepository;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

#[AsCommand(name: 'app:create-admin', description: 'Create a platform super-admin account (the supported way to bootstrap admins)')]
class CreateAdminCommand extends Command
{
    public function __construct(
        private readonly UserRepository $userRepository,
        private readonly UserPasswordHasherInterface $passwordHasher,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addArgument('email', InputArgument::OPTIONAL, 'Admin email address')
            ->addArgument('displayName', InputArgument::OPTIONAL, 'Admin display name')
            ->addOption('password', null, InputOption::VALUE_REQUIRED, 'Admin password (min 8 chars)');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        $email = $input->getArgument('email');
        if (null === $email || '' === trim((string) $email)) {
            $email = (string) $io->ask('Email');
        }
        $email = trim((string) $email);

        $displayName = $input->getArgument('displayName');
        if (null === $displayName || '' === trim((string) $displayName)) {
            $displayName = (string) $io->ask('Display name');
        }
        $displayName = trim((string) $displayName);

        $password = $input->getOption('password');
        if (null === $password || '' === (string) $password) {
            $password = (string) $io->askHidden('Password (min 8 characters)');
        }
        $password = (string) $password;

        if ('' === $email) {
            $io->error('Email is required.');

            return Command::FAILURE;
        }

        if ('' === $displayName) {
            $io->error('Display name is required.');

            return Command::FAILURE;
        }

        if (strlen($password) < 8) {
            $io->error('Password must be at least 8 characters.');

            return Command::FAILURE;
        }

        if ($this->userRepository->findOneBy(['email' => $email])) {
            $io->error('Email already registered.');

            return Command::FAILURE;
        }

        $user = (new User())
            ->setEmail($email)
            ->setDisplayName($displayName)
            ->setRoles(['ROLE_SUPER_ADMIN']);

        $user->setPassword($this->passwordHasher->hashPassword($user, $password));

        $this->userRepository->save($user, true);

        $io->success(sprintf('Super-admin account created for %s.', $email));

        return Command::SUCCESS;
    }
}
