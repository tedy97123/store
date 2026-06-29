<?php

namespace App\Command;

use App\Service\Scryfall\ScryfallClient;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'app:scryfall:sync', description: 'Sync Scryfall oracle cards into the local catalog')]
class ScryfallSyncCommand extends Command
{
    public function __construct(
        private readonly ScryfallClient $scryfallClient,
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $io->title('Scryfall oracle_cards sync');

        $result = $this->scryfallClient->syncOracleCards(function (int $processed, int $total, int $changed) use ($io): void {
            $io->write(sprintf("\rProcessed %d / %d (%d changed)", $processed, $total, $changed));
        });

        $io->newLine(2);
        $io->success(sprintf(
            'Sync complete: %d inserted, %d updated, %d total cards processed.',
            $result['inserted'],
            $result['updated'],
            $result['total'],
        ));

        return Command::SUCCESS;
    }
}
