import { useQuery } from '@tanstack/react-query'
import api from '../api/client'
import type { Store } from '../api/types'

/**
 * useStore — fetch a single store by slug.
 * Matches the existing pages' query key (['store', slug]) and endpoint.
 * Disabled until a slug is provided.
 */
export function useStore(slug?: string) {
  return useQuery({
    queryKey: ['store', slug],
    queryFn: async () => {
      const { data } = await api.get<Store>(`/stores/${slug}`)
      return data
    },
    enabled: !!slug,
  })
}

export default useStore
