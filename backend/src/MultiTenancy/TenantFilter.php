<?php

namespace App\MultiTenancy;

use App\Entity\InventoryItem;
use Doctrine\ORM\Mapping\ClassMetadata;
use Doctrine\ORM\Query\Filter\SQLFilter;

class TenantFilter extends SQLFilter
{
    public function addFilterConstraint(ClassMetadata $targetEntity, string $targetTableAlias): string
    {
        if (InventoryItem::class !== $targetEntity->getName()) {
            return '';
        }

        if (!$this->hasParameter('store_id')) {
            return '';
        }

        return sprintf('%s.store_id = %s', $targetTableAlias, $this->getParameter('store_id'));
    }
}
