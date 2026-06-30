<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260630140000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add full-palette branding fields (surface, text, muted, border colors) to stores.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE stores ADD surface_color VARCHAR(7) DEFAULT NULL');
        $this->addSql('ALTER TABLE stores ADD text_color VARCHAR(7) DEFAULT NULL');
        $this->addSql('ALTER TABLE stores ADD muted_color VARCHAR(7) DEFAULT NULL');
        $this->addSql('ALTER TABLE stores ADD border_color VARCHAR(7) DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE stores DROP surface_color');
        $this->addSql('ALTER TABLE stores DROP text_color');
        $this->addSql('ALTER TABLE stores DROP muted_color');
        $this->addSql('ALTER TABLE stores DROP border_color');
    }
}
