<?php

namespace App\Entity;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Post;
use App\Repository\StoreRepository;
use App\State\ActiveStoreCollectionProvider;
use App\State\StoreAdminProcessor;
use App\State\StoreBySlugProvider;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Validator\Constraints as Assert;

#[ORM\Entity(repositoryClass: StoreRepository::class)]
#[ORM\Table(name: 'stores')]
#[ORM\UniqueConstraint(name: 'UNIQ_STORE_SLUG', fields: ['slug'])]
#[ApiResource(
    operations: [
        new GetCollection(
            uriTemplate: '/stores',
            normalizationContext: ['groups' => ['store:read']],
            provider: ActiveStoreCollectionProvider::class,
        ),
        new Get(
            uriTemplate: '/stores/{slug}',
            uriVariables: ['slug'],
            normalizationContext: ['groups' => ['store:read']],
            provider: StoreBySlugProvider::class,
        ),
        new GetCollection(
            uriTemplate: '/admin/stores',
            security: "is_granted('ROLE_SUPER_ADMIN')",
            normalizationContext: ['groups' => ['store:read', 'store:admin']],
        ),
        new Post(
            uriTemplate: '/admin/stores',
            security: "is_granted('ROLE_SUPER_ADMIN')",
            normalizationContext: ['groups' => ['store:read', 'store:admin']],
            denormalizationContext: ['groups' => ['store:admin_write']],
            processor: StoreAdminProcessor::class,
        ),
        new Patch(
            uriTemplate: '/admin/stores/{id}',
            security: "is_granted('ROLE_SUPER_ADMIN')",
            normalizationContext: ['groups' => ['store:read', 'store:admin']],
            denormalizationContext: ['groups' => ['store:admin_write']],
            processor: StoreAdminProcessor::class,
        ),
        new Delete(
            uriTemplate: '/admin/stores/{id}',
            security: "is_granted('ROLE_SUPER_ADMIN')",
        ),
    ],
)]
class Store
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['store:read', 'store:admin', 'inventory:read', 'user:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    #[Assert\NotBlank]
    #[Groups(['store:read', 'store:admin', 'store:admin_write', 'inventory:read', 'user:read'])]
    private ?string $name = null;

    #[ORM\Column(length: 255)]
    #[Assert\NotBlank]
    #[Assert\Regex(pattern: '/^[a-z0-9-]+$/', message: 'Slug must be lowercase alphanumeric with hyphens.')]
    #[Groups(['store:read', 'store:admin', 'store:admin_write', 'inventory:read', 'user:read'])]
    private ?string $slug = null;

    #[ORM\ManyToOne(inversedBy: 'ownedStores')]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['store:read', 'store:admin', 'store:admin_write'])]
    private ?User $owner = null;

    #[ORM\Column]
    #[Groups(['store:read', 'store:admin', 'store:admin_write'])]
    private bool $isActive = true;

    /** Marketplace hero spotlight — chosen by a platform admin. */
    #[ORM\Column(options: ['default' => false])]
    #[Groups(['store:read', 'store:admin', 'store:admin_write'])]
    private bool $featured = false;

    #[ORM\Column(options: ['default' => 1000])]
    #[Assert\PositiveOrZero]
    #[Groups(['store:read', 'store:admin', 'store:admin_write'])]
    private int $spotlightMinPriceCents = 1000;

    // --- Storefront branding (managed by the owner via /settings) ---

    #[ORM\Column(length: 7, nullable: true)]
    #[Assert\Regex(pattern: '/^#[0-9a-fA-F]{6}$/', message: 'Use a 6-digit hex color like #6d5efc.')]
    #[Groups(['store:read', 'store:admin'])]
    private ?string $primaryColor = null;

    #[ORM\Column(length: 7, nullable: true)]
    #[Assert\Regex(pattern: '/^#[0-9a-fA-F]{6}$/', message: 'Use a 6-digit hex color like #ff7a59.')]
    #[Groups(['store:read', 'store:admin'])]
    private ?string $accentColor = null;

    #[ORM\Column(length: 7, nullable: true)]
    #[Assert\Regex(pattern: '/^#[0-9a-fA-F]{6}$/', message: 'Use a 6-digit hex color like #f7f8fa.')]
    #[Groups(['store:read', 'store:admin'])]
    private ?string $backgroundColor = null;

    #[ORM\Column(length: 7, nullable: true)]
    #[Assert\Regex(pattern: '/^#[0-9a-fA-F]{6}$/', message: 'Use a 6-digit hex color like #ffffff.')]
    #[Groups(['store:read', 'store:admin'])]
    private ?string $surfaceColor = null;

    #[ORM\Column(length: 7, nullable: true)]
    #[Assert\Regex(pattern: '/^#[0-9a-fA-F]{6}$/', message: 'Use a 6-digit hex color like #0f172a.')]
    #[Groups(['store:read', 'store:admin'])]
    private ?string $textColor = null;

    #[ORM\Column(length: 7, nullable: true)]
    #[Assert\Regex(pattern: '/^#[0-9a-fA-F]{6}$/', message: 'Use a 6-digit hex color like #64748b.')]
    #[Groups(['store:read', 'store:admin'])]
    private ?string $mutedColor = null;

    #[ORM\Column(length: 7, nullable: true)]
    #[Assert\Regex(pattern: '/^#[0-9a-fA-F]{6}$/', message: 'Use a 6-digit hex color like #e7e9ee.')]
    #[Groups(['store:read', 'store:admin'])]
    private ?string $borderColor = null;

    #[ORM\Column(length: 1024, nullable: true)]
    #[Groups(['store:read', 'store:admin'])]
    private ?string $logoUrl = null;

    #[ORM\Column(length: 1024, nullable: true)]
    #[Groups(['store:read', 'store:admin'])]
    private ?string $heroImageUrl = null;

    #[ORM\Column(length: 160, nullable: true)]
    #[Groups(['store:read', 'store:admin'])]
    private ?string $heroHeading = null;

    #[ORM\Column(type: 'text', nullable: true)]
    #[Groups(['store:read', 'store:admin'])]
    private ?string $heroSubheading = null;

    #[ORM\Column(length: 160, nullable: true)]
    #[Groups(['store:read', 'store:admin'])]
    private ?string $tagline = null;

    #[ORM\Column]
    #[Groups(['store:read', 'store:admin'])]
    private \DateTimeImmutable $createdAt;

    /** @var Collection<int, InventoryItem> */
    #[ORM\OneToMany(mappedBy: 'store', targetEntity: InventoryItem::class, orphanRemoval: true)]
    private Collection $inventoryItems;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
        $this->inventoryItems = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getName(): ?string
    {
        return $this->name;
    }

    public function setName(string $name): static
    {
        $this->name = $name;

        return $this;
    }

    public function getSlug(): ?string
    {
        return $this->slug;
    }

    public function setSlug(string $slug): static
    {
        $this->slug = $slug;

        return $this;
    }

    public function getOwner(): ?User
    {
        return $this->owner;
    }

    public function setOwner(?User $owner): static
    {
        $this->owner = $owner;

        return $this;
    }

    public function isActive(): bool
    {
        return $this->isActive;
    }

    public function setIsActive(bool $isActive): static
    {
        $this->isActive = $isActive;

        return $this;
    }

    public function isFeatured(): bool
    {
        return $this->featured;
    }

    public function setFeatured(bool $featured): static
    {
        $this->featured = $featured;

        return $this;
    }

    public function getSpotlightMinPriceCents(): int
    {
        return $this->spotlightMinPriceCents;
    }

    public function setSpotlightMinPriceCents(int $spotlightMinPriceCents): static
    {
        $this->spotlightMinPriceCents = $spotlightMinPriceCents;

        return $this;
    }

    public function getPrimaryColor(): ?string
    {
        return $this->primaryColor;
    }

    public function setPrimaryColor(?string $primaryColor): static
    {
        $this->primaryColor = $primaryColor;

        return $this;
    }

    public function getAccentColor(): ?string
    {
        return $this->accentColor;
    }

    public function setAccentColor(?string $accentColor): static
    {
        $this->accentColor = $accentColor;

        return $this;
    }

    public function getBackgroundColor(): ?string
    {
        return $this->backgroundColor;
    }

    public function setBackgroundColor(?string $backgroundColor): static
    {
        $this->backgroundColor = $backgroundColor;

        return $this;
    }

    public function getSurfaceColor(): ?string
    {
        return $this->surfaceColor;
    }

    public function setSurfaceColor(?string $surfaceColor): static
    {
        $this->surfaceColor = $surfaceColor;

        return $this;
    }

    public function getTextColor(): ?string
    {
        return $this->textColor;
    }

    public function setTextColor(?string $textColor): static
    {
        $this->textColor = $textColor;

        return $this;
    }

    public function getMutedColor(): ?string
    {
        return $this->mutedColor;
    }

    public function setMutedColor(?string $mutedColor): static
    {
        $this->mutedColor = $mutedColor;

        return $this;
    }

    public function getBorderColor(): ?string
    {
        return $this->borderColor;
    }

    public function setBorderColor(?string $borderColor): static
    {
        $this->borderColor = $borderColor;

        return $this;
    }

    public function getLogoUrl(): ?string
    {
        return $this->logoUrl;
    }

    public function setLogoUrl(?string $logoUrl): static
    {
        $this->logoUrl = $logoUrl;

        return $this;
    }

    public function getHeroImageUrl(): ?string
    {
        return $this->heroImageUrl;
    }

    public function setHeroImageUrl(?string $heroImageUrl): static
    {
        $this->heroImageUrl = $heroImageUrl;

        return $this;
    }

    public function getHeroHeading(): ?string
    {
        return $this->heroHeading;
    }

    public function setHeroHeading(?string $heroHeading): static
    {
        $this->heroHeading = $heroHeading;

        return $this;
    }

    public function getHeroSubheading(): ?string
    {
        return $this->heroSubheading;
    }

    public function setHeroSubheading(?string $heroSubheading): static
    {
        $this->heroSubheading = $heroSubheading;

        return $this;
    }

    public function getTagline(): ?string
    {
        return $this->tagline;
    }

    public function setTagline(?string $tagline): static
    {
        $this->tagline = $tagline;

        return $this;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    /** @return Collection<int, InventoryItem> */
    public function getInventoryItems(): Collection
    {
        return $this->inventoryItems;
    }
}
