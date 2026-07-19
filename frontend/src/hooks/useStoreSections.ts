import { useQuery } from '@tanstack/react-query'
import api from '../api/client'
import type { StoreSection } from '../api/types'

/** React Query key for a store's Case Cards sections — shared with invalidations. */
export const storeSectionsKey = (slug: string) => ['store-sections', slug] as const

/**
 * useStoreSections — a store's Case Cards sections with their materialised
 * listings. Public (no auth needed), so it backs both the storefront Case
 * Cards page and the owner's admin management view.
 */
export function useStoreSections(slug?: string) {
  return useQuery({
    queryKey: storeSectionsKey(slug ?? ''),
    enabled: Boolean(slug),
    queryFn: async () => {
      const { data } = await api.get<StoreSection[]>(`/stores/${slug}/sections`)
      return data
    },
  })
}

export default useStoreSections
