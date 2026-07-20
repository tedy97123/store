<?php

namespace App\Entity;

use App\Repository\StoreCaseRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;

/**
 * A physical display case in a store (e.g. "Front Counter Case", "Wall Case").
 * Each case is divided into StoreSections — its labeled areas ("Black",
 * "Rares $20+", …) — and each section is its own trackable pool of inventory.
 * Pull sheets and order print sheets reference the case + section pair so
 * staff know exactly where a sold card physically lives.
 */
#[ORM\Entity(repositoryClass: StoreCaseRepository::class)]
#[ORM\Table(name: 'store_cases')]
#[ORM\Index(columns: ['store_id', 'position'], name: 'idx_store_cases_store_position')]
class StoreCase
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?Store $store = null;

    #[ORM\Column(length: 120)]
    private string $name = '';

    #[ORM\Column]
    private int $position = 0;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    /** @var Collection<int, StoreSection> */
    #[ORM\OneToMany(mappedBy: 'storeCase', targetEntity: StoreSection::class, cascade: ['persist', 'remove'], orphanRemoval: true)]
    #[ORM\OrderBy(['position' => 'ASC', 'id' => 'ASC'])]
    private Collection $sections;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
        $this->sections = new ArrayCollection();
    }

    public function getId(): ?int { return $this->id; }

    public function getStore(): ?Store { return $this->store; }
    public function setStore(?Store $store): static { $this->store = $store; return $this; }

    public function getName(): string { return $this->name; }
    public function setName(string $name): static { $this->name = $name; return $this; }

    public function getPosition(): int { return $this->position; }
    public function setPosition(int $position): static { $this->position = $position; return $this; }

    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }

    /** @return Collection<int, StoreSection> */
    public function getSections(): Collection { return $this->sections; }

    public function addSection(StoreSection $section): static
    {
        if (!$this->sections->contains($section)) {
            $this->sections->add($section);
            $section->setStoreCase($this);
        }

        return $this;
    }
}
