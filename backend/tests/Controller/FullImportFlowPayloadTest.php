<?php

namespace App\Tests\Controller;

use App\Entity\Game;
use App\Message\ProcessCsvImportMessage;
use App\MessageHandler\ProcessCsvImportMessageHandler;
use App\Repository\CardRepository;
use App\Repository\GameSetRepository;
use App\Repository\SealedProductRepository;
use App\Service\Doctrine\SqlDebugLogPruner;
use App\Service\Tcgcsv\CatalogSynchronizer;
use App\Service\Tcgcsv\TcgcsvClient;
use App\Tests\Support\CatalogFixtures;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Psr\Log\NullLogger;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;
use Symfony\Component\HttpFoundation\File\UploadedFile;

final class FullImportFlowPayloadTest extends WebTestCase
{
    public function testCsvImportedPokemonItemsCarryGameCodeInTheWalk(): void
    {
        $client = static::createClient();
        $c = static::getContainer();
        $em = $c->get('doctrine')->getManager();
        $fixtures = new CatalogFixtures($em);
        $store = $fixtures->store();

        // Mock Pokemon sync: the two AZ printings from the user's store.
        $http = new MockHttpClient(function (string $method, string $url): MockResponse {
            if (str_ends_with($url, '/3/groups')) {
                return new MockResponse(json_encode(['results' => [
                    ['groupId' => 1522, 'name' => 'Phantom Forces', 'abbreviation' => 'PHF'],
                ]]));
            }
            if (str_ends_with($url, '/products')) {
                return new MockResponse(json_encode(['results' => [
                    ['productId' => 95001, 'name' => 'AZ', 'extendedData' => [['name' => 'Number', 'value' => '91/119']]],
                    ['productId' => 95002, 'name' => 'AZ (117 Full Art)', 'extendedData' => [['name' => 'Number', 'value' => '117/119']]],
                ]]));
            }

            return new MockResponse(json_encode(['results' => []]));
        }, 'https://tcgcsv.com/tcgplayer/');
        $game = $em->getRepository(Game::class)->findOneBy(['code' => 'pokemon']);
        (new CatalogSynchronizer(
            new TcgcsvClient($http, requestIntervalUs: 0),
            $em,
            $c->get(GameSetRepository::class),
            $c->get(SealedProductRepository::class),
            $c->get(CardRepository::class),
            new SqlDebugLogPruner(),
            new NullLogger(),
        ))->sync($game);

        // CSV import, exactly as the wizard does it.
        $bearer = $c->get(JWTTokenManagerInterface::class)->create($store->getOwner());
        $csv = "name,game,set,condition,foil,rarity,quantity,variant,collectorNumber\n"
            ."AZ,Pokemon,Phantom Forces,NM,No,Uncommon,1,,91/119\n"
            ."AZ (117 Full Art),Pokemon,Phantom Forces,NM,No,Ultra Rare,1,,117/119\n";
        $path = tempnam(sys_get_temp_dir(), 'import').'.csv';
        file_put_contents($path, $csv);
        $client->request('POST', "/api/stores/{$store->getSlug()}/csv-imports",
            parameters: ['game' => 'pokemon', 'type' => 'cards'],
            files: ['file' => new UploadedFile($path, 'poke.csv', 'text/csv', null, true)],
            server: ['HTTP_AUTHORIZATION' => 'Bearer '.$bearer],
        );
        $job = json_decode((string) $client->getResponse()->getContent(), true);
        $c->get(ProcessCsvImportMessageHandler::class)(new ProcessCsvImportMessage($job['id']));

        // The EXACT request the admin and storefront both make.
        $client->request('GET', "/api/stores/{$store->getSlug()}/inventory?afterId=0&itemsPerPage=500");
        $data = json_decode((string) $client->getResponse()->getContent(), true);
        $items = $data['member'] ?? $data['hydra:member'] ?? $data;

        fwrite(STDERR, "\n=== WALK PAYLOAD ===\n");
        foreach ($items as $item) {
            fwrite(STDERR, sprintf(
                "item#%s card=%s gameCode=%s finish=%s\n",
                $item['id'] ?? '?',
                $item['card']['name'] ?? '?',
                var_export($item['card']['gameCode'] ?? null, true),
                var_export($item['finish'] ?? null, true),
            ));
        }

        self::assertCount(2, $items);
        foreach ($items as $item) {
            self::assertSame('pokemon', $item['card']['gameCode'] ?? '(ABSENT)', $item['card']['name'] ?? '?');
        }
    }
}
