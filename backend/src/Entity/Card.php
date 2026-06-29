<?php

namespace App\Entity;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Get;
use App\Repository\CardRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Uid\Uuid;

#[ORM\Entity(repositoryClass: CardRepository::class)]
#[ORM\Table(name: 'cards')]
#[ORM\Index(name: 'IDX_CARD_NAME', fields: ['name'])]
#[ORM\Index(name: 'IDX_CARD_ORACLE_ID', fields: ['oracleId'])]
#[ApiResource(
    operations: [
        new Get(normalizationContext: ['groups' => ['card:read']]),
    ],
)]
class Card
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid', unique: true)]
    #[Groups(['card:read', 'inventory:read'])]
    private Uuid $id;

    #[ORM\Column(type: 'uuid')]
    #[Groups(['card:read', 'inventory:read'])]
    private Uuid $oracleId;

    #[ORM\Column(length: 255)]
    #[Groups(['card:read', 'inventory:read'])]
    private string $name;

    #[ORM\Column(length: 10)]
    #[Groups(['card:read', 'inventory:read'])]
    private string $setCode;

    #[ORM\Column(length: 20)]
    #[Groups(['card:read', 'inventory:read'])]
    private string $collectorNumber;

    #[ORM\Column(length: 20, nullable: true)]
    #[Groups(['card:read', 'inventory:read'])]
    private ?string $rarity = null;

    #[ORM\Column(length: 64, nullable: true)]
    #[Groups(['card:read', 'inventory:read'])]
    private ?string $manaCost = null;

    #[ORM\Column(length: 255, nullable: true)]
    #[Groups(['card:read', 'inventory:read'])]
    private ?string $typeLine = null;

    #[ORM\Column(type: 'text', nullable: true)]
    #[Groups(['card:read'])]
    private ?string $oracleText = null;

    #[ORM\Column(type: 'float', nullable: true)]
    #[Groups(['card:read'])]
    private ?float $cmc = null;

    /** @var array<string, mixed>|null */
    #[ORM\Column(type: 'json', nullable: true)]
    #[Groups(['card:read', 'inventory:read'])]
    private ?array $imageUris = null;

    /** @var array<string, mixed>|null */
    #[ORM\Column(type: 'json', nullable: true)]
    #[Groups(['card:read'])]
    private ?array $prices = null;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $scryfallUpdatedAt = null;

    public function __construct(Uuid $id)
    {
        $this->id = $id;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getOracleId(): Uuid
    {
        return $this->oracleId;
    }

    public function setOracleId(Uuid $oracleId): static
    {
        $this->oracleId = $oracleId;

        return $this;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): static
    {
        $this->name = $name;

        return $this;
    }

    public function getSetCode(): string
    {
        return $this->setCode;
    }

    public function setSetCode(string $setCode): static
    {
        $this->setCode = $setCode;

        return $this;
    }

    public function getCollectorNumber(): string
    {
        return $this->collectorNumber;
    }

    public function setCollectorNumber(string $collectorNumber): static
    {
        $this->collectorNumber = $collectorNumber;

        return $this;
    }

    public function getRarity(): ?string
    {
        return $this->rarity;
    }

    public function setRarity(?string $rarity): static
    {
        $this->rarity = $rarity;

        return $this;
    }

    public function getManaCost(): ?string
    {
        return $this->manaCost;
    }

    public function setManaCost(?string $manaCost): static
    {
        $this->manaCost = $manaCost;

        return $this;
    }

    public function getTypeLine(): ?string
    {
        return $this->typeLine;
    }

    public function setTypeLine(?string $typeLine): static
    {
        $this->typeLine = $typeLine;

        return $this;
    }

    public function getOracleText(): ?string
    {
        return $this->oracleText;
    }

    public function setOracleText(?string $oracleText): static
    {
        $this->oracleText = $oracleText;

        return $this;
    }

    public function getCmc(): ?float
    {
        return $this->cmc;
    }

    public function setCmc(?float $cmc): static
    {
        $this->cmc = $cmc;

        return $this;
    }

    /** @return array<string, mixed>|null */
    public function getImageUris(): ?array
    {
        return $this->imageUris;
    }

    /** @param array<string, mixed>|null $imageUris */
    public function setImageUris(?array $imageUris): static
    {
        $this->imageUris = $imageUris;

        return $this;
    }

    /** @return array<string, mixed>|null */
    public function getPrices(): ?array
    {
        return $this->prices;
    }

    /** @param array<string, mixed>|null $prices */
    public function setPrices(?array $prices): static
    {
        $this->prices = $prices;

        return $this;
    }

    public function getScryfallUpdatedAt(): ?\DateTimeImmutable
    {
        return $this->scryfallUpdatedAt;
    }

    public function setScryfallUpdatedAt(?\DateTimeImmutable $scryfallUpdatedAt): static
    {
        $this->scryfallUpdatedAt = $scryfallUpdatedAt;

        return $this;
    }

    #[Groups(['card:read', 'inventory:read'])]
    public function getImageUrl(): ?string
    {
        return $this->imageUris['normal'] ?? $this->imageUris['small'] ?? null;
    }
}
