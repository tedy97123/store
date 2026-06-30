import { useEffect } from 'react'
import type { Store } from '../api/types'
import { storeThemeVars } from '../lib/storeTheme'

/**
 * useStoreTheme — applies a store's branding palette site-wide while a
 * storefront/admin page is mounted by overriding the Tailwind design-token CSS
 * variables on :root. The palette is expanded into a complete, readable set by
 * storeThemeVars (deriving unset neutrals and flipping the brand ramp for dark
 * themes), so the whole UI retones coherently. Previous values are restored on
 * unmount, so the theme never leaks to other pages.
 */
export function useStoreTheme(store?: Store) {
  // Serialize the inputs so the effect only re-runs when a branding value changes.
  const key = store
    ? [
        store.primaryColor,
        store.accentColor,
        store.backgroundColor,
        store.surfaceColor,
        store.textColor,
        store.mutedColor,
        store.borderColor,
      ].join('|')
    : ''

  useEffect(() => {
    if (!store) return
    const vars = storeThemeVars(store)
    const root = document.documentElement
    const previous: Record<string, string> = {}

    for (const [variable, value] of Object.entries(vars)) {
      previous[variable] = root.style.getPropertyValue(variable)
      root.style.setProperty(variable, value)
    }

    return () => {
      for (const [variable, value] of Object.entries(previous)) {
        if (value) root.style.setProperty(variable, value)
        else root.style.removeProperty(variable)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}

export default useStoreTheme
