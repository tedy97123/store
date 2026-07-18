import { useQuery } from '@tanstack/react-query'
import api, { unwrapCollection } from '../api/client'
import type { InventoryItem } from '../api/types'

/** React Query key for a store's inventory — shared by the hook and invalidations. */
export const inventoryKey = (slug: string) => ['inventory', slug] as const

/** Server page size — must not exceed the API's itemsPerPage cap (500). */
const PAGE_SIZE = 500
/** Hard stop so a misbehaving server can never loop us forever (500 × 400 = 200k items). */
const MAX_PAGES = 400

/**
 * useInventory — fetch a store's full inventory listing. The API serves the
 * collection in pages (bounded response size / server memory); this hook
 * walks the pages sequentially and aggregates them, so consumers still get
 * the complete array they always did. The cache is shared across the
 * storefront, card details, and admin search so it usually stays warm.
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
      const items: InventoryItem[] = []
      for (let page = 1; page <= MAX_PAGES; page++) {
        const { data } = await api.get(`/stores/${slug}/inventory`, {
          params: { page, itemsPerPage: PAGE_SIZE },
        })
        const chunk = unwrapCollection<InventoryItem>(data)
        items.push(...chunk)
        // A short (or empty) page means we've reached the end.
        if (chunk.length < PAGE_SIZE) break
      }
      return items
    },
  })
}

export default useInventory
