import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, GalleryHorizontalEnd } from 'lucide-react'
import { useStore, useStoreSections, useStoreTheme } from '../hooks'
import { EmptyState, LoadingPanel, buttonVariants } from '../components/ui'
import { SpotlightCard } from '../components/cards'
import type { InventoryItem, StoreSectionCard } from '../api/types'

/**
 * Storefront Case Cards page (/s/:slug/case-cards) — reached from the "Case
 * cards" quick action on the storefront. Renders the store owner's curated
 * sections, each a horizontal rail of holographic card tiles. Sections with no
 * cards are hidden here (the owner sees them in the admin view).
 */
export default function CaseCardsPage() {
  const { slug = '' } = useParams()
  const { data: store } = useStore(slug)
  useStoreTheme(store)
  const { data: sections, isLoading, isError } = useStoreSections(slug)

  const visible = (sections ?? []).filter((section) => section.cards.length > 0)

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Link
          to={`/s/${slug}`}
          className={buttonVariants({ variant: 'ghost', size: 'sm' })}
        >
          <ArrowLeft aria-hidden className="size-4" />
          Back to {store?.name ?? 'store'}
        </Link>
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-card bg-brand-500 text-white">
            <GalleryHorizontalEnd aria-hidden className="size-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-fg">Case cards</h1>
            <p className="text-sm text-fg-muted">Featured singles, hand-picked by {store?.name ?? 'the store'}.</p>
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
      ) : visible.length === 0 ? (
        <EmptyState
          icon={GalleryHorizontalEnd}
          title="No case cards yet"
          description="This store hasn't featured any cards in its case yet. Check back soon."
        />
      ) : (
        <div className="space-y-10">
          {visible.map((section) => (
            <section key={section.id}>
              <h2 className="mb-4 font-display text-lg font-bold tracking-tight text-fg">
                {section.title}
              </h2>
              <div className="flex snap-x gap-4 overflow-x-auto pb-2">
                {section.cards
                  .filter((entry): entry is RenderableCard => Boolean(entry.inventoryItem.card))
                  .map((entry) => (
                    <SpotlightCard
                      key={entry.id}
                      slug={slug}
                      item={toInventoryItem(entry)}
                    />
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
