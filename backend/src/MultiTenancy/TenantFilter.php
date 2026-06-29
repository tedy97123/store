<?php

namespace App\MultiTenancy;

use App\Entity\InventoryItem;
use App\Entity\Order;
use Doctrine\ORM\Mapping\ClassMetadata;
use Doctrine\ORM\Query\Filter\SQLFilter;

class TenantFilter extends SQLFilter
{
    private const TENANT_SCOPED = [
        InventoryItem::class => true,
        Order::class => true,
    ];

    public function addFilterConstraint(ClassMetadata $targetEntity, string $targetTableAlias): string
    {
        if (!isset(self::TENANT_SCOPED[$targetEntity->getName()])) {
            return '';
        }

        if (!$this->hasParameter('store_id')) {
            return '';
        }

        return sprintf('%s.store_id = %s', $targetTableAlias, $this->getParameter('store_id'));
    }
}
