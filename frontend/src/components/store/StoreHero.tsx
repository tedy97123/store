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
 * StoreHero — the cinematic storefront banner. A full-bleed hero image sits
 * under layered brand gradients (a directional primary wash + a bottom scrim
 * for legibility) with ambient accent glows for depth. Content anchors to the
 * bottom-left: a glass-framed logo, tagline, large display heading and actions.
 * Colors are per-store data (inline styles), falling back to platform brand.
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
      className={cx(
        'relative isolate flex min-h-80 items-end overflow-hidden rounded-card border border-border sm:min-h-95',
        className,
      )}
    >
      {/* Background layer */}
      {hasImage ? (
        <img src={heroImageUrl as string} alt="" aria-hidden className="absolute inset-0 -z-20 size-full object-cover" />
      ) : (
        <div aria-hidden className="absolute inset-0 -z-20" style={{ backgroundColor: primary }} />
      )}

      {/* Layered brand gradients: directional primary wash + bottom scrim */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage: `linear-gradient(115deg, ${primary}f2 0%, ${primary}9e 38%, ${primary}33 68%, rgba(0,0,0,0.15) 100%), linear-gradient(to top, rgba(0,0,0,0.72), rgba(0,0,0,0.15) 55%, transparent 80%)`,
        }}
      />

      {/* Ambient accent glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 -z-10 size-72 rounded-full opacity-50 blur-3xl"
        style={{ backgroundColor: accent }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 left-1/3 -z-10 size-72 rounded-full opacity-30 blur-3xl"
        style={{ backgroundColor: accent }}
      />

      <div className="relative w-full p-6 text-white sm:p-8 lg:p-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-btn border border-white/25 bg-white/10 backdrop-blur">
                {logoUrl?.trim() ? (
                  <img src={logoUrl} alt="" className="size-full object-cover" />
                ) : (
                  <StoreIcon aria-hidden className="size-6" />
                )}
              </span>
              {tagline?.trim() && (
                <span
                  className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.15em] shadow-sm"
                  style={{ backgroundColor: accent }}
                >
                  {tagline}
                </span>
              )}
            </div>

            <h1 className="mt-5 max-w-2xl font-display text-4xl font-bold leading-[1.05] tracking-tight drop-shadow-sm sm:text-5xl">
              {heading}
            </h1>
            {heroSubheading?.trim() && (
              <p className="mt-3 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg">{heroSubheading}</p>
            )}
          </div>

          {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
        </div>
      </div>
    </div>
  )
}

export default StoreHero
