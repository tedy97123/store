import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ExternalLink,
  Heart,
  ImageOff,
  ListPlus,
  Settings,
  ShoppingCart,
  UserCircle,
} from 'lucide-react'
import api, { cardImage, formatScryfallPrice } from '../api/client'
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
import {
  Badge,
  Button,
  buttonVariants,
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  LoadingPanel,
  PageHeader,
} from '../components/ui'

function formatDate(value?: string): string {
  if (!value) return '-'
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
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
    // Optimistic toggle: update the cache immediately so rapid clicks read the
    // already-flipped state and the button reflects the pending result.
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
      <Card>
        <ErrorState title="Card listing not found" description="This listing could not be loaded." />
      </Card>
    )
  }

  const card = item.card
  const finish = item.isFoil ? 'foil' : 'nonfoil'
  const legalFormats = legalities(card)
  const isFavorite = favorites.some((favorite) => favorite.inventoryItem?.id === item.id)
  const isWanted = wantList.some(
    (entry) =>
      entry.card?.id === item.card.id ||
      (entry.cardName.toLowerCase() === item.card.name.toLowerCase() && entry.setCode === item.card.setCode),
  )

  // Flat definition list — only fields that actually have a value are shown
  // (no more empty "MANA COST —" / "KEYWORDS —" tiles).
  const powerToughness =
    card.power || card.toughness ? `${card.power ?? '—'} / ${card.toughness ?? '—'}` : ''
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

  // Only show Scryfall price rows that have a real value (nonfoil always shown).
  const priceRows = (
    [
      { label: 'Nonfoil', value: formatScryfallPrice(card, 'nonfoil') },
      { label: 'Foil', value: formatScryfallPrice(card, 'foil') },
      { label: 'Etched', value: formatScryfallPrice(card, 'etched') },
    ] as { label: string; value: string }[]
  ).filter((row, index) => index === 0 || row.value !== '-')

  return (
    <div className="space-y-6">
      <PageHeader
        title={card.name}
        subtitle={
          <Link
            to={`/s/${slug}`}
            className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline"
          >
            <ArrowLeft aria-hidden className="size-4" />
            Back to {store?.name ?? 'store'}
          </Link>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {user && (
              <Link to={`/s/${slug}/account`} className={buttonVariants({ variant: 'ghost' })}>
                <UserCircle aria-hidden className="size-4" />
                My account
              </Link>
            )}
            {canManage && (
              <Link to={`/s/${slug}/admin`} className={buttonVariants({ variant: 'secondary' })}>
                <Settings aria-hidden className="size-4" />
                Manage listing
              </Link>
            )}
          </div>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[20rem_minmax(0,1fr)_19rem]">
        {/* Card image — prominent, flat, sticky on scroll */}
        <div className="self-start lg:sticky lg:top-8">
          {cardImage(card) ? (
            <img
              src={cardImage(card)}
              alt={card.name}
              className="w-full rounded-2xl shadow-card"
            />
          ) : (
            <div className="grid aspect-[5/7] place-items-center rounded-2xl border border-border bg-surface text-fg-muted">
              <ImageOff aria-hidden className="size-8" />
            </div>
          )}
        </div>

        {/* Main details */}
        <Card className="min-w-0">
          <CardBody className="space-y-6">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-brand-600">
                {(card.setCode ?? '—').toUpperCase()} · #{card.collectorNumber ?? '—'}
              </p>
              <h2 className="mt-1 font-display text-4xl font-bold tracking-tight text-fg">{card.name}</h2>
              {card.typeLine && <p className="mt-2 text-fg-muted">{card.typeLine}</p>}
              <div className="mt-4 flex flex-wrap gap-1.5">
                {card.rarity && (
                  <Badge tone={rarityTone(card.rarity)} className="capitalize">
                    {card.rarity}
                  </Badge>
                )}
                <Badge tone={item.isFoil ? 'brand' : 'neutral'}>{item.isFoil ? 'Foil' : 'Nonfoil'}</Badge>
                <Badge>{item.condition}</Badge>
              </div>
            </div>

            {card.oracleText && (
              <div className="rounded-card bg-bg p-5">
                <p className="whitespace-pre-line leading-7 text-fg">{card.oracleText}</p>
                {card.flavorText && (
                  <p className="mt-4 whitespace-pre-line border-t border-border pt-4 text-sm italic text-fg-muted">
                    {card.flavorText}
                  </p>
                )}
              </div>
            )}

            {specs.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-fg-muted">Card details</h3>
                <dl className="mt-3 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                  {specs.map((spec) => (
                    <Spec key={spec.label} label={spec.label} value={spec.value} capitalize={spec.capitalize} />
                  ))}
                </dl>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Right rail */}
        <div className="space-y-4">
          <Card>
            <CardBody>
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
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Customer actions" />
            <CardBody className="space-y-2">
              {user ? (
                <>
                  <Button
                    variant={isFavorite ? 'secondary' : 'primary'}
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
                    className="w-full"
                    loading={wantListMutation.isPending}
                    disabled={wantListMutation.isPending || isWanted}
                    onClick={() => wantListMutation.mutate(item)}
                  >
                    {isWanted ? (
                      <ShoppingCart aria-hidden className="size-4" />
                    ) : (
                      <ListPlus aria-hidden className="size-4" />
                    )}
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
                <Link to="/login" className={`${buttonVariants({ variant: 'primary' })} w-full`}>
                  Sign in to save cards
                </Link>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Scryfall prices" />
            <CardBody className="space-y-2">
              {priceRows.map((row) => (
                <PriceRow key={row.label} label={row.label} value={row.value} />
              ))}
              {card.scryfallUri && (
                <a
                  href={card.scryfallUri}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
                >
                  <ExternalLink aria-hidden className="size-4" />
                  View on Scryfall
                </a>
              )}
            </CardBody>
          </Card>

          {legalFormats.length > 0 && (
            <Card>
              <CardHeader title="Legal formats" />
              <CardBody>
                <div className="flex flex-wrap gap-1.5">
                  {legalFormats.map(([format]) => (
                    <Badge key={format} tone="success" className="uppercase">
                      {format}
                    </Badge>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

type RarityTone = 'brand' | 'success' | 'warning' | 'danger' | 'neutral'

function rarityTone(rarity?: string): RarityTone {
  switch ((rarity ?? '').toLowerCase()) {
    case 'mythic':
      return 'warning'
    case 'rare':
      return 'brand'
    default:
      return 'neutral'
  }
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
