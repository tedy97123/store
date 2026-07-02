<?php

namespace App\Entity;

use App\Repository\CartItemRepository;
use Doctrine\ORM\Mapping as ORM;

/**
 * One line in a customer's per-store shopping cart: an inventory listing plus
 * the number of copies wanted. Quantity is clamped to available stock at write time.
 */
#[ORM\Entity(repositoryClass: CartItemRepository::class)]
#[ORM\Table(name: 'cart_items')]
#[ORM\UniqueConstraint(name: 'UNIQ_CART_CUSTOMER_ITEM', fields: ['customer', 'inventoryItem'])]
class CartItem
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(inversedBy: 'cartItems')]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?StoreCustomer $customer = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?InventoryItem $inventoryItem = null;

    #[ORM\Column]
    private int $quantity = 1;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column]
    private \DateTimeImmutable $updatedAt;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
        $this->updatedAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getCustomer(): ?StoreCustomer
    {
        return $this->customer;
    }

    public function setCustomer(?StoreCustomer $customer): static
    {
        $this->customer = $customer;

        return $this;
    }

    public function getInventoryItem(): ?InventoryItem
    {
        return $this->inventoryItem;
    }

    public function setInventoryItem(?InventoryItem $inventoryItem): static
    {
        $this->inventoryItem = $inventoryItem;

        return $this;
    }

    public function getQuantity(): int
    {
        return $this->quantity;
    }

    public function setQuantity(int $quantity): static
    {
        $this->quantity = max(1, $quantity);
        $this->updatedAt = new \DateTimeImmutable();

        return $this;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function getUpdatedAt(): \DateTimeImmutable
    {
        return $this->updatedAt;
    }
}
