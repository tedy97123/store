import type { CSSProperties } from 'react'
import { Heart, ImageOff, Search, ShoppingCart } from 'lucide-react'
import type { CardDisplayStyle } from '../../api/types'
import { Badge, Button, FilterPill } from '../ui'
import { StoreHero } from './StoreHero'
import { storeThemeVars } from '../../lib/storeTheme'

/** Fallbacks that mirror the platform default theme (index.css). */
const FALLBACK_BG = '#f7f8fa'
const FALLBACK_FG = '#0f172a'

export interface StorePreviewBranding {
  primaryColor?: string | null
  accentColor?: string | null
  backgroundColor?: string | null
  surfaceColor?: string | null
  textColor?: string | null
  mutedColor?: string | null
  borderColor?: string | null
  logoUrl?: string | null
  heroImageUrl?: string | null
  heroHeading?: string | null
  heroSubheading?: string | null
  tagline?: string | null
  cardDisplayStyle?: CardDisplayStyle
}

/**
 * StorePreview — a scaled-down, live mock of the storefront. The in-progress
 * palette is scoped to this container by overriding the design-token CSS
 * variables; every primitive inside (Button, Card, Badge, FilterPill, hero)
 * reads those tokens, so the whole preview retones instantly as the owner edits
 * — before anything is saved. Shared by the branding admin tab and the
 * onboarding wizard so both show an identical storefront.
 */
export function StorePreview({
  branding,
  storeName,
}: {
  branding: StorePreviewBranding
  storeName: string
}) {
  const vars = storeThemeVars(branding)
  const themeStyle = {
    ...vars,
    backgroundColor: vars['--color-bg'] ?? FALLBACK_BG,
    color: vars['--color-fg'] ?? FALLBACK_FG,
  } as CSSProperties

  const marketplace = branding.cardDisplayStyle === 'marketplace'

  return (
    <div style={themeStyle} className="space-y-4 overflow-hidden rounded-card border border-border p-4">
      <StoreHero
        name={storeName}
        tagline={branding.tagline}
        heroHeading={branding.heroHeading}
        heroSubheading={branding.heroSubheading}
        heroImageUrl={branding.heroImageUrl}
        logoUrl={branding.logoUrl}
        primaryColor={branding.primaryColor}
        accentColor={branding.accentColor}
      />

      <div className="flex flex-wrap items-center gap-2">
        <FilterPill active>Foil</FilterPill>
        <FilterPill>Rare</FilterPill>
        <FilterPill>Mythic</FilterPill>
        <Button size="sm" className="ml-auto">
          <Search aria-hidden className="size-4" />
          Search
        </Button>
      </div>

      <div className={marketplace ? 'grid gap-3' : 'grid grid-cols-2 gap-3'}>
        {[1, 2].map((n) =>
          marketplace ? (
            <div key={n} className="flex gap-3 rounded-card border border-border bg-surface p-3 shadow-card">
              <div className="grid h-24 w-16 shrink-0 place-items-center rounded-btn bg-bg text-fg-muted">
                <ImageOff aria-hidden className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-fg">Sample Card {n}</p>
                <p className="mt-1 text-xs text-fg-muted">Preview Set</p>
                <p className="mt-2 text-xs text-fg">3 copies from</p>
                <p className="font-display text-lg font-bold text-fg">${(n * 1.53).toFixed(2)}</p>
                <p className="text-xs font-bold text-fg">
                  Market Price: <span className="text-success-700">${(n * 1.86).toFixed(2)}</span>
                </p>
              </div>
            </div>
          ) : (
            <div key={n} className="rounded-card border border-border bg-surface p-3 shadow-card">
              <div className="grid h-20 place-items-center rounded-btn bg-bg text-fg-muted">
                <ImageOff aria-hidden className="size-5" />
              </div>
              <p className="mt-2 truncate text-sm font-bold text-brand-600">Sample Card {n}</p>
              <div className="mt-1 flex items-center justify-between">
                <Badge tone={n === 1 ? 'brand' : 'neutral'}>{n === 1 ? 'Foil' : 'NM'}</Badge>
                <span className="text-sm font-bold text-fg">${(n * 1.53).toFixed(2)}</span>
              </div>
            </div>
          ),
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button className="flex-1">
          {marketplace ? <ShoppingCart aria-hidden className="size-4" /> : <Heart aria-hidden className="size-4" />}
          {marketplace ? 'Add to cart' : 'Save favorite'}
        </Button>
        <Button variant="secondary" className="flex-1">
          Add to want list
        </Button>
      </div>
    </div>
  )
}

export default StorePreview
