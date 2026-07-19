<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Concurrency + query-scaling hardening (post-audit).
 *
 * - csv_import_rows.claimed_at: stamps when a worker claims a row so job
 *   completion can distinguish a crashed handler's abandoned rows (stale,
 *   safe to requeue) from a live handler's in-flight rows (fresh, must NOT
 *   be requeued — doing so double-imports inventory).
 * - inventory_items.version: optimistic-locking column. Concurrent
 *   read-modify-write quantity updates now fail fast (and the import worker
 *   retries the batch) instead of silently losing stock increments.
 * - idx_inventory_store_id_id: supports keyset pagination
 *   (WHERE store_id = ? AND id > ? ORDER BY id) as a pure index range scan.
 * - idx_orders_store_customer_email: the customer "my orders" lookup
 *   filters on (store, LOWER(customer_email)) — previously a full scan of
 *   the store's orders.
 */
final class Version20260718160000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Import claim timestamps, inventory optimistic locking, keyset/customer-email indexes';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE csv_import_rows ADD claimed_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL');
        $this->addSql('ALTER TABLE inventory_items ADD version INT DEFAULT 1 NOT NULL');
        $this->addSql('CREATE INDEX IF NOT EXISTS idx_inventory_store_id_id ON inventory_items (store_id, id)');
        $this->addSql('CREATE INDEX IF NOT EXISTS idx_orders_store_customer_email ON orders (store_id, (LOWER(customer_email)))');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX IF EXISTS idx_orders_store_customer_email');
        $this->addSql('DROP INDEX IF EXISTS idx_inventory_store_id_id');
        $this->addSql('ALTER TABLE inventory_items DROP version');
        $this->addSql('ALTER TABLE csv_import_rows DROP claimed_at');
    }
}
