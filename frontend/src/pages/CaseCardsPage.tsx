import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, GalleryHorizontalEnd } from 'lucide-react'
import { useStore, useStoreCases, useStoreTheme } from '../hooks'
import { EmptyState, LoadingPanel, buttonVariants } from '../components/ui'
import { SpotlightCard } from '../components/cards'
import type { InventoryItem, StoreSectionCard } from '../api/types'

/**
 * Storefront Case Cards page (/s/:slug/case-cards) — reached from the "Case
 * cards" quick action. Shows the store's display cases, each divided into its
 * sections, as horizontal rails of holographic tiles. Cards whose section
 * pool is sold out are hidden, as are empty sections and cases.
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
    <div className="space-y-8">
      <div className="space-y-3">
        <Link to={`/s/${slug}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          <ArrowLeft aria-hidden className="size-4" />
          Back to {store?.name ?? 'store'}
        </Link>
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-card bg-brand-500 text-white">
            <GalleryHorizontalEnd aria-hidden className="size-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-fg">Case cards</h1>
            <p className="text-sm text-fg-muted">Featured singles from {store?.name ?? 'the store'}'s display cases.</p>
          </div>
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
          title="No case cards yet"
          description="This store hasn't featured any cards in its cases yet. Check back soon."
        />
      ) : (
        <div className="space-y-12">
          {visibleCases.map((storeCase) => (
            <section key={storeCase.id}>
              <h2 className="mb-1 font-display text-xl font-bold tracking-tight text-fg">{storeCase.name}</h2>
              <div className="space-y-8 border-l-2 border-border pl-4">
                {storeCase.sections.map((section) => (
                  <div key={section.id}>
                    <h3 className="mb-3 font-display text-base font-bold tracking-tight text-fg-muted">
                      {section.title}
                    </h3>
                    <div className="flex snap-x gap-4 overflow-x-auto pb-2">
                      {section.cards.map((entry) => (
                        <SpotlightCard key={entry.id} slug={slug} item={toInventoryItem(entry)} />
                      ))}
                    </div>
                  </div>
                ))}
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

/** Adapt the section-card's slim inventory shape to the InventoryItem SpotlightCard expects. */
function toInventoryItem(entry: RenderableCard): InventoryItem {
  const { inventoryItem } = entry
  return {
    id: inventoryItem.id,
    quantity: inventoryItem.quantity,
    priceCents: inventoryItem.priceCents,
    condition: inventoryItem.condition,
    isFoil: inventoryItem.isFoil,
    card: inventoryItem.card,
  }
}
