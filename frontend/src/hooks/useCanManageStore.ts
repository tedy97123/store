import { useAuth } from '../context/AuthContext'

/**
 * useCanManageStore — true when the current user may manage the given store:
 * either a super admin, or an owner of a store with the matching slug.
 */
export function useCanManageStore(slug?: string): boolean {
  const { user, isSuperAdmin } = useAuth()
  if (isSuperAdmin) return true
  if (!slug) return false
  return user?.ownedStores?.some((store) => store.slug === slug) ?? false
}

export default useCanManageStore
