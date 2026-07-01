import { useQuery } from '@tanstack/react-query'
import api, { unwrapCollection } from '../api/client'
import type { Order } from '../api/types'

/** React Query key for a store's orders. */
export const ordersKey = (slug: string) => ['orders', slug] as const

/**
 * useOrders — fetch a store's orders. Retries are disabled so a not-yet-built
 * backend endpoint (404/405) surfaces immediately for the caller to handle.
 */
export function useOrders(slug: string) {
  return useQuery({
    queryKey: ordersKey(slug),
    enabled: Boolean(slug),
    retry: false,
    queryFn: async () => {
      const { data } = await api.get(`/stores/${slug}/orders`)
      return unwrapCollection<Order>(data)
    },
  })
}

export default useOrders
