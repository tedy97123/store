import { Store as StoreIcon, User } from 'lucide-react'

export interface AuthMarketingAsideProps {
  /** Headline shown when no store context is present. */
  storeName?: string
  /** Marketing description copy. */
  description: string
}

/**
 * Shared marketing panel for the auth pages (Login / Register).
 * Flat enterprise treatment — hairline borders, no decorative gradients.
 */
export default function AuthMarketingAside({ storeName, description }: AuthMarketingAsideProps) {
  return (
    <aside className="flex items-stretch">
      <div className="flex w-full flex-col justify-between gap-8 rounded-card border border-border bg-surface px-8 py-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-brand-600">Marketplace</p>
          <div className="mt-6 max-w-sm">
            <p className="font-display text-4xl font-bold leading-tight text-fg sm:text-5xl">
              {storeName ?? 'MTG Marketplace'}
            </p>
            <p className="mt-5 max-w-sm text-sm leading-6 text-fg-muted">{description}</p>
          </div>
        </div>
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-card border border-border bg-bg p-4">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-fg-muted">
              <User aria-hidden className="size-4 text-brand-600" />
              Customer
            </span>
            <p className="mt-2 font-bold text-fg">Favorites, want list, account</p>
          </div>
          <div className="rounded-card border border-border bg-bg p-4">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-fg-muted">
              <StoreIcon aria-hidden className="size-4 text-brand-600" />
              Store
            </span>
            <p className="mt-2 font-bold text-fg">Inventory, cards, prices</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
