import { useQuery } from '@tanstack/react-query'
import api, { unwrapCollection } from '../api/client'
import type { InventoryItem } from '../api/types'

/** React Query key for a store's inventory — shared by the hook and invalidations. */
export const inventoryKey = (slug: string) => ['inventory', slug] as const

/**
 * useInventory — fetch a store's full inventory listing. The cache is shared
 * across the storefront, card details, and admin search so it usually stays warm.
 */
export function useInventory(slug: string) {
  return useQuery({
    queryKey: inventoryKey(slug),
    enabled: Boolean(slug),
    // Inventory is a large payload and rarely changes mid-session; keep it fresh
    // for a few minutes so moving between the storefront, a card's details, and
    // the cart reuses the cache instead of refetching the whole list each time.
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await api.get(`/stores/${slug}/inventory`)
      return unwrapCollection<InventoryItem>(data)
    },
  })
}

export default useInventory
