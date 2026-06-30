<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260630130000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add storefront background_color branding field to stores.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE stores ADD background_color VARCHAR(7) DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE stores DROP background_color');
    }
}
