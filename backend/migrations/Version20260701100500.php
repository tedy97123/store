<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260701100500 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Allow long CSV import failure messages';
    }

    public function up(Schema $schema): void
    {
        /** @noinspection SqlNoDataSourceInspection */
        $this->addSql('ALTER TABLE csv_import_jobs ALTER error_message TYPE TEXT');
    }

    public function down(Schema $schema): void
    {
        /** @noinspection SqlNoDataSourceInspection */
        $this->addSql('ALTER TABLE csv_import_jobs ALTER error_message TYPE VARCHAR(255)');
    }
}
