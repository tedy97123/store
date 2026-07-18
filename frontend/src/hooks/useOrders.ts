import { useQuery } from '@tanstack/react-query'
import api, { unwrapCollection } from '../api/client'
import type { Order } from '../api/types'

/** React Query key for a store's orders. */
export const ordersKey = (slug: string) => ['orders', slug] as const

/** Server page size — must not exceed the API's itemsPerPage cap (200). */
const PAGE_SIZE = 200
/** Hard stop against a misbehaving server (200 × 100 = 20k orders). */
const MAX_PAGES = 100

/**
 * useOrders — fetch a store's orders. The API serves the collection in pages
 * (newest first, bounded response size); this hook walks the pages and
 * aggregates so the admin views keep receiving the complete list. Retries
 * are disabled so a not-yet-built backend endpoint (404/405) surfaces
 * immediately for the caller to handle.
 */
export function useOrders(slug: string) {
  return useQuery({
    queryKey: ordersKey(slug),
    enabled: Boolean(slug),
    retry: false,
    queryFn: async () => {
      const orders: Order[] = []
      for (let page = 1; page <= MAX_PAGES; page++) {
        const { data } = await api.get(`/stores/${slug}/orders`, {
          params: { page, itemsPerPage: PAGE_SIZE },
        })
        const chunk = unwrapCollection<Order>(data)
        orders.push(...chunk)
        // A short (or empty) page means we've reached the end.
        if (chunk.length < PAGE_SIZE) break
      }
      return orders
    },
  })
}

export default useOrders
