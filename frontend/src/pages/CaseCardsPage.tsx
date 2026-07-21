import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, GalleryHorizontalEnd, Gem, Sparkles } from 'lucide-react'
import { cardImage, formatPrice } from '../api/client'
import { useStore, useStoreCases, useStoreTheme } from '../hooks'
import { EmptyState, LoadingPanel, buttonVariants } from '../components/ui'
import { InteractiveCard } from '../components/cards'
import { rarityAccent } from '../lib/mtg'
import type { StoreSectionCard } from '../api/types'

/**
 * Storefront Case Cards page (/s/:slug/case-cards). Each display case renders
 * as a physical showcase — metal frame, engraved plaque, ceiling spotlights, a
 * slow glass reflection, and lit shelves — with every color derived from the
 * store's own theme (see the .case-* classes in index.css), so the case
 * furniture matches the storefront's branding. Cards are holographic tilt
 * tiles; sold-out pool cards, empty sections, and empty cases are hidden.
 */
export default function CaseCardsPage() {
  const { slug = '' } = useParams()
  const { data: store } = useStore(slug)
  useStoreTheme(store)
  const { data: cases, isLoading, isError } = useStoreCases(slug)

  const visibleCases = (cases ?? [])
    .map((storeCase) => ({
      ...storeCase,
      sections: storeCase.sections
        .map((section) => ({
          ...section,
          cards: section.cards.filter(
            (entry): entry is RenderableCard => entry.remaining > 0 && Boolean(entry.inventoryItem.card),
          ),
        }))
        .filter((section) => section.cards.length > 0),
    }))
    .filter((storeCase) => storeCase.sections.length > 0)

  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <Link to={`/s/${slug}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          <ArrowLeft aria-hidden className="size-4" />
          Back to {store?.name ?? 'store'}
        </Link>

        {/* Marquee header — this is the store's premium showcase. */}
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-[0.7rem] font-bold uppercase tracking-[0.2em] text-fg-muted">
            <Gem aria-hidden className="size-3.5 text-brand-500" />
            {store?.name ?? 'Store'} showcase
          </span>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-fg sm:text-5xl">
            Case{' '}
            <span className="bg-gradient-to-r from-brand-500 via-accent-500 to-brand-700 bg-clip-text text-transparent">
              Cards
            </span>
          </h1>
          <p className="max-w-xl text-sm text-fg-muted sm:text-base">
            The singles behind the glass — hand-picked, graded, and ready to go home with you.
          </p>
        </div>
      </div>

      {isLoading ? (
        <LoadingPanel />
      ) : isError ? (
        <EmptyState
          icon={GalleryHorizontalEnd}
          title="Could not load case cards"
          description="Please try again in a moment."
        />
      ) : visibleCases.length === 0 ? (
        <EmptyState
          icon={GalleryHorizontalEnd}
          title="The cases are being restocked"
          description="This store hasn't featured any cards in its cases yet. Check back soon."
        />
      ) : (
        <div className="space-y-12">
          {visibleCases.map((storeCase) => (
            <section key={storeCase.id} aria-label={`Display case: ${storeCase.name}`} className="case-frame">
              <div className="case-interior case-spotlights case-glass px-4 pb-8 pt-5 sm:px-8">
                {/* Engraved brass plaque */}
                <div className="relative z-10 mb-6 flex justify-center">
                  <span className="case-plaque inline-flex items-center gap-2 px-5 py-1.5 font-display text-sm font-bold uppercase tracking-[0.18em]">
                    <Sparkles aria-hidden className="size-3.5" />
                    {storeCase.name}
                  </span>
                </div>

                <div className="relative z-10 space-y-10">
                  {storeCase.sections.map((section) => (
                    <div key={section.id}>
                      <div className="mb-4 flex items-baseline justify-between gap-3">
                        <h3 className="case-label font-display text-xs font-bold uppercase tracking-[0.22em]">
                          {section.title}
                        </h3>
                        <span className="text-[0.7rem] font-medium uppercase tracking-wide text-white/40">
                          {section.cards.length} card{section.cards.length === 1 ? '' : 's'}
                        </span>
                      </div>

                      {/* The shelf: card rail + lit shelf edge beneath. */}
                      <div className="flex snap-x gap-5 overflow-x-auto pb-4 pt-1">
                        {section.cards.map((entry) => (
                          <CaseCardTile key={entry.id} slug={slug} entry={entry} />
                        ))}
                      </div>
                      <div className="case-shelf" aria-hidden />
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

type RenderableCard = StoreSectionCard & {
  inventoryItem: StoreSectionCard['inventoryItem'] & { card: NonNullable<StoreSectionCard['inventoryItem']['card']> }
}

/**
 * One card on a shelf: the holographic tilt card with a light-on-dark caption
 * and a brand-toned price tag. Links to the listing's details page.
 */
function CaseCardTile({ slug, entry }: { slug: string; entry: RenderableCard }) {
  const { inventoryItem } = entry
  const card = inventoryItem.card
  const lastOne = entry.remaining === 1

  return (
    <Link
      to={`/s/${slug}/cards/${inventoryItem.id}`}
      className="group relative w-40 flex-shrink-0 snap-start sm:w-52"
    >
      {lastOne && (
        <span className="absolute right-2 top-2 z-20 rounded-full bg-accent-500 px-2 py-0.5 text-[0.62rem] font-black uppercase tracking-wide text-white shadow">
          Last one
        </span>
      )}
      <InteractiveCard
        image={cardImage(card)}
        alt={card.name}
        foil={inventoryItem.isFoil}
        accent={rarityAccent(card.rarity)}
        maxTilt={12}
        shadow={false}
      />
      <div className="mt-3 px-0.5">
        <h4 className="truncate font-display text-sm font-bold tracking-tight text-white/95 group-hover:underline">
          {card.name}
        </h4>
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="text-xs uppercase tracking-wide text-white/45">
            {card.setCode?.toUpperCase() ?? '—'}
            {inventoryItem.isFoil ? ' · Foil' : ''}
          </span>
          <span className="case-plaque rounded px-1.5 py-0.5 text-xs font-black">
            {formatPrice(inventoryItem.priceCents)}
          </span>
        </div>
      </div>
    </Link>
  )
}
