<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260629120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add configurable store spotlight minimum price.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE stores ADD spotlight_min_price_cents INT DEFAULT 1000 NOT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE stores DROP spotlight_min_price_cents');
    }
}
