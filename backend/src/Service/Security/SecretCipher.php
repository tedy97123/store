<?php

namespace App\Service\Security;

use Symfony\Component\DependencyInjection\ParameterBag\ParameterBagInterface;

final readonly class SecretCipher
{
    private const PREFIX = 'v1.';

    public function __construct(private ParameterBagInterface $parameters)
    {
    }

    public function encrypt(?string $plainText): ?string
    {
        if (null === $plainText || '' === $plainText) {
            return null;
        }

        $iv = random_bytes(12);
        $tag = '';
        $cipherText = openssl_encrypt(
            $plainText,
            'aes-256-gcm',
            $this->key(),
            OPENSSL_RAW_DATA,
            $iv,
            $tag,
        );

        if (false === $cipherText) {
            throw new \RuntimeException('Could not encrypt secret.');
        }

        return self::PREFIX.base64_encode($iv.$tag.$cipherText);
    }

    public function decrypt(?string $encrypted): ?string
    {
        if (null === $encrypted || '' === $encrypted) {
            return null;
        }

        if (!str_starts_with($encrypted, self::PREFIX)) {
            throw new \RuntimeException('Unsupported encrypted secret format.');
        }

        $raw = base64_decode(substr($encrypted, strlen(self::PREFIX)), true);
        if (false === $raw || strlen($raw) < 29) {
            throw new \RuntimeException('Encrypted secret is invalid.');
        }

        $iv = substr($raw, 0, 12);
        $tag = substr($raw, 12, 16);
        $cipherText = substr($raw, 28);

        $plainText = openssl_decrypt(
            $cipherText,
            'aes-256-gcm',
            $this->key(),
            OPENSSL_RAW_DATA,
            $iv,
            $tag,
        );

        if (false === $plainText) {
            throw new \RuntimeException('Could not decrypt secret.');
        }

        return $plainText;
    }

    private function key(): string
    {
        return hash('sha256', (string) $this->parameters->get('kernel.secret'), true);
    }
}
