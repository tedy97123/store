<?php

namespace App\Entity;

use App\Repository\StoreSectionRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;

/**
 * A "case card" section on a store's public Case Cards page: a named, ordered
 * group of the store's inventory listings.
 *
 * A section is filled one of two ways (see MODE_*):
 *  - manual: the owner searches their inventory and hand-picks listings;
 *  - auto:   the owner sets a price range + rarity and clicks "Pull from
 *            inventory", which materialises matching listings into the section
 *            (editable afterwards; re-pullable to refresh).
 *
 * Either way the section ends up as a concrete, ordered list of
 * StoreSectionCard rows, so rendering the public page is a simple read.
 */
#[ORM\Entity(repositoryClass: StoreSectionRepository::class)]
#[ORM\Table(name: 'store_sections')]
#[ORM\Index(columns: ['store_id', 'position'], name: 'idx_store_sections_store_position')]
class StoreSection
{
    public const MODE_MANUAL = 'manual';
    public const MODE_AUTO = 'auto';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?Store $store = null;

    #[ORM\Column(length: 120)]
    private string $title = '';

    #[ORM\Column]
    private int $position = 0;

    #[ORM\Column(length: 16)]
    private string $mode = self::MODE_MANUAL;

    #[ORM\Column(nullable: true)]
    private ?int $autoMinPriceCents = null;

    #[ORM\Column(nullable: true)]
    private ?int $autoMaxPriceCents = null;

    #[ORM\Column(length: 20, nullable: true)]
    private ?string $autoRarity = null;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    /** @var Collection<int, StoreSectionCard> */
    #[ORM\OneToMany(mappedBy: 'section', targetEntity: StoreSectionCard::class, cascade: ['persist', 'remove'], orphanRemoval: true)]
    #[ORM\OrderBy(['position' => 'ASC', 'id' => 'ASC'])]
    private Collection $cards;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
        $this->cards = new ArrayCollection();
    }

    public function getId(): ?int { return $this->id; }

    public function getStore(): ?Store { return $this->store; }
    public function setStore(?Store $store): static { $this->store = $store; return $this; }

    public function getTitle(): string { return $this->title; }
    public function setTitle(string $title): static { $this->title = $title; return $this; }

    public function getPosition(): int { return $this->position; }
    public function setPosition(int $position): static { $this->position = $position; return $this; }

    public function getMode(): string { return $this->mode; }
    public function setMode(string $mode): static { $this->mode = $mode; return $this; }

    public function getAutoMinPriceCents(): ?int { return $this->autoMinPriceCents; }
    public function setAutoMinPriceCents(?int $cents): static { $this->autoMinPriceCents = $cents; return $this; }

    public function getAutoMaxPriceCents(): ?int { return $this->autoMaxPriceCents; }
    public function setAutoMaxPriceCents(?int $cents): static { $this->autoMaxPriceCents = $cents; return $this; }

    public function getAutoRarity(): ?string { return $this->autoRarity; }
    public function setAutoRarity(?string $rarity): static { $this->autoRarity = $rarity; return $this; }

    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }

    /** @return Collection<int, StoreSectionCard> */
    public function getCards(): Collection { return $this->cards; }

    public function addCard(StoreSectionCard $card): static
    {
        if (!$this->cards->contains($card)) {
            $this->cards->add($card);
            $card->setSection($this);
        }

        return $this;
    }

    public function removeCard(StoreSectionCard $card): static
    {
        $this->cards->removeElement($card);

        return $this;
    }

    public function clearCards(): void
    {
        $this->cards->clear();
    }
}
