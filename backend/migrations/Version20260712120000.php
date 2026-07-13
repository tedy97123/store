<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260712120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Enterprise onboarding: store application status, business address, plan/subscription fields';
    }

    public function up(Schema $schema): void
    {
        // Application lifecycle. Existing rows are live stores → default 'approved'.
        $this->addSql("ALTER TABLE stores ADD status VARCHAR(16) DEFAULT 'approved' NOT NULL");
        $this->addSql('ALTER TABLE stores ADD rejection_reason TEXT DEFAULT NULL');

        // Business address.
        $this->addSql('ALTER TABLE stores ADD address_line1 VARCHAR(255) DEFAULT NULL');
        $this->addSql('ALTER TABLE stores ADD address_line2 VARCHAR(255) DEFAULT NULL');
        $this->addSql('ALTER TABLE stores ADD city VARCHAR(128) DEFAULT NULL');
        $this->addSql('ALTER TABLE stores ADD region VARCHAR(128) DEFAULT NULL');
        $this->addSql('ALTER TABLE stores ADD postal_code VARCHAR(32) DEFAULT NULL');
        $this->addSql('ALTER TABLE stores ADD country VARCHAR(2) DEFAULT NULL');
        $this->addSql('ALTER TABLE stores ADD phone VARCHAR(32) DEFAULT NULL');
        $this->addSql('ALTER TABLE stores ADD latitude DOUBLE PRECISION DEFAULT NULL');
        $this->addSql('ALTER TABLE stores ADD longitude DOUBLE PRECISION DEFAULT NULL');

        // Subscription plan / tier.
        $this->addSql('ALTER TABLE stores ADD plan_key VARCHAR(32) DEFAULT NULL');
        $this->addSql("ALTER TABLE stores ADD subscription_status VARCHAR(32) DEFAULT 'inactive' NOT NULL");
        $this->addSql('ALTER TABLE stores ADD payment_method_type VARCHAR(32) DEFAULT NULL');
        $this->addSql('ALTER TABLE stores ADD payment_reference VARCHAR(255) DEFAULT NULL');
        $this->addSql('ALTER TABLE stores ADD payment_last4 VARCHAR(8) DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE stores DROP status');
        $this->addSql('ALTER TABLE stores DROP rejection_reason');
        $this->addSql('ALTER TABLE stores DROP address_line1');
        $this->addSql('ALTER TABLE stores DROP address_line2');
        $this->addSql('ALTER TABLE stores DROP city');
        $this->addSql('ALTER TABLE stores DROP region');
        $this->addSql('ALTER TABLE stores DROP postal_code');
        $this->addSql('ALTER TABLE stores DROP country');
        $this->addSql('ALTER TABLE stores DROP phone');
        $this->addSql('ALTER TABLE stores DROP latitude');
        $this->addSql('ALTER TABLE stores DROP longitude');
        $this->addSql('ALTER TABLE stores DROP plan_key');
        $this->addSql('ALTER TABLE stores DROP subscription_status');
        $this->addSql('ALTER TABLE stores DROP payment_method_type');
        $this->addSql('ALTER TABLE stores DROP payment_reference');
        $this->addSql('ALTER TABLE stores DROP payment_last4');
    }
}
