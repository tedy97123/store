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
