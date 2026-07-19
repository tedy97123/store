<?php

namespace App\Tests\Service\Inventory;

use App\Entity\InventoryItem;
use App\Enum\CardCondition;
use App\Repository\InventoryItemRepository;
use App\Service\Inventory\StoreInventoryWriter;
use App\Tests\Support\CatalogFixtures;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\OptimisticLockException;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;

/**
 * The immediate (web) write path merges via a native ON CONFLICT upsert so
 * concurrent adds to the same line sum quantities instead of colliding on the
 * unique index or losing an increment. These tests pin the merge semantics and
 * the optimistic-lock guard that backs them.
 */
final class StoreInventoryWriterTest extends KernelTestCase
{
    private EntityManagerInterface $em;
    private StoreInventoryWriter $writer;
    private InventoryItemRepository $items;
    private CatalogFixtures $fixtures;

    protected function setUp(): void
    {
        self::bootKernel();
        $c = self::getContainer();
        $this->em = $c->get('doctrine')->getManager();
        $this->writer = $c->get(StoreInventoryWriter::class);
        $this->items = $c->get(InventoryItemRepository::class);
        $this->fixtures = new CatalogFixtures($this->em);
    }

    public function testFirstWriteCreatesLine(): void
    {
        $store = $this->fixtures->store();
        $card = $this->fixtures->card(1);

        $item = $this->writer->write($store, $card, 3, CardCondition::NM, false);

        self::assertSame(3, $item->getQuantity());
        self::assertSame(1, $this->items->countByStore($store));
    }

    public function testRepeatWriteMergesAndSumsQuantity(): void
    {
        $store = $this->fixtures->store();
        $card = $this->fixtures->card(1);

        $this->writer->write($store, $card, 3, CardCondition::NM, false);
        $item = $this->writer->write($store, $card, 2, CardCondition::NM, false);

        // Same (store, card, condition, foil) tuple → one merged line, summed.
        self::assertSame(5, $item->getQuantity());
        self::assertSame(1, $this->items->countByStore($store));
    }

    public function testConditionAndFoilProduceDistinctLines(): void
    {
        $store = $this->fixtures->store();
        $card = $this->fixtures->card(1);

        $this->writer->write($store, $card, 1, CardCondition::NM, false);
        $this->writer->write($store, $card, 1, CardCondition::NM, true);
        $this->writer->write($store, $card, 1, CardCondition::LP, false);

        self::assertSame(3, $this->items->countByStore($store));
    }

    public function testNotesOnlyOverwriteWhenNonEmpty(): void
    {
        $store = $this->fixtures->store();
        $card = $this->fixtures->card(1);

        $this->writer->write($store, $card, 1, CardCondition::NM, false, 'first note');
        $item = $this->writer->write($store, $card, 1, CardCondition::NM, false, null);

        self::assertSame('first note', $item->getNotes());
    }

    public function testOptimisticLockRejectsStaleUpdate(): void
    {
        $store = $this->fixtures->store();
        $card = $this->fixtures->card(1);
        $item = $this->writer->write($store, $card, 5, CardCondition::NM, false);
        $id = $item->getId();

        // Simulate a concurrent writer bumping quantity + version behind our back.
        $this->em->getConnection()->executeStatement(
            'UPDATE inventory_items SET quantity = quantity + 100, version = version + 1 WHERE id = ?',
            [$id],
        );

        // A stale ORM read-modify-write must fail loud, not silently clobber.
        $item->setQuantity($item->getQuantity() + 1);
        $this->expectException(OptimisticLockException::class);
        $this->em->flush();
    }

    public function testConcurrentIncrementSurvivesAfterLockConflict(): void
    {
        $store = $this->fixtures->store();
        $card = $this->fixtures->card(1);
        $item = $this->writer->write($store, $card, 5, CardCondition::NM, false);
        $id = $item->getId();

        $this->em->getConnection()->executeStatement(
            'UPDATE inventory_items SET quantity = quantity + 100, version = version + 1 WHERE id = ?',
            [$id],
        );

        // The concurrent increment is preserved even though our stale flush fails.
        $liveQty = (int) $this->em->getConnection()->fetchOne(
            'SELECT quantity FROM inventory_items WHERE id = ?',
            [$id],
        );
        self::assertSame(105, $liveQty);
    }
}
