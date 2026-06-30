import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowRight, Store as StoreIcon } from 'lucide-react'
import api, { unwrapCollection } from '../api/client'
import type { Store } from '../api/types'
import {
  Badge,
  Card,
  CardBody,
  EmptyState,
  ErrorState,
  LoadingPanel,
  PageHeader,
} from '../components/ui'

export default function HomePage() {
  const {
    data: stores = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['stores'],
    queryFn: async () => {
      const { data } = await api.get('/stores')
      return unwrapCollection<Store>(data)
    },
  })

  if (isLoading) {
    return <LoadingPanel label="Loading stores…" />
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to load stores"
        description="We couldn't reach the marketplace. Please try again."
        onRetry={() => void refetch()}
      />
    )
  }

  return (
    <div className="space-y-8">
      <section className="rounded-card border border-border bg-surface p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-wide text-brand-600">
          Storefront marketplace
        </p>
        <h1 className="mt-2 max-w-3xl font-display text-3xl font-bold tracking-tight text-fg sm:text-4xl">
          Shop Magic singles from local stores
        </h1>
        <p className="mt-3 max-w-2xl text-base text-fg-muted">
          Browse active storefronts, compare inventory, and jump into each store catalog.
        </p>
        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <div className="rounded-card border border-border bg-bg px-4 py-3">
            <span className="block text-xs uppercase text-fg-muted">Stores</span>
            <span className="text-lg font-bold text-fg">{stores.length}</span>
          </div>
          <div className="rounded-card border border-border bg-bg px-4 py-3">
            <span className="block text-xs uppercase text-fg-muted">Catalog type</span>
            <span className="text-lg font-bold text-fg">Singles</span>
          </div>
        </div>
      </section>

      <section>
        <PageHeader
          title="Stores"
          subtitle="Choose a storefront to view available inventory."
          className="mb-4"
        />
        {stores.length === 0 ? (
          <EmptyState
            icon={StoreIcon}
            title="No active stores yet"
            description="Platform admins can create one."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stores.map((store) => (
              <Link key={store.id} to={`/s/${store.slug}`} className="group block">
                <Card className="h-full transition-colors hover:border-brand-500">
                  <CardBody className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-bold text-fg group-hover:text-brand-600">
                          {store.name}
                        </h3>
                        <p className="mt-1 text-sm text-fg-muted">/{store.slug}</p>
                      </div>
                      <Badge tone="success">Open</Badge>
                    </div>
                    <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-sm">
                      <span className="text-fg-muted">View inventory</span>
                      <span className="flex items-center gap-1 font-bold text-brand-600">
                        Shop now
                        <ArrowRight aria-hidden className="size-4" />
                      </span>
                    </div>
                  </CardBody>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
