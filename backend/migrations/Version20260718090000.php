<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Catalog scaling indexes.
 *
 * - idx_card_set_collector: expression index on (LOWER(set_code),
 *   LOWER(collector_number)) — the natural key of a printing. Import
 *   resolution matches on this instead of scanning by name substring.
 * - pg_trgm + idx_card_name_trgm: trigram GIN index on LOWER(name) so the
 *   catalog's leading-wildcard LIKE searches ('%bolt%') can use an index
 *   instead of a sequential scan that degrades as the card table grows.
 */
final class Version20260718090000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add printing natural-key index and trigram name index to cards';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE INDEX IF NOT EXISTS idx_card_set_collector ON cards ((LOWER(set_code)), (LOWER(collector_number)))');
        // pg_trgm is a "trusted" extension since PostgreSQL 13, so the database
        // owner can install it without superuser.
        $this->addSql('CREATE EXTENSION IF NOT EXISTS pg_trgm');
        $this->addSql('CREATE INDEX IF NOT EXISTS idx_card_name_trgm ON cards USING gin ((LOWER(name)) gin_trgm_ops)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX IF EXISTS idx_card_name_trgm');
        $this->addSql('DROP INDEX IF EXISTS idx_card_set_collector');
        // The pg_trgm extension is left installed; other objects may use it.
    }
}
