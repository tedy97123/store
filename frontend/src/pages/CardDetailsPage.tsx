import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ExternalLink,
  Heart,
  ListPlus,
  Settings,
  ShoppingCart,
  Sparkles,
  UserCircle,
} from 'lucide-react'
import api, { cardImage, formatScryfallPrice, unwrapCollection } from '../api/client'
import type { CustomerFavorite, InventoryItem } from '../api/types'
import { useAuth } from '../context/AuthContext'
import {
  customerKeys,
  useCanManageStore,
  useCustomerFavorites,
  useCustomerWantList,
  useStore,
  useStoreTheme,
} from '../hooks'
import { Badge, Button, buttonVariants, ErrorState, LoadingPanel } from '../components/ui'
import { InteractiveCard, SpotlightCard } from '../components/cards'
import { FOIL_GRADIENT, rarityAccent, rarityLabel } from '../lib/mtg'

/** Slugify a card name for an EDHREC deck-context link (front face only). */
function edhrecUrl(name: string): string {
  const slug = name
    .split('//')[0]
    .trim()
    .toLowerCase()
    .replace(/['’.,]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `https://edhrec.com/cards/${slug}`
}

function formatDate(value?: string): string {
  if (!value) return '-'
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function legalities(card: InventoryItem['card']) {
  return Object.entries(card.legalities ?? {})
    .filter(([, value]) => value === 'legal')
    .slice(0, 12)
}

export default function CardDetailsPage() {
  const { slug = '', id = '' } = useParams()
  const { user } = useAuth()
  const canManage = useCanManageStore(slug)
  const queryClient = useQueryClient()

  const { data: store } = useStore(slug)
  useStoreTheme(store)

  const {
    data: item,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['inventory-item', slug, id],
    enabled: Boolean(slug && id),
    queryFn: async () => {
      const { data } = await api.get<InventoryItem>(`/stores/${slug}/inventory/${id}`)
      return data
    },
  })

  // Shared cache key with StorePage — usually warm — powers the recommendations rail.
  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory', slug],
    enabled: Boolean(slug),
    queryFn: async () => {
      const { data } = await api.get(`/stores/${slug}/inventory`)
      return unwrapCollection<InventoryItem>(data)
    },
  })

  const { data: favorites = [] } = useCustomerFavorites(slug, Boolean(user))
  const { data: wantList = [] } = useCustomerWantList(slug, Boolean(user))

  const favoriteMutation = useMutation({
    mutationFn: async ({ inventoryItem, favorite }: { inventoryItem: InventoryItem; favorite: boolean }) => {
      if (favorite) {
        await api.delete(`/stores/${slug}/customer/favorites/${inventoryItem.id}`)
      } else {
        await api.put(`/stores/${slug}/customer/favorites/${inventoryItem.id}`)
      }
    },
    onMutate: async ({ inventoryItem, favorite }) => {
      await queryClient.cancelQueries({ queryKey: customerKeys.favorites(slug) })
      const previous = queryClient.getQueryData<CustomerFavorite[]>(customerKeys.favorites(slug))
      queryClient.setQueryData<CustomerFavorite[]>(customerKeys.favorites(slug), (current = []) => {
        if (favorite) {
          return current.filter((entry) => entry.inventoryItem?.id !== inventoryItem.id)
        }
        if (current.some((entry) => entry.inventoryItem?.id === inventoryItem.id)) {
          return current
        }
        const optimistic: CustomerFavorite = {
          id: -inventoryItem.id,
          inventoryItem,
          createdAt: new Date().toISOString(),
        }
        return [...current, optimistic]
      })
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(customerKeys.favorites(slug), context.previous)
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: customerKeys.favorites(slug) })
    },
  })

  const wantListMutation = useMutation({
    mutationFn: async (inventoryItem: InventoryItem) => {
      await api.post(`/stores/${slug}/customer/want-list`, {
        cardId: inventoryItem.card.id,
        cardName: inventoryItem.card.name,
        setCode: inventoryItem.card.setCode,
        isFoil: inventoryItem.isFoil,
        quantity: 1,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: customerKeys.wantList(slug) })
    },
  })

  if (isLoading) {
    return <LoadingPanel label="Loading card details…" />
  }

  if (error || !item) {
    return (
      <div className="rounded-card border border-border bg-surface">
        <ErrorState title="Card listing not found" description="This listing could not be loaded." />
      </div>
    )
  }

  const card = item.card
  const finish = item.isFoil ? 'foil' : 'nonfoil'
  const image = cardImage(card)
  const accent = rarityAccent(card.rarity)
  const legalFormats = legalities(card)
  const isFavorite = favorites.some((favorite) => favorite.inventoryItem?.id === item.id)
  const isWanted = wantList.some(
    (entry) =>
      entry.card?.id === item.card.id ||
      (entry.cardName.toLowerCase() === item.card.name.toLowerCase() && entry.setCode === item.card.setCode),
  )

  const related = inventory.filter((i) => i.id !== item.id).slice(0, 10)

  const powerToughness = card.power || card.toughness ? `${card.power ?? '—'} / ${card.toughness ?? '—'}` : ''
  const specs = (
    [
      { label: 'Set', value: card.setName },
      { label: 'Rarity', value: card.rarity, capitalize: true },
      { label: 'Mana cost', value: card.manaCost },
      { label: 'Released', value: card.releasedAt ? formatDate(card.releasedAt) : '' },
      { label: 'Artist', value: card.artist },
      { label: 'Language', value: card.lang?.toUpperCase() },
      { label: 'Layout', value: card.layout, capitalize: true },
      { label: 'Games', value: card.games?.join(', ') },
      { label: 'Keywords', value: card.keywords?.join(', ') },
      { label: 'Power / Toughness', value: powerToughness },
    ] as { label: string; value?: string; capitalize?: boolean }[]
  ).filter((spec): spec is { label: string; value: string; capitalize?: boolean } => Boolean(spec.value))

  const priceRows = (
    [
      { label: 'Nonfoil', value: formatScryfallPrice(card, 'nonfoil') },
      { label: 'Foil', value: formatScryfallPrice(card, 'foil') },
      { label: 'Etched', value: formatScryfallPrice(card, 'etched') },
    ] as { label: string; value: string }[]
  ).filter((row, index) => index === 0 || row.value !== '-')

  return (
    <div className="space-y-8">
      {/* Immersive art hero */}
      <section className="relative overflow-hidden rounded-card border border-border">
        {image && (
          <img src={image} alt="" aria-hidden className="absolute inset-0 size-full scale-125 object-cover opacity-40 blur-2xl" />
        )}
        <div aria-hidden className="absolute inset-0 bg-linear-to-t from-surface via-surface/88 to-surface/55" />
        <div className="relative flex flex-col gap-4 p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link to={`/s/${slug}`} className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
              <ArrowLeft aria-hidden className="size-4" />
              Back to {store?.name ?? 'store'}
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              {user && (
                <Link to={`/s/${slug}/account`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                  <UserCircle aria-hidden className="size-4" />
                  My account
                </Link>
              )}
              {canManage && (
                <Link to={`/s/${slug}/admin`} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
                  <Settings aria-hidden className="size-4" />
                  Manage listing
                </Link>
              )}
            </div>
          </div>
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.15em] text-brand-600">
              {(card.setCode ?? '—').toUpperCase()} · #{card.collectorNumber ?? '—'}
            </p>
            <h1 className="mt-1 max-w-3xl font-display text-4xl font-bold tracking-tight text-fg sm:text-5xl">{card.name}</h1>
            {card.typeLine && <p className="mt-2 text-lg text-fg-muted">{card.typeLine}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {card.rarity && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-bold capitalize text-fg"
                >
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: accent }} />
                  {rarityLabel(card.rarity)}
                </span>
              )}
              {item.isFoil && (
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-white/60 px-2.5 py-1 text-xs font-bold text-black/80"
                  style={{ backgroundImage: FOIL_GRADIENT }}
                >
                  <Sparkles aria-hidden className="size-3.5" />
                  Foil
                </span>
              )}
              <Badge>{item.condition}</Badge>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[22rem_minmax(0,1fr)]">
        {/* LEFT: image + sticky buy box */}
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <InteractiveCard image={image} alt={card.name} foil={item.isFoil} accent={accent} />
          <p className="text-center text-xs text-fg-muted">Move your cursor over the card{item.isFoil ? ' to see the foil shine' : ''}.</p>

          {/* Buy box */}
          <div className="rounded-card border border-border bg-surface p-5 shadow-card">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wide text-fg-muted">Market price</p>
              <Badge tone={item.isFoil ? 'brand' : 'neutral'}>{item.isFoil ? 'Foil' : 'Nonfoil'}</Badge>
            </div>
            <p className="mt-1 font-display text-4xl font-bold text-fg">{formatScryfallPrice(card, finish)}</p>

            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-4">
              <Fact label="Condition" value={item.condition} />
              <Fact label="Available" value={String(item.quantity)} />
              <Fact label="Set" value={card.setCode?.toUpperCase() ?? '—'} />
              <Fact label="Collector" value={`#${card.collectorNumber ?? '—'}`} />
            </dl>

            <div className="mt-5 space-y-2">
              {user ? (
                <>
                  <Button
                    variant={isFavorite ? 'secondary' : 'primary'}
                    size="lg"
                    className="w-full"
                    loading={favoriteMutation.isPending}
                    disabled={favoriteMutation.isPending}
                    onClick={() => favoriteMutation.mutate({ inventoryItem: item, favorite: isFavorite })}
                  >
                    <Heart aria-hidden className={`size-4 ${isFavorite ? 'fill-current' : ''}`} />
                    {isFavorite ? 'Saved to favorites' : 'Save favorite'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="lg"
                    className="w-full"
                    loading={wantListMutation.isPending}
                    disabled={wantListMutation.isPending || isWanted}
                    onClick={() => wantListMutation.mutate(item)}
                  >
                    {isWanted ? <ShoppingCart aria-hidden className="size-4" /> : <ListPlus aria-hidden className="size-4" />}
                    {isWanted ? 'On want list' : 'Add to want list'}
                  </Button>
                  {favoriteMutation.isError && (
                    <p role="alert" className="text-xs font-medium text-danger-700">
                      Could not update your favorites. Please try again.
                    </p>
                  )}
                  {wantListMutation.isError && (
                    <p role="alert" className="text-xs font-medium text-danger-700">
                      Could not update your want list. Please try again.
                    </p>
                  )}
                </>
              ) : (
                <Link to="/login" className={`${buttonVariants({ variant: 'primary', size: 'lg' })} w-full`}>
                  Sign in to save cards
                </Link>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-4">
              {card.scryfallUri && (
                <a
                  href={card.scryfallUri}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
                >
                  <ExternalLink aria-hidden className="size-4" />
                  Scryfall
                </a>
              )}
              <a
                href={edhrecUrl(card.name)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
              >
                <ExternalLink aria-hidden className="size-4" />
                EDHREC
              </a>
            </div>
          </div>
        </div>

        {/* RIGHT: card text + specs + prices + legalities */}
        <div className="min-w-0 space-y-6">
          {card.oracleText && (
            <section className="rounded-card border border-border bg-surface p-6 shadow-card">
              <h2 className="text-xs font-bold uppercase tracking-wide text-fg-muted">Card text</h2>
              <p className="mt-3 whitespace-pre-line text-lg leading-8 text-fg">{card.oracleText}</p>
              {card.flavorText && (
                <p className="mt-4 whitespace-pre-line border-t border-border pt-4 font-display italic leading-7 text-fg-muted">
                  {card.flavorText}
                </p>
              )}
            </section>
          )}

          {specs.length > 0 && (
            <section className="rounded-card border border-border bg-surface p-6 shadow-card">
              <h2 className="text-xs font-bold uppercase tracking-wide text-fg-muted">Card details</h2>
              <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                {specs.map((spec) => (
                  <Spec key={spec.label} label={spec.label} value={spec.value} capitalize={spec.capitalize} />
                ))}
              </dl>
            </section>
          )}

          <div className="grid gap-6 sm:grid-cols-2">
            <section className="rounded-card border border-border bg-surface p-6 shadow-card">
              <h2 className="text-xs font-bold uppercase tracking-wide text-fg-muted">Scryfall prices</h2>
              <div className="mt-3 space-y-2">
                {priceRows.map((row) => (
                  <PriceRow key={row.label} label={row.label} value={row.value} />
                ))}
              </div>
            </section>

            {legalFormats.length > 0 && (
              <section className="rounded-card border border-border bg-surface p-6 shadow-card">
                <h2 className="text-xs font-bold uppercase tracking-wide text-fg-muted">Legal formats</h2>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {legalFormats.map(([format]) => (
                    <Badge key={format} tone="success" className="uppercase">
                      {format}
                    </Badge>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

      {/* More from this store */}
      {related.length > 0 && (
        <section>
          <div className="mb-4 flex items-end justify-between">
            <h2 className="font-display text-2xl font-bold tracking-tight text-fg">More from {store?.name ?? 'this store'}</h2>
            <Link to={`/s/${slug}`} className="text-sm font-bold text-brand-600 hover:underline">
              View all →
            </Link>
          </div>
          <div className="scrollbar-none flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {related.map((rel) => (
              <SpotlightCard key={rel.id} item={rel} slug={slug} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function Spec({ label, value, capitalize = false }: { label: string; value: string; capitalize?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-fg-muted">{label}</dt>
      <dd className={`mt-0.5 font-medium text-fg ${capitalize ? 'capitalize' : ''}`}>{value}</dd>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-fg-muted">{label}</dt>
      <dd className="mt-0.5 font-bold text-fg">{value}</dd>
    </div>
  )
}

function PriceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-fg-muted">{label}</span>
      <span className="font-bold text-fg">{value}</span>
    </div>
  )
}
