import type { ReactNode } from 'react'
import { Store as StoreIcon } from 'lucide-react'
import { cx } from '../../lib/cx'

export const DEFAULT_PRIMARY = '#6d5efc'
export const DEFAULT_ACCENT = '#ff7a59'

export interface StoreHeroProps {
  name: string
  tagline?: string | null
  heroHeading?: string | null
  heroSubheading?: string | null
  heroImageUrl?: string | null
  logoUrl?: string | null
  primaryColor?: string | null
  accentColor?: string | null
  actions?: ReactNode
  className?: string
}

/**
 * StoreHero — the branded storefront banner. Driven entirely by a store's
 * branding fields so the admin live-preview and the public storefront render
 * identically. Colors are applied via inline styles (they're per-store data,
 * not design tokens). Falls back to the platform brand colors when unset.
 */
export function StoreHero({
  name,
  tagline,
  heroHeading,
  heroSubheading,
  heroImageUrl,
  logoUrl,
  primaryColor,
  accentColor,
  actions,
  className,
}: StoreHeroProps) {
  const primary = primaryColor?.trim() || DEFAULT_PRIMARY
  const accent = accentColor?.trim() || DEFAULT_ACCENT
  const heading = heroHeading?.trim() || name
  const hasImage = Boolean(heroImageUrl?.trim())

  return (
    <div
      className={cx('relative isolate overflow-hidden rounded-card border border-border', className)}
      style={
        hasImage
          ? { backgroundImage: `url(${heroImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : { backgroundColor: primary }
      }
    >
      {/* Legibility / brand overlay */}
      {hasImage ? (
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{ background: `linear-gradient(110deg, ${primary}f2 0%, ${primary}99 45%, rgba(0,0,0,0.35) 100%)` }}
        />
      ) : (
        <div
          aria-hidden
          className="absolute -right-16 -top-16 -z-10 size-64 rounded-full opacity-40 blur-2xl"
          style={{ backgroundColor: accent }}
        />
      )}

      <div className="flex flex-col gap-6 p-8 text-white sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            {logoUrl?.trim() ? (
              <img
                src={logoUrl}
                alt=""
                className="size-12 flex-shrink-0 rounded-btn border border-white/30 bg-white/10 object-cover"
              />
            ) : (
              <span className="grid size-12 flex-shrink-0 place-items-center rounded-btn bg-white/15">
                <StoreIcon aria-hidden className="size-6" />
              </span>
            )}
            {tagline?.trim() && (
              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-sm"
                style={{ backgroundColor: accent }}
              >
                {tagline}
              </span>
            )}
          </div>

          <h1 className="mt-4 font-display text-4xl font-bold tracking-tight drop-shadow-sm">{heading}</h1>
          {heroSubheading?.trim() && (
            <p className="mt-2 max-w-2xl text-white/85">{heroSubheading}</p>
          )}
        </div>

        {actions && <div className="flex flex-shrink-0 flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </div>
  )
}

export default StoreHero
