<?php

namespace App\Tests\Service;

use App\Service\Catalog\CatalogCardResolver;
use App\Tests\Support\CatalogFixtures;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;

/**
 * CSV exports frequently carry full set NAMES where the importer expects set
 * CODES ("Adventures in the Forgotten Realms" vs "afr") — that mismatch used
 * to fail every lookup for such rows. normalizeSetCode() resolves names to
 * codes via the local catalog.
 */
final class SetCodeNormalizationTest extends KernelTestCase
{
    private CatalogCardResolver $resolver;
    private CatalogFixtures $fixtures;

    protected function setUp(): void
    {
        self::bootKernel();
        $c = static::getContainer();
        $this->resolver = $c->get(CatalogCardResolver::class);
        $this->fixtures = new CatalogFixtures($c->get(EntityManagerInterface::class));
    }

    public function testResolvesFullSetNameToCode(): void
    {
        $this->fixtures->card(9101, ['set' => 'afr', 'set_name' => 'Adventures in the Forgotten Realms']);

        self::assertSame('afr', $this->resolver->normalizeSetCode('Adventures in the Forgotten Realms'));
        self::assertSame('afr', $this->resolver->normalizeSetCode('ADVENTURES IN THE FORGOTTEN REALMS'));
    }

    public function testKeepsKnownSetCodes(): void
    {
        $this->fixtures->card(9102, ['set' => 'neo', 'set_name' => 'Kamigawa: Neon Dynasty']);

        self::assertSame('neo', $this->resolver->normalizeSetCode('neo'));
        self::assertSame('NEO', $this->resolver->normalizeSetCode('NEO'), 'known codes pass through untouched');
    }

    public function testUnknownValuesPassThroughForRemoteLookups(): void
    {
        self::assertSame('zzz', $this->resolver->normalizeSetCode('zzz'));
        self::assertSame('Totally Unknown Set', $this->resolver->normalizeSetCode('Totally Unknown Set'));
        self::assertSame('', $this->resolver->normalizeSetCode('  '));
    }

    public function testShortNameShapedValueStillResolves(): void
    {
        // A code-shaped string that is NOT a known code but IS a set name.
        $this->fixtures->card(9103, ['set' => 'lea', 'set_name' => 'Alpha']);

        self::assertSame('lea', $this->resolver->normalizeSetCode('Alpha'));
    }
}
