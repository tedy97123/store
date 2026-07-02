<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260702001000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add storefront card display style setting';
    }

    public function up(Schema $schema): void
    {
        $this->addSql("ALTER TABLE stores ADD card_display_style VARCHAR(32) DEFAULT 'gallery' NOT NULL");
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE stores DROP card_display_style');
    }
}
