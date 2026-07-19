<?php

namespace App\Tests\Service\Catalog;

use App\Entity\Card;
use App\Service\Catalog\CatalogCardResolver;
use App\Tests\Support\CatalogFixtures;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;

/**
 * matchLocal() is the local-catalog leg of import resolution: it must find a
 * printing by its indexed natural key (set + collector number), reject wrong
 * names on the right key, and tolerate the multi-face name formats vendors
 * export — without ever hitting the network.
 */
final class CatalogCardResolverTest extends KernelTestCase
{
    private CatalogCardResolver $resolver;
    private CatalogFixtures $fixtures;

    protected function setUp(): void
    {
        self::bootKernel();
        $c = self::getContainer();
        $this->resolver = $c->get(CatalogCardResolver::class);
        $this->fixtures = new CatalogFixtures($c->get('doctrine')->getManager());
    }

    public function testMatchesByNaturalKey(): void
    {
        $this->fixtures->card(1, ['name' => 'Lightning Bolt', 'set' => 'clb', 'collector_number' => '187']);

        $match = $this->resolver->matchLocal('Lightning Bolt', 'clb', '187', 'common', 'nonfoil');

        self::assertInstanceOf(Card::class, $match);
        self::assertSame('Lightning Bolt', $match->getName());
    }

    public function testNaturalKeyMatchIsCaseAndWhitespaceInsensitive(): void
    {
        $this->fixtures->card(1, ['name' => 'Lightning Bolt', 'set' => 'clb', 'collector_number' => '187']);

        // Uppercase set, doubled internal whitespace, mixed-case name, foil finish.
        $match = $this->resolver->matchLocal('lightning  bolt', 'CLB', '187', 'common', 'foil');

        self::assertInstanceOf(Card::class, $match);
    }

    public function testRejectsWrongNameOnRightKey(): void
    {
        $this->fixtures->card(1, ['name' => 'Lightning Bolt', 'set' => 'clb', 'collector_number' => '187']);

        self::assertNull($this->resolver->matchLocal('Counterspell', 'clb', '187', '', 'nonfoil'));
    }

    public function testMissesWrongCollectorNumber(): void
    {
        $this->fixtures->card(1, ['name' => 'Lightning Bolt', 'set' => 'clb', 'collector_number' => '187']);

        self::assertNull($this->resolver->matchLocal('Lightning Bolt', 'clb', '999', '', 'nonfoil'));
    }

    #[DataProvider('splitCardNames')]
    public function testMatchesSplitCardNameVariants(string $rowName): void
    {
        $this->fixtures->card(1, ['name' => 'Fire // Ice', 'set' => 'mh2', 'collector_number' => '290']);

        self::assertInstanceOf(
            Card::class,
            $this->resolver->matchLocal($rowName, 'mh2', '290', 'common', 'nonfoil'),
            sprintf('Expected "%s" to match "Fire // Ice"', $rowName),
        );
    }

    /** @return iterable<string, array{string}> */
    public static function splitCardNames(): iterable
    {
        yield 'canonical spacing' => ['Fire // Ice'];
        yield 'no spacing' => ['Fire//Ice'];
        yield 'front face only' => ['Fire'];
    }

    public function testFallsBackToNameSearchWhenNoCollectorNumber(): void
    {
        $this->fixtures->card(1, ['name' => 'Sol Ring', 'set' => 'c21', 'collector_number' => '263']);

        // No collector number on the row → name-search fallback path.
        $match = $this->resolver->matchLocal('Sol Ring', 'c21', '', '', 'nonfoil');

        self::assertInstanceOf(Card::class, $match);
        self::assertSame('Sol Ring', $match->getName());
    }
}
