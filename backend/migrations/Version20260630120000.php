<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260630120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add storefront branding fields (colors, logo, hero banner, messaging) to stores.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE stores ADD primary_color VARCHAR(7) DEFAULT NULL');
        $this->addSql('ALTER TABLE stores ADD accent_color VARCHAR(7) DEFAULT NULL');
        $this->addSql('ALTER TABLE stores ADD logo_url VARCHAR(1024) DEFAULT NULL');
        $this->addSql('ALTER TABLE stores ADD hero_image_url VARCHAR(1024) DEFAULT NULL');
        $this->addSql('ALTER TABLE stores ADD hero_heading VARCHAR(160) DEFAULT NULL');
        $this->addSql('ALTER TABLE stores ADD hero_subheading TEXT DEFAULT NULL');
        $this->addSql('ALTER TABLE stores ADD tagline VARCHAR(160) DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE stores DROP primary_color');
        $this->addSql('ALTER TABLE stores DROP accent_color');
        $this->addSql('ALTER TABLE stores DROP logo_url');
        $this->addSql('ALTER TABLE stores DROP hero_image_url');
        $this->addSql('ALTER TABLE stores DROP hero_heading');
        $this->addSql('ALTER TABLE stores DROP hero_subheading');
        $this->addSql('ALTER TABLE stores DROP tagline');
    }
}
