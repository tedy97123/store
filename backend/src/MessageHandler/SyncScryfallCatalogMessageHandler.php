<?php

namespace App\MessageHandler;

use App\Message\SyncScryfallCatalogMessage;
use App\Service\Scryfall\ScryfallClient;
use Psr\Log\LoggerInterface;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;

/**
 * Runs a Scryfall bulk sync in the worker. Note: this shares the `async`
 * transport with CSV imports — a long default_cards sync occupies one worker
 * for its duration, so production deployments running frequent syncs should
 * dedicate a second messenger worker (or a separate transport) to imports.
 */
#[AsMessageHandler]
final readonly class SyncScryfallCatalogMessageHandler
{
    public function __construct(
        private ScryfallClient $scryfallClient,
        private LoggerInterface $logger,
    ) {
    }

    public function __invoke(SyncScryfallCatalogMessage $message): void
    {
        $this->logger->info('Scryfall bulk sync started ({type}).', ['type' => $message->type]);

        $result = $this->scryfallClient->syncBulkCards(null, $message->type);

        $this->logger->info('Scryfall bulk sync finished ({type}): {inserted} inserted, {updated} updated, {total} processed.', [
            'type' => $message->type,
            'inserted' => $result['inserted'],
            'updated' => $result['updated'],
            'total' => $result['total'],
        ]);
    }
}
