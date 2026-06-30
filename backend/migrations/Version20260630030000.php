<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260630030000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Move CSV import row state into a dedicated table.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE TABLE csv_import_rows (id SERIAL NOT NULL, job_id INT NOT NULL, row_index INT NOT NULL, name VARCHAR(255) NOT NULL, game VARCHAR(80) NOT NULL, set_code VARCHAR(120) NOT NULL, condition VARCHAR(16) NOT NULL, is_foil BOOLEAN NOT NULL, rarity VARCHAR(80) NOT NULL, quantity INT NOT NULL, variant VARCHAR(255) NOT NULL, collector_number VARCHAR(80) NOT NULL, status VARCHAR(32) NOT NULL, card JSON DEFAULT NULL, error TEXT DEFAULT NULL, imported_item_id INT DEFAULT NULL, PRIMARY KEY(id))');
        $this->addSql('CREATE INDEX IDX_CSV_IMPORT_ROWS_JOB_STATUS ON csv_import_rows (job_id, status, row_index)');
        $this->addSql('ALTER TABLE csv_import_rows ADD CONSTRAINT FK_CSV_IMPORT_ROWS_JOB FOREIGN KEY (job_id) REFERENCES csv_import_jobs (id) ON DELETE CASCADE NOT DEFERRABLE INITIALLY IMMEDIATE');

        $this->addSql(<<<'SQL'
INSERT INTO csv_import_rows (
    job_id,
    row_index,
    name,
    game,
    set_code,
    condition,
    is_foil,
    rarity,
    quantity,
    variant,
    collector_number,
    status,
    card,
    error,
    imported_item_id
)
SELECT
    job.id,
    COALESCE((row_data.value ->> 'rowIndex')::INT, row_data.ordinality - 1),
    COALESCE(row_data.value ->> 'name', ''),
    COALESCE(row_data.value ->> 'game', ''),
    COALESCE(row_data.value ->> 'set', ''),
    COALESCE(row_data.value ->> 'condition', 'NM'),
    COALESCE((row_data.value ->> 'isFoil')::BOOLEAN, FALSE),
    COALESCE(row_data.value ->> 'rarity', ''),
    COALESCE((row_data.value ->> 'quantity')::INT, 0),
    COALESCE(row_data.value ->> 'variant', ''),
    COALESCE(row_data.value ->> 'collectorNumber', ''),
    COALESCE(row_data.value ->> 'status', 'queued'),
    row_data.value -> 'card',
    row_data.value ->> 'error',
    NULLIF(row_data.value ->> 'importedItemId', '')::INT
FROM csv_import_jobs job
CROSS JOIN LATERAL json_array_elements(job.rows) WITH ORDINALITY AS row_data(value, ordinality)
WHERE json_typeof(job.rows) = 'array'
SQL);

        $this->addSql('ALTER TABLE csv_import_jobs DROP rows');
    }

    public function down(Schema $schema): void
    {
        $this->addSql("ALTER TABLE csv_import_jobs ADD rows JSON NOT NULL DEFAULT '[]'");
        $this->addSql(<<<'SQL'
UPDATE csv_import_jobs job
SET rows = COALESCE(rows_data.rows, '[]'::JSON)
FROM (
    SELECT
        import_row.job_id,
        json_agg(
            json_build_object(
                'rowIndex', import_row.row_index,
                'name', import_row.name,
                'game', import_row.game,
                'set', import_row.set_code,
                'condition', import_row.condition,
                'isFoil', import_row.is_foil,
                'rarity', import_row.rarity,
                'quantity', import_row.quantity,
                'variant', import_row.variant,
                'collectorNumber', import_row.collector_number,
                'status', import_row.status,
                'card', import_row.card,
                'error', import_row.error,
                'importedItemId', import_row.imported_item_id
            )
            ORDER BY import_row.row_index
        ) AS rows
    FROM csv_import_rows import_row
    GROUP BY import_row.job_id
) rows_data
WHERE rows_data.job_id = job.id
SQL);
        $this->addSql('ALTER TABLE csv_import_rows DROP CONSTRAINT FK_CSV_IMPORT_ROWS_JOB');
        $this->addSql('DROP TABLE csv_import_rows');
    }
}
