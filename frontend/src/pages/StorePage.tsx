import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Search, Store as StoreIcon, UserCircle } from 'lucide-react'
import api, { formatPrice, scryfallPriceCents, unwrapCollection } from '../api/client'
import type { InventoryItem } from '../api/types'
import { useAuth } from '../context/AuthContext'
import { useCanManageStore, useStore, useStoreTheme } from '../hooks'
import {
  Button,
  buttonVariants,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  FilterPill,
  Input,
  LoadingPanel,
  Pagination,
  Select,
} from '../components/ui'
import { CardTile, SpotlightCard, Stat } from '../components/cards'
import { StoreHero } from '../components/store/StoreHero'

type FinishFilter = 'all' | 'foil' | 'nonfoil'

const COLORS = [
  { key: 'W', label: 'White' },
  { key: 'U', label: 'Blue' },
  { key: 'B', label: 'Black' },
  { key: 'R', label: 'Red' },
  { key: 'G', label: 'Green' },
  { key: 'C', label: 'Colorless' },
] as const

const FINISH_OPTIONS: { key: FinishFilter; label: string }[] = [
  { key: 'all', label: 'All finishes' },
  { key: 'nonfoil', label: 'Nonfoil' },
  { key: 'foil', label: 'Foil' },
]

/** Fallback spotlight market-price threshold (cents) when the store has none configured. */
const DEFAULT_SPOTLIGHT_MIN_PRICE_CENTS = 1000
/** Maximum number of cards eligible for the spotlight carousel. */
const SPOTLIGHT_MAX_ITEMS = 12
/** Cards shown per spotlight carousel page. */
const SPOTLIGHT_PAGE_SIZE = 5
/** Result cards shown per page in the storefront grid. */
const RESULTS_PAGE_SIZE = 24

function parsePriceInput(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value.replace(/[$,\s]/g, ''))
  return Number.isNaN(parsed) ? null : Math.round(parsed * 100)
}

function cardColors(item: InventoryItem): string[] {
  const identity = item.card.colorIdentity ?? item.card.colors ?? []
  return identity.length > 0 ? identity : ['C']
}

function marketPriceCents(item: InventoryItem): number | null {
  return scryfallPriceCents(item.card, item.isFoil ? 'foil' : 'nonfoil')
}

