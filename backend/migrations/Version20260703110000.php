<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260703110000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Link order lines to the inventory item they were sold from (enables stock decrement + restock)';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE order_lines ADD inventory_item_id INT DEFAULT NULL');
        $this->addSql('CREATE INDEX IDX_ORDER_LINE_INVENTORY_ITEM ON order_lines (inventory_item_id)');
        $this->addSql('ALTER TABLE order_lines ADD CONSTRAINT FK_ORDER_LINE_INVENTORY_ITEM FOREIGN KEY (inventory_item_id) REFERENCES inventory_items (id) ON DELETE SET NULL NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE order_lines DROP CONSTRAINT FK_ORDER_LINE_INVENTORY_ITEM');
        $this->addSql('DROP INDEX IDX_ORDER_LINE_INVENTORY_ITEM');
        $this->addSql('ALTER TABLE order_lines DROP inventory_item_id');
    }
}
