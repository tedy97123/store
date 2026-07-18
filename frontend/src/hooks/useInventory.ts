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
 * collection in keyset pages (`?afterId=` cursor, bounded response size and
 * O(page) server cost); this hook walks the cursor and aggregates, so
 * consumers still get the complete array they always did. Keyset paging is
 * immune to items shifting between pages when concurrent edits land
 * mid-walk; results are deduped by id as a final defensive layer. The cache
 * is shared across the storefront, card details, and admin search so it
 * usually stays warm.
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
      const seen = new Map<number, InventoryItem>()
      let afterId = 0
      for (let page = 0; page < MAX_PAGES; page++) {
        const { data } = await api.get(`/stores/${slug}/inventory`, {
          params: { afterId, itemsPerPage: PAGE_SIZE },
        })
        const chunk = unwrapCollection<InventoryItem>(data)
        for (const item of chunk) {
          seen.set(item.id, item)
          if (item.id > afterId) afterId = item.id
        }
        // A short (or empty) page means we've reached the end.
        if (chunk.length < PAGE_SIZE) break
      }
      // Keyset pages arrive in id order; restore the name ordering the old
      // server response had (the storefront's default "featured" sort keeps
      // fetch order, so this preserves its behavior).
      return [...seen.values()].sort(
        (a, b) => a.card.name.localeCompare(b.card.name) || a.id - b.id,
      )
    },
  })
}

export default useInventory
