<?php

namespace App\MultiTenancy;

use App\Entity\Store;

class TenantContext
{
    private ?Store $store = null;
    private bool $filterEnabled = true;

    public function setStore(?Store $store): void
    {
        $this->store = $store;
    }

    public function getStore(): ?Store
    {
        return $this->store;
    }

    public function disableFilter(): void
    {
        $this->filterEnabled = false;
    }

    public function enableFilter(): void
    {
        $this->filterEnabled = true;
    }

    public function isFilterEnabled(): bool
    {
        return $this->filterEnabled;
    }

    public function clear(): void
    {
        $this->store = null;
        $this->filterEnabled = true;
    }
}
