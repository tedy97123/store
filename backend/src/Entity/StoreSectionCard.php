<?php

namespace App\Entity;

use App\Repository\StoreSectionCardRepository;
use Doctrine\ORM\Mapping as ORM;

/**
 * One inventory listing placed in a StoreSection, at a given position. Cascades
 * away with its section, and with the underlying inventory listing (so a card
 * that leaves inventory silently drops out of every case section).
 */
#[ORM\Entity(repositoryClass: StoreSectionCardRepository::class)]
#[ORM\Table(name: 'store_section_cards')]
#[ORM\UniqueConstraint(name: 'uniq_section_inventory_item', columns: ['section_id', 'inventory_item_id'])]
class StoreSectionCard
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(inversedBy: 'cards')]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?StoreSection $section = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?InventoryItem $inventoryItem = null;

    #[ORM\Column]
    private int $position = 0;

    public function getId(): ?int { return $this->id; }

    public function getSection(): ?StoreSection { return $this->section; }
    public function setSection(?StoreSection $section): static { $this->section = $section; return $this; }

    public function getInventoryItem(): ?InventoryItem { return $this->inventoryItem; }
    public function setInventoryItem(?InventoryItem $item): static { $this->inventoryItem = $item; return $this; }

    public function getPosition(): int { return $this->position; }
    public function setPosition(int $position): static { $this->position = $position; return $this; }
}
