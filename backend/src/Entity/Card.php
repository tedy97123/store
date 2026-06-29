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

    #[ORM\Column(length: 255, nullable: true)]
    #[Groups(['card:read', 'inventory:read'])]
    private ?string $setName = null;

    /** @var list<string>|null */
    #[ORM\Column(type: 'json', nullable: true)]
    #[Groups(['card:read', 'inventory:read'])]
    private ?array $colors = null;

    /** @var list<string>|null */
    #[ORM\Column(type: 'json', nullable: true)]
    #[Groups(['card:read', 'inventory:read'])]
    private ?array $colorIdentity = null;

    /** @var list<string>|null */
    #[ORM\Column(type: 'json', nullable: true)]
    #[Groups(['card:read'])]
    private ?array $keywords = null;

    #[ORM\Column(length: 16, nullable: true)]
    #[Groups(['card:read'])]
    private ?string $power = null;

    #[ORM\Column(length: 16, nullable: true)]
    #[Groups(['card:read'])]
    private ?string $toughness = null;

    #[ORM\Column(length: 16, nullable: true)]
    #[Groups(['card:read'])]
    private ?string $loyalty = null;

    #[ORM\Column(length: 255, nullable: true)]
    #[Groups(['card:read'])]
    private ?string $artist = null;

    #[ORM\Column(type: 'text', nullable: true)]
    #[Groups(['card:read'])]
    private ?string $flavorText = null;

    /** @var array<string, mixed>|null */
    #[ORM\Column(type: 'json', nullable: true)]
    #[Groups(['card:read'])]
    private ?array $legalities = null;

    /** @var list<string>|null */
    #[ORM\Column(type: 'json', nullable: true)]
    #[Groups(['card:read'])]
    private ?array $finishes = null;

    /** @var list<string>|null */
    #[ORM\Column(type: 'json', nullable: true)]
    #[Groups(['card:read'])]
    private ?array $games = null;

    #[ORM\Column(type: 'date_immutable', nullable: true)]
    #[Groups(['card:read'])]
    private ?\DateTimeImmutable $releasedAt = null;

    #[ORM\Column(length: 16, nullable: true)]
    #[Groups(['card:read'])]
    private ?string $lang = null;

    #[ORM\Column(length: 32, nullable: true)]
    #[Groups(['card:read'])]
    private ?string $layout = null;

    #[ORM\Column(length: 512, nullable: true)]
    #[Groups(['card:read'])]
    private ?string $scryfallUri = null;

    /**
     * Complete raw payload from Scryfall so no information is lost.
     *
     * @var array<string, mixed>|null
     */
    #[ORM\Column(type: 'json', nullable: true)]
    #[Groups(['card:read'])]
    private ?array $scryfallData = null;

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

    public function getSetName(): ?string
    {
        return $this->setName;
    }

    public function setSetName(?string $setName): static
    {
        $this->setName = $setName;

        return $this;
    }

    /** @return list<string>|null */
    public function getColors(): ?array
    {
        return $this->colors;
    }

    /** @param list<string>|null $colors */
    public function setColors(?array $colors): static
    {
        $this->colors = $colors;

        return $this;
    }

    /** @return list<string>|null */
    public function getColorIdentity(): ?array
    {
        return $this->colorIdentity;
    }

    /** @param list<string>|null $colorIdentity */
    public function setColorIdentity(?array $colorIdentity): static
    {
        $this->colorIdentity = $colorIdentity;

        return $this;
    }

    /** @return list<string>|null */
    public function getKeywords(): ?array
    {
        return $this->keywords;
    }

    /** @param list<string>|null $keywords */
    public function setKeywords(?array $keywords): static
    {
        $this->keywords = $keywords;

        return $this;
    }

    public function getPower(): ?string
    {
        return $this->power;
    }

    public function setPower(?string $power): static
    {
        $this->power = $power;

        return $this;
    }

    public function getToughness(): ?string
    {
        return $this->toughness;
    }

    public function setToughness(?string $toughness): static
    {
        $this->toughness = $toughness;

        return $this;
    }

    public function getLoyalty(): ?string
    {
        return $this->loyalty;
    }

    public function setLoyalty(?string $loyalty): static
    {
        $this->loyalty = $loyalty;

        return $this;
    }

    public function getArtist(): ?string
    {
        return $this->artist;
    }

    public function setArtist(?string $artist): static
    {
        $this->artist = $artist;

        return $this;
    }

    public function getFlavorText(): ?string
    {
        return $this->flavorText;
    }

    public function setFlavorText(?string $flavorText): static
    {
        $this->flavorText = $flavorText;

        return $this;
    }

    /** @return array<string, mixed>|null */
    public function getLegalities(): ?array
    {
        return $this->legalities;
    }

    /** @param array<string, mixed>|null $legalities */
    public function setLegalities(?array $legalities): static
    {
        $this->legalities = $legalities;

        return $this;
    }

    /** @return list<string>|null */
    public function getFinishes(): ?array
    {
        return $this->finishes;
    }

    /** @param list<string>|null $finishes */
    public function setFinishes(?array $finishes): static
    {
        $this->finishes = $finishes;

        return $this;
    }

    /** @return list<string>|null */
    public function getGames(): ?array
    {
        return $this->games;
    }

    /** @param list<string>|null $games */
    public function setGames(?array $games): static
    {
        $this->games = $games;

        return $this;
    }

    public function getReleasedAt(): ?\DateTimeImmutable
    {
        return $this->releasedAt;
    }

    public function setReleasedAt(?\DateTimeImmutable $releasedAt): static
    {
        $this->releasedAt = $releasedAt;

        return $this;
    }

    public function getLang(): ?string
    {
        return $this->lang;
    }

    public function setLang(?string $lang): static
    {
        $this->lang = $lang;

        return $this;
    }

    public function getLayout(): ?string
    {
        return $this->layout;
    }

    public function setLayout(?string $layout): static
    {
        $this->layout = $layout;

        return $this;
    }

    public function getScryfallUri(): ?string
    {
        return $this->scryfallUri;
    }

    public function setScryfallUri(?string $scryfallUri): static
    {
        $this->scryfallUri = $scryfallUri;

        return $this;
    }

    /** @return array<string, mixed>|null */
    public function getScryfallData(): ?array
    {
        return $this->scryfallData;
    }

    /** @param array<string, mixed>|null $scryfallData */
    public function setScryfallData(?array $scryfallData): static
    {
        $this->scryfallData = $scryfallData;

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
