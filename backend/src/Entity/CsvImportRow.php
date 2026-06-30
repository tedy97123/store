<?php

namespace App\Entity;

use App\Repository\CsvImportRowRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: CsvImportRowRepository::class)]
#[ORM\Table(name: 'csv_import_rows')]
#[ORM\Index(columns: ['job_id', 'status', 'row_index'], name: 'IDX_CSV_IMPORT_ROWS_JOB_STATUS')]
class CsvImportRow
{
    public const STATUS_QUEUED = 'queued';
    public const STATUS_PROCESSING = 'processing';
    public const STATUS_IMPORTED = 'imported';
    public const STATUS_ERROR = 'error';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?CsvImportJob $job = null;

    #[ORM\Column]
    private int $rowIndex = 0;

    #[ORM\Column(length: 255)]
    private string $name = '';

    #[ORM\Column(length: 80)]
    private string $game = '';

    #[ORM\Column(length: 120)]
    private string $setCode = '';

    #[ORM\Column(length: 16)]
    private string $condition = 'NM';

    #[ORM\Column]
    private bool $isFoil = false;

    #[ORM\Column(length: 80)]
    private string $rarity = '';

    #[ORM\Column]
    private int $quantity = 0;

    #[ORM\Column(length: 255)]
    private string $variant = '';

    #[ORM\Column(length: 80)]
    private string $collectorNumber = '';

    #[ORM\Column(length: 32)]
    private string $status = self::STATUS_QUEUED;

    #[ORM\Column(type: 'json', nullable: true)]
    private ?array $card = null;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $error = null;

    #[ORM\Column(nullable: true)]
    private ?int $importedItemId = null;

    public function getId(): ?int { return $this->id; }
    public function getJob(): ?CsvImportJob { return $this->job; }
    public function setJob(CsvImportJob $job): static { $this->job = $job; return $this; }
    public function getRowIndex(): int { return $this->rowIndex; }
    public function setRowIndex(int $rowIndex): static { $this->rowIndex = $rowIndex; return $this; }
    public function getName(): string { return $this->name; }
    public function setName(string $name): static { $this->name = $name; return $this; }
    public function getGame(): string { return $this->game; }
    public function setGame(string $game): static { $this->game = $game; return $this; }
    public function getSetCode(): string { return $this->setCode; }
    public function setSetCode(string $setCode): static { $this->setCode = $setCode; return $this; }
    public function getCondition(): string { return $this->condition; }
    public function setCondition(string $condition): static { $this->condition = $condition; return $this; }
    public function isFoil(): bool { return $this->isFoil; }
    public function setIsFoil(bool $isFoil): static { $this->isFoil = $isFoil; return $this; }
    public function getRarity(): string { return $this->rarity; }
    public function setRarity(string $rarity): static { $this->rarity = $rarity; return $this; }
    public function getQuantity(): int { return $this->quantity; }
    public function setQuantity(int $quantity): static { $this->quantity = $quantity; return $this; }
    public function getVariant(): string { return $this->variant; }
    public function setVariant(string $variant): static { $this->variant = $variant; return $this; }
    public function getCollectorNumber(): string { return $this->collectorNumber; }
    public function setCollectorNumber(string $collectorNumber): static { $this->collectorNumber = $collectorNumber; return $this; }
    public function getStatus(): string { return $this->status; }
    public function setStatus(string $status): static { $this->status = $status; return $this; }
    public function getCard(): ?array { return $this->card; }
    public function setCard(?array $card): static { $this->card = $card; return $this; }
    public function getError(): ?string { return $this->error; }
    public function setError(?string $error): static { $this->error = $error; return $this; }
    public function getImportedItemId(): ?int { return $this->importedItemId; }
    public function setImportedItemId(?int $importedItemId): static { $this->importedItemId = $importedItemId; return $this; }
}