export default function StorePage() {
  const { slug = '' } = useParams()
  const canManage = useCanManageStore(slug)
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [setFilter, setSetFilter] = useState('')
  const [oracleFilter, setOracleFilter] = useState('')
  const [finishFilter, setFinishFilter] = useState<FinishFilter>('all')
  const [selectedColors, setSelectedColors] = useState<string[]>([])
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [spotlightPageIndex, setSpotlightPageIndex] = useState(0)
  const [page, setPage] = useState(1)

  const { data: store } = useStore(slug)
  useStoreTheme(store)

  const { data: inventory = [], isLoading } = useQuery({
    queryKey: ['inventory', slug],
    queryFn: async () => {
      const { data } = await api.get(`/stores/${slug}/inventory`)
      return unwrapCollection<InventoryItem>(data)
    },
  })

  const availableSets = useMemo(
    () => Array.from(new Set(inventory.map((item) => item.card.setCode).filter(Boolean))).sort(),
    [inventory],
  )

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    const setTerm = setFilter.trim().toLowerCase()
    const oracleTerm = oracleFilter.trim().toLowerCase()
    const minPriceCents = parsePriceInput(minPrice)
    const maxPriceCents = parsePriceInput(maxPrice)

    return inventory.filter((item) => {
      const colors = cardColors(item)
      const matchesTerm =
        !term ||
        item.card.name.toLowerCase().includes(term) ||
        (item.card.setCode ?? '').toLowerCase().includes(term) ||
        (item.card.setName ?? '').toLowerCase().includes(term) ||
        (item.card.typeLine ?? '').toLowerCase().includes(term) ||
        (item.card.oracleText ?? '').toLowerCase().includes(term) ||
        colors.some((color) => color.toLowerCase().includes(term))
      const matchesSet =
        !setTerm ||
        (item.card.setCode ?? '').toLowerCase() === setTerm ||
        (item.card.setName ?? '').toLowerCase().includes(setTerm)
      const matchesOracle = !oracleTerm || (item.card.oracleText ?? '').toLowerCase().includes(oracleTerm)
      const matchesFinish =
        finishFilter === 'all' ||
        (finishFilter === 'foil' && item.isFoil) ||
        (finishFilter === 'nonfoil' && !item.isFoil)
      const matchesColors =
        selectedColors.length === 0 ||
        selectedColors.every((selected) => colors.includes(selected))
      const priceCents = marketPriceCents(item)
      const matchesMinPrice = minPriceCents === null || (priceCents !== null && priceCents >= minPriceCents)
      const matchesMaxPrice = maxPriceCents === null || (priceCents !== null && priceCents <= maxPriceCents)

      return (
        matchesTerm &&
        matchesSet &&
        matchesOracle &&
        matchesFinish &&
        matchesColors &&
        matchesMinPrice &&
        matchesMaxPrice
      )
    })
  }, [inventory, search, setFilter, oracleFilter, finishFilter, selectedColors, minPrice, maxPrice])

  const spotlightItems = useMemo(() => {
    const threshold = store?.spotlightMinPriceCents ?? DEFAULT_SPOTLIGHT_MIN_PRICE_CENTS
    return inventory
      .map((item) => ({ item, priceCents: marketPriceCents(item) }))
      .filter(({ priceCents }) => priceCents !== null && priceCents >= threshold)
      .sort((a, b) => (b.priceCents ?? 0) - (a.priceCents ?? 0))
      .map(({ item }) => item)
      .slice(0, SPOTLIGHT_MAX_ITEMS)
  }, [inventory, store?.spotlightMinPriceCents])

  const spotlightPageCount = Math.max(Math.ceil(spotlightItems.length / SPOTLIGHT_PAGE_SIZE), 1)

  // Reset to the first page whenever the spotlight count shrinks below the current page,
  // so Prev/Next never enable on a clamped (out-of-range) page index.
  useEffect(() => {
    setSpotlightPageIndex((current) => Math.min(current, spotlightPageCount - 1))
  }, [spotlightPageCount])

  const currentSpotlightPage = Math.min(spotlightPageIndex, spotlightPageCount - 1)
  const totalCards = inventory.reduce((sum, item) => sum + item.quantity, 0)
  const visibleSpotlights = spotlightItems.slice(
    currentSpotlightPage * SPOTLIGHT_PAGE_SIZE,
    currentSpotlightPage * SPOTLIGHT_PAGE_SIZE + SPOTLIGHT_PAGE_SIZE,
  )

  // Paginate the results grid. Reset to page 1 when the filters change.
  useEffect(() => {
    setPage(1)
  }, [search, setFilter, oracleFilter, finishFilter, selectedColors, minPrice, maxPrice])

  const resultsPageCount = Math.max(1, Math.ceil(filtered.length / RESULTS_PAGE_SIZE))
  const currentResultsPage = Math.min(page, resultsPageCount)
  const visibleResults = filtered.slice(
    (currentResultsPage - 1) * RESULTS_PAGE_SIZE,
    currentResultsPage * RESULTS_PAGE_SIZE,
  )

  function toggleColor(color: string) {
    setSelectedColors((current) =>
      current.includes(color) ? current.filter((value) => value !== color) : [...current, color],
    )
  }

  function clearFilters() {
    setSearch('')
    setSetFilter('')
    setOracleFilter('')
    setFinishFilter('all')
    setSelectedColors([])
    setMinPrice('')
    setMaxPrice('')
  }

  return (
    <div className="space-y-6">
      <StoreHero
        name={store?.name ?? slug}
        tagline={store?.tagline}
        heroHeading={store?.heroHeading}
        heroSubheading={
          store?.heroSubheading ||
          'Browse available Magic singles and compare printings, condition, colors, and prices.'
        }
        heroImageUrl={store?.heroImageUrl}
        logoUrl={store?.logoUrl}
        primaryColor={store?.primaryColor}
        accentColor={store?.accentColor}
        actions={
          <>
            {user && (
              <Link to={`/s/${slug}/account`} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
                <UserCircle aria-hidden className="size-4" />
                My account
              </Link>
            )}
            {canManage && (
              <Link to={`/s/${slug}/admin`} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
                <StoreIcon aria-hidden className="size-4" />
                Admin workspace
              </Link>
            )}
          </>
        }
      />

      <Card>
        <CardBody className="flex flex-wrap gap-3">
          <Stat label="Listings" value={String(inventory.length)} />
          <Stat label="Cards" value={String(totalCards)} />
          <Stat label="Sets" value={String(availableSets.length)} />
        </CardBody>
      </Card>

      {spotlightItems.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader
            title="Spotlight carousel"
            subtitle={`Cards over ${formatPrice(
              store?.spotlightMinPriceCents ?? DEFAULT_SPOTLIGHT_MIN_PRICE_CENTS,
            )} market price`}
            actions={
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSpotlightPageIndex((current) => Math.max(current - 1, 0))}
                  disabled={spotlightPageCount <= 1 || currentSpotlightPage === 0}
                  aria-label="Previous spotlight page"
                >
                  <ChevronLeft aria-hidden className="size-4" />
                  Prev
                </Button>
                <span className="text-sm text-fg-muted">
                  {currentSpotlightPage + 1} / {spotlightPageCount}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setSpotlightPageIndex((current) => Math.min(current + 1, spotlightPageCount - 1))
                  }
                  disabled={spotlightPageCount <= 1 || currentSpotlightPage >= spotlightPageCount - 1}
                  aria-label="Next spotlight page"
                >
                  Next
                  <ChevronRight aria-hidden className="size-4" />
                </Button>
              </div>
            }
          />
          <CardBody className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {visibleSpotlights.map((item) => (
              <SpotlightCard key={item.id} item={item} slug={slug} />
            ))}
          </CardBody>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader
              title="Search inventory"
              subtitle={`${filtered.length} result${filtered.length === 1 ? '' : 's'} available`}
            />
            <CardBody className="space-y-4">
              <Input
                label="Card, color, text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Lightning, red, draw..."
              />
              <Input
                label="Oracle text"
                value={oracleFilter}
                onChange={(e) => setOracleFilter(e.target.value)}
                placeholder="Flying, draw a card..."
              />
              <Select label="Set" value={setFilter} onChange={(e) => setSetFilter(e.target.value)}>
                <option value="">All sets</option>
                {availableSets.map((set) => (
                  <option key={set} value={set}>
                    {set?.toUpperCase()}
                  </option>
                ))}
              </Select>
              <div>
                <p className="mb-2 text-sm font-bold text-fg">Finish</p>
                <div className="flex flex-wrap gap-2">
                  {FINISH_OPTIONS.map((option) => (
                    <FilterPill
                      key={option.key}
                      active={finishFilter === option.key}
                      onClick={() => setFinishFilter(option.key)}
                    >
                      {option.label}
                    </FilterPill>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-bold text-fg">Color</p>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((color) => (
                    <FilterPill
                      key={color.key}
                      active={selectedColors.includes(color.key)}
                      onClick={() => toggleColor(color.key)}
                    >
                      {color.label}
                    </FilterPill>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Min market"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder="0"
                />
                <Input
                  label="Max market"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="50"
                />
              </div>
              <Button variant="secondary" className="w-full" onClick={clearFilters}>
                Clear filters
              </Button>
            </CardBody>
          </Card>
        </aside>

        {isLoading ? (
          <LoadingPanel label="Loading inventory…" />
        ) : filtered.length === 0 ? (
          <Card>
            <EmptyState
              icon={Search}
              title="No matching cards"
              description="No inventory matches these filters."
              action={
                <Button variant="secondary" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visibleResults.map((item) => (
                <CardTile key={item.id} item={item} slug={slug} />
              ))}
            </div>
            <Pagination
              page={currentResultsPage}
              pageCount={resultsPageCount}
              onPageChange={setPage}
              totalItems={filtered.length}
            />
          </div>
        )}
      </div>
    </div>
  )
}
