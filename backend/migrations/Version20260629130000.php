<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260629130000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add CSV import jobs for server-side inventory imports.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE TABLE csv_import_jobs (id SERIAL NOT NULL, store_id INT NOT NULL, original_filename VARCHAR(255) NOT NULL, storage_path VARCHAR(255) NOT NULL, rows JSON NOT NULL, status VARCHAR(32) NOT NULL, total_rows INT NOT NULL, processed_rows INT NOT NULL, imported_rows INT NOT NULL, failed_rows INT NOT NULL, error_message TEXT DEFAULT NULL, created_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL, updated_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL, started_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL, finished_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL, PRIMARY KEY(id))');
        $this->addSql('CREATE INDEX IDX_6D2E20B4A76ED395 ON csv_import_jobs (store_id)');
        $this->addSql('ALTER TABLE csv_import_jobs ADD CONSTRAINT FK_6D2E20B4A76ED395 FOREIGN KEY (store_id) REFERENCES stores (id) NOT DEFERRABLE INITIALLY IMMEDIATE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE csv_import_jobs DROP CONSTRAINT FK_6D2E20B4A76ED395');
        $this->addSql('DROP TABLE csv_import_jobs');
    }
}
