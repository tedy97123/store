<?php

namespace App\Service\Store;

use App\Entity\Store;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Email;

/**
 * Notifies a store owner about the outcome of their onboarding application.
 * Failures are the caller's concern to swallow — a mail hiccup must never block
 * an approval. Configure the from-address and storefront URL via env
 * (APP_MAIL_FROM, APP_FRONTEND_URL).
 */
final class StoreApplicationMailer
{
    public function __construct(private readonly MailerInterface $mailer)
    {
    }

    public function sendApproved(Store $store): void
    {
        $to = $store->getOwner()?->getEmail();
        if (null === $to || '' === $to) {
            return;
        }

        $name = $store->getName() ?? 'Your store';
        $storeUrl = $this->frontendUrl().'/s/'.$store->getSlug();
        $adminUrl = $storeUrl.'/admin';

        $this->mailer->send(
            (new Email())
                ->from($this->from())
                ->to($to)
                ->subject(sprintf('%s is approved and live 🎉', $name))
                ->text(
                    sprintf(
                        "Great news — %s has been approved and is now live on the marketplace.\n\n".
                        "View your storefront: %s\n".
                        "Manage inventory, orders, and branding: %s\n\n".
                        "Welcome aboard!",
                        $name,
                        $storeUrl,
                        $adminUrl,
                    ),
                )
                ->html($this->approvedHtml($name, $storeUrl, $adminUrl)),
        );
    }

    public function sendRejected(Store $store, ?string $reason): void
    {
        $to = $store->getOwner()?->getEmail();
        if (null === $to || '' === $to) {
            return;
        }

        $name = $store->getName() ?? 'Your store';
        $reasonLine = null !== $reason && '' !== trim($reason)
            ? "Reviewer notes: ".$reason
            : 'Please review your details and reach out if you have questions.';

        $this->mailer->send(
            (new Email())
                ->from($this->from())
                ->to($to)
                ->subject(sprintf('Update on your store application: %s', $name))
                ->text(sprintf("Thanks for applying with %s.\n\n%s\n", $name, $reasonLine)),
        );
    }

    private function approvedHtml(string $name, string $storeUrl, string $adminUrl): string
    {
        return sprintf(
            '<div style="font-family:system-ui,sans-serif;line-height:1.6">'.
            '<h2>%s is live 🎉</h2>'.
            '<p>Your store has been approved and is now on the marketplace.</p>'.
            '<p><a href="%s">View your storefront</a> &nbsp;·&nbsp; <a href="%s">Open your dashboard</a></p>'.
            '<p>Welcome aboard!</p></div>',
            htmlspecialchars($name),
            htmlspecialchars($storeUrl),
            htmlspecialchars($adminUrl),
        );
    }

    private function from(): string
    {
        $from = trim((string) ($_ENV['APP_MAIL_FROM'] ?? $_SERVER['APP_MAIL_FROM'] ?? ''));

        return '' !== $from ? $from : 'no-reply@marketplace.local';
    }

    private function frontendUrl(): string
    {
        $url = trim((string) ($_ENV['APP_FRONTEND_URL'] ?? $_SERVER['APP_FRONTEND_URL'] ?? ''));

        return rtrim('' !== $url ? $url : 'http://localhost:5173', '/');
    }
}
