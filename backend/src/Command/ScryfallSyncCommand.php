<?php

namespace App\Command;

use App\Service\Scryfall\ScryfallClient;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'app:scryfall:sync', description: 'Sync a Scryfall bulk dataset into the local catalog')]
class ScryfallSyncCommand extends Command
{
    public function __construct(
        private readonly ScryfallClient $scryfallClient,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addOption(
            'type',
            null,
            InputOption::VALUE_REQUIRED,
            sprintf(
                'Bulk dataset to sync (%s). "%s" is every printing — required for the catalog to resolve store imports locally; "%s" is one printing per card name (smaller/faster, search-only).',
                implode('|', ScryfallClient::BULK_TYPES),
                ScryfallClient::BULK_TYPE_DEFAULT,
                ScryfallClient::BULK_TYPE_ORACLE,
            ),
            ScryfallClient::BULK_TYPE_DEFAULT,
        );
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $type = (string) $input->getOption('type');
        if (!in_array($type, ScryfallClient::BULK_TYPES, true)) {
            $io->error(sprintf('Unknown bulk type "%s". Valid types: %s.', $type, implode(', ', ScryfallClient::BULK_TYPES)));

            return Command::INVALID;
        }

        $io->title(sprintf('Scryfall %s sync', $type));

        $result = $this->scryfallClient->syncBulkCards(function (int $processed, int $changed) use ($io): void {
            $io->write(sprintf("\rProcessed %d (%d changed)", $processed, $changed));
        }, $type);

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
