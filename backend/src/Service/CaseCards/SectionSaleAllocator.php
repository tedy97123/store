<?php

namespace App\Service\CaseCards;

use App\Entity\InventoryItem;
use App\Entity\OrderLine;
use App\Repository\StoreSectionCardRepository;

/**
 * Attributes sales to case-section pools and reverses them on cancel/refund.
 *
 * When a purchased listing sits in a display-case section with unsold copies,
 * the sale comes "from the case": the section's pool depletes (never below
 * zero — a pool cannot be oversold), the order line records which section it
 * came from plus name snapshots for print sheets, and caseQuantity says how
 * many of the line's copies staff must pull from that section. Copies beyond
 * the pool are regular back-stock and stay unlabeled.
 *
 * A line is attributed to at most ONE section (the first open pool in case /
 * section display order), keeping fulfillment paperwork unambiguous.
 */
final class SectionSaleAllocator
{
    public function __construct(
        private readonly StoreSectionCardRepository $sectionCards,
    ) {
    }

    /** Claim up to $quantity copies from the first open pool holding this listing. */
    public function allocateLine(OrderLine $line, InventoryItem $item, int $quantity): void
    {
        if ($quantity < 1) {
            return;
        }

        foreach ($this->sectionCards->findOpenPoolsForItem($item) as $pool) {
            $take = min($quantity, $pool->remaining());
            if ($take < 1) {
                continue;
            }

            $pool->setSoldQuantity($pool->getSoldQuantity() + $take);

            $section = $pool->getSection();
            $line->setSectionCard($pool);
            $line->setCaseQuantity($take);
            $line->setSectionTitle($section?->getTitle());
            $line->setCaseName($section?->getStoreCase()?->getName());

            return;
        }
    }

    /**
     * Return a cancelled/refunded line's copies to its section pool. The
     * snapshots stay — the order's paperwork still shows where it came from.
     */
    public function releaseLine(OrderLine $line): void
    {
        $pool = $line->getSectionCard();
        if (null === $pool || $line->getCaseQuantity() < 1) {
            return;
        }

        $pool->setSoldQuantity(max(0, $pool->getSoldQuantity() - $line->getCaseQuantity()));
    }
}
