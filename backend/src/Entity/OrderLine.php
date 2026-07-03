<?php

namespace App\Entity;

use App\Repository\OrderLineRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Validator\Constraints as Assert;

#[ORM\Entity(repositoryClass: OrderLineRepository::class)]
#[ORM\Table(name: 'order_lines')]
class OrderLine
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['order:read'])]
    private ?int $id = null;

    #[ORM\ManyToOne(inversedBy: 'lines')]
    #[ORM\JoinColumn(name: 'order_id', nullable: false)]
    private ?Order $parentOrder = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    #[Groups(['order:read'])]
    private ?Card $card = null;

    #[ORM\Column(length: 255)]
    #[Groups(['order:read'])]
    private string $cardName = '';

    #[ORM\Column]
    #[Assert\Positive]
    #[Groups(['order:read'])]
    private int $quantity = 1;

    #[ORM\Column]
    #[Assert\PositiveOrZero]
    #[Groups(['order:read'])]
    private int $priceCents = 0;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getParentOrder(): ?Order
    {
        return $this->parentOrder;
    }

    public function setParentOrder(?Order $parentOrder): static
    {
        $this->parentOrder = $parentOrder;

        return $this;
    }

    public function getCard(): ?Card
    {
        return $this->card;
    }

    public function setCard(?Card $card): static
    {
        $this->card = $card;

        return $this;
    }

    public function getCardName(): string
    {
        return $this->cardName;
    }

    public function setCardName(string $cardName): static
    {
        $this->cardName = $cardName;

        return $this;
    }

    public function getQuantity(): int
    {
        return $this->quantity;
    }

    public function setQuantity(int $quantity): static
    {
        $this->quantity = $quantity;

        return $this;
    }

    public function getPriceCents(): int
    {
        return $this->priceCents;
    }

    public function setPriceCents(int $priceCents): static
    {
        $this->priceCents = $priceCents;

        return $this;
    }

    /** @return array<string, mixed>|null */
    #[Groups(['order:read'])]
    public function getImageUris(): ?array
    {
        return $this->card?->getImageUris();
    }

    #[Groups(['order:read'])]
    public function getSetCode(): ?string
    {
        return $this->card?->getSetCode();
    }

    #[Groups(['order:read'])]
    public function getCollectorNumber(): ?string
    {
        return $this->card?->getCollectorNumber();
    }
}
