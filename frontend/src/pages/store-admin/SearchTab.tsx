import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Minus, Pencil, Plus, Search, Sparkles, TrendingUp, Trash2 } from 'lucide-react'
import api, {
  cardImage,
  formatPrice,
  formatScryfallPrice,
  scryfallPriceCents,
  unwrapCollection,
} from '../../api/client'
import type { CardSummary, InventoryItem } from '../../api/types'
import {
  Card,
  CardHeader,
  CardBody,
  Input,
  Select,
  Field,
  Button,
  Badge,
  Modal,
  EmptyState,
  Pagination,
} from '../../components/ui'
import { InteractiveCard } from '../../components/cards'
import { cx } from '../../lib/cx'
import { FOIL_GRADIENT, rarityAccent } from '../../lib/mtg'

const CONDITIONS = ['NM', 'LP', 'MP', 'HP', 'DMG'] as const
type Condition = (typeof CONDITIONS)[number]

const CONDITION_LABELS: Record<Condition, string> = {
  NM: 'Near Mint',
  LP: 'Lightly Played',
  MP: 'Moderately Played',
  HP: 'Heavily Played',
  DMG: 'Damaged',
}

/** Quantity stepper — − / value / + with a non-negative integer. */
function QuantityStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="inline-flex h-11 items-stretch overflow-hidden rounded-btn border border-border bg-surface">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        aria-label="Decrease quantity"
        className="grid w-11 place-items-center text-fg-muted transition-colors hover:bg-bg hover:text-fg"
      >
        <Minus aria-hidden className="size-4" />
      </button>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        aria-label="Quantity"
        className="w-14 border-x border-border bg-surface text-center text-sm font-bold text-fg focus-visible:outline-none"
      />
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        aria-label="Increase quantity"
        className="grid w-11 place-items-center text-fg-muted transition-colors hover:bg-bg hover:text-fg"
      >
        <Plus aria-hidden className="size-4" />
      </button>
    </div>
  )
}

/** Condition segmented control (single active option). */
function ConditionSegmented({ value, onChange }: { value: Condition; onChange: (v: Condition) => void }) {
  return (
    <div className="flex overflow-hidden rounded-btn border border-border">
      {CONDITIONS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-pressed={value === c}
          title={CONDITION_LABELS[c]}
          className={cx(
            'flex-1 px-2 py-2 text-xs font-bold transition-colors',
            value === c ? 'bg-brand-50 text-brand-700' : 'bg-surface text-fg-muted hover:text-fg',
          )}
        >
          {c}
        </button>
      ))}
    </div>
  )
}

/** Foil toggle switch (binary, immediate). */
function FoilToggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      disabled={disabled}
      onClick={() => onChange(!value)}
      className={cx(
        'relative inline-flex h-11 w-full items-center justify-between rounded-btn border px-3 text-sm font-bold transition-colors disabled:opacity-50',
        value ? 'border-transparent text-black/80' : 'border-border bg-surface text-fg-muted',
      )}
      style={value ? { backgroundImage: FOIL_GRADIENT } : undefined}
    >
      <span className="inline-flex items-center gap-1.5">
        <Sparkles aria-hidden className={cx('size-4', value ? 'opacity-90' : 'opacity-40')} />
        {value ? 'Foil' : 'Nonfoil'}
      </span>
      <span
        className={cx(
          'grid size-6 place-items-center rounded-full bg-white shadow transition-transform',
          value ? 'translate-x-0' : 'translate-x-0',
        )}
      >
        <span className={cx('size-2.5 rounded-full', value ? 'bg-brand-500' : 'bg-border')} />
      </span>
    </button>
  )
}

/** Inventory cards shown per page in the admin grid. */
const INVENTORY_PAGE_SIZE = 24

function parsePriceInput(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value.replace(/[$,\s]/g, ''))
  return Number.isNaN(parsed) ? null : Math.round(parsed * 100)
}

export default function SearchTab({ slug }: { slug: string }) {
  const queryClient = useQueryClient()

  const [filter, setFilter] = useState('')
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogSetFilter, setCatalogSetFilter] = useState('')
  const [catalogFinishFilter, setCatalogFinishFilter] = useState<'all' | 'foil' | 'nonfoil'>('all')
  const [selectedCard, setSelectedCard] = useState<CardSummary | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [priceCents, setPriceCents] = useState<number | null>(null)
  const [condition, setCondition] = useState<Condition>('NM')
  const [isFoil, setIsFoil] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [mutationError, setMutationError] = useState<string | null>(null)

  function applyScryfallPrice(card: CardSummary, foil: boolean) {
    setPriceCents(scryfallPriceCents(card, foil ? 'foil' : 'nonfoil'))
  }

  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory', slug],
    queryFn: async () => {
      const { data } = await api.get(`/stores/${slug}/inventory`)
      return unwrapCollection<InventoryItem>(data)
    },
  })

  const { data: catalogResults = [], refetch: runCatalogSearch } = useQuery({
    queryKey: ['card-search', catalogSearch, catalogSetFilter, catalogFinishFilter],
    queryFn: async () => {
      if (!catalogSearch.trim()) return []
      const { data } = await api.get<CardSummary[]>('/catalog/search', {
        params: {
          q: catalogSearch,
          ...(catalogSetFilter.trim() ? { set: catalogSetFilter.trim() } : {}),
          ...(catalogFinishFilter !== 'all' ? { finish: catalogFinishFilter } : {}),
        },
      })
      return data
    },
    enabled: false,
  })

  function selectCatalogCard(card: CardSummary) {
    setSelectedCard(card)
    let nextIsFoil = isFoil
    if (catalogFinishFilter === 'foil') {
      nextIsFoil = true
    } else if (catalogFinishFilter === 'nonfoil') {
      nextIsFoil = false
    } else if (card.finishes?.includes('foil') && !card.finishes.includes('nonfoil')) {
      nextIsFoil = true
    } else if (card.finishes?.includes('nonfoil') && !card.finishes.includes('foil')) {
      nextIsFoil = false
    }
    setIsFoil(nextIsFoil)
    applyScryfallPrice(card, nextIsFoil)
  }

  function handleFinishChange(value: 'nonfoil' | 'foil') {
    const nextIsFoil = value === 'foil'
    setIsFoil(nextIsFoil)
    if (selectedCard) {
      applyScryfallPrice(selectedCard, nextIsFoil)
    }
  }

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCard) return
      await api.post(`/stores/${slug}/inventory`, {
        cardId: selectedCard.id,
        quantity,
        priceCents: priceCents ?? 0,
        condition,
        isFoil,
      })
    },
    onMutate: () => setMutationError(null),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['inventory', slug] })
      setSelectedCard(null)
      setCatalogSearch('')
    },
    onError: (err: { response?: { data?: { detail?: string } }; message?: string }) => {
      setMutationError(err.response?.data?.detail ?? err.message ?? 'Could not add inventory item.')
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (payload: {
      itemId: number
      cardId: string
      quantity: number
      priceText: string
      condition: Condition
      isFoil: boolean
    }) => {
      const { data } = await api.patch<InventoryItem>(`/stores/${slug}/inventory/${payload.itemId}`, {
        cardId: payload.cardId,
        quantity: payload.quantity,
        priceCents: parsePriceInput(payload.priceText) ?? 0,
        condition: payload.condition,
        isFoil: payload.isFoil,
      })
      return data
    },
    onMutate: () => setMutationError(null),
    onSuccess: (updated, payload) => {
      // Write the server's result straight into the cache so the list reflects
      // the edit immediately (don't rely solely on the refetch), then invalidate
      // to reconcile the merge/removal case.
      queryClient.setQueryData<InventoryItem[]>(['inventory', slug], (old = []) =>
        old.map((it) => (it.id === payload.itemId ? { ...it, ...updated } : it)),
      )
      void queryClient.invalidateQueries({ queryKey: ['inventory', slug] })
      setEditingItem(null)
    },
    onError: (err: { response?: { data?: { detail?: string } }; message?: string }) => {
      setMutationError(err.response?.data?.detail ?? err.message ?? 'Could not save changes.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/stores/${slug}/inventory/${id}`)
      return id
    },
    onMutate: () => setMutationError(null),
    onSuccess: (id) => {
      queryClient.setQueryData<InventoryItem[]>(['inventory', slug], (old = []) =>
        old.filter((it) => it.id !== id),
      )
      void queryClient.invalidateQueries({ queryKey: ['inventory', slug] })
    },
    onError: (err: { response?: { data?: { detail?: string } }; message?: string }) => {
      setMutationError(err.response?.data?.detail ?? err.message ?? 'Could not remove inventory item.')
    },
  })

  const filteredInventory = useMemo(() => {
    const term = filter.trim().toLowerCase()
    if (!term) return inventory
    return inventory.filter((item) => {
      const card = item.card
      return (
        card.name.toLowerCase().includes(term) ||
        (card.setCode ?? '').toLowerCase().includes(term) ||
        (card.setName ?? '').toLowerCase().includes(term) ||
        (card.typeLine ?? '').toLowerCase().includes(term)
      )
    })
  }, [inventory, filter])

  // Paginate the inventory grid; reset to page 1 when the search filter changes.
  const [invPage, setInvPage] = useState(1)
  useEffect(() => {
    setInvPage(1)
  }, [filter])
  const invPageCount = Math.max(1, Math.ceil(filteredInventory.length / INVENTORY_PAGE_SIZE))
  const currentInvPage = Math.min(invPage, invPageCount)
  const visibleInventory = filteredInventory.slice(
    (currentInvPage - 1) * INVENTORY_PAGE_SIZE,
    currentInvPage * INVENTORY_PAGE_SIZE,
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Add inventory" subtitle="Search the catalog, then add a printing to this store." />
        <CardBody className="space-y-5">
          {mutationError && (
            <p role="alert" className="text-sm font-medium text-danger-700">
              {mutationError}
            </p>
          )}

          <div className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_8rem_10rem_auto] lg:items-end">
            <Field label="Card name">
              {({ id }) => (
                <Input
                  id={id}
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void runCatalogSearch()}
                  placeholder="Search card name…"
                />
              )}
            </Field>
            <Field label="Set">
              {({ id }) => (
                <Input
                  id={id}
                  value={catalogSetFilter}
                  onChange={(e) => setCatalogSetFilter(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void runCatalogSearch()}
                  placeholder="Set code"
                  className="uppercase"
                />
              )}
            </Field>
            <Field label="Finish">
              {({ id }) => (
                <Select
                  id={id}
                  value={catalogFinishFilter}
                  onChange={(e) => setCatalogFinishFilter(e.target.value as 'all' | 'foil' | 'nonfoil')}
                >
                  <option value="all">All finishes</option>
                  <option value="nonfoil">Nonfoil only</option>
                  <option value="foil">Foil only</option>
                </Select>
              )}
            </Field>
            <Button onClick={() => void runCatalogSearch()}>
              <Search className="size-4" aria-hidden />
              Search
            </Button>
          </div>

          {catalogResults.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {catalogResults.map((card) => (
                <CatalogResultCard
                  key={card.id}
                  card={card}
                  selected={selectedCard?.id === card.id}
                  onSelect={() => selectCatalogCard(card)}
                />
              ))}
            </div>
          )}

          {selectedCard && (
            <SelectedCardEditor
              card={selectedCard}
              quantity={quantity}
              condition={condition}
              isFoil={isFoil}
              pending={addMutation.isPending}
              onQuantityChange={setQuantity}
              onConditionChange={setCondition}
              onFinishChange={handleFinishChange}
              onAdd={() => addMutation.mutate()}
            />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Store inventory"
          subtitle="Each item includes art, price, quantity, and quick edit actions."
          actions={
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search this store's inventory…"
              className="min-w-64"
            />
          }
        />
        <CardBody>
          {filteredInventory.length === 0 ? (
            <EmptyState
              icon={Search}
              title={filter.trim() ? 'No matching inventory' : 'No inventory yet'}
              description={
                filter.trim()
                  ? 'No inventory matches your search.'
                  : 'Add cards above or import a CSV to get started.'
              }
            />
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                {visibleInventory.map((item) => (
                  <InventoryResultCard
                    key={item.id}
                    item={item}
                    onEdit={() => setEditingItem(item)}
                    onDelete={() => deleteMutation.mutate(item.id)}
                    deleting={deleteMutation.isPending}
                  />
                ))}
              </div>
              <Pagination
                page={currentInvPage}
                pageCount={invPageCount}
                onPageChange={setInvPage}
                totalItems={filteredInventory.length}
              />
            </div>
          )}
        </CardBody>
      </Card>

      <EditInventoryModal
        slug={slug}
        item={editingItem}
        inventory={inventory}
        pending={updateMutation.isPending}
        onClose={() => setEditingItem(null)}
        onSave={(payload) => updateMutation.mutate(payload)}
      />
    </div>
  )
}

function CatalogResultCard({
  card,
  selected,
  onSelect,
}: {
  card: CardSummary
  selected: boolean
  onSelect: () => void
}) {
  const previewFinish = card.finishes?.includes('foil') && !card.finishes.includes('nonfoil') ? 'foil' : 'nonfoil'
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex min-h-28 items-start gap-3 rounded-card border px-3 py-3 text-left transition-colors ${
        selected ? 'border-brand-500 bg-brand-50' : 'border-border bg-surface hover:bg-bg'
      }`}
    >
      {cardImage(card) && (
        <img src={cardImage(card)} alt={card.name} className="h-20 w-auto flex-shrink-0 rounded-btn" />
      )}
      <span className="min-w-0 space-y-1">
        <span className="block font-bold leading-snug text-fg">{card.name}</span>
        <span className="block text-xs uppercase text-fg-muted">
          {card.setCode ?? '---'} #{card.collectorNumber ?? '---'}
          {card.rarity ? ` · ${card.rarity}` : ''}
        </span>
        {card.setName && <span className="block truncate text-xs text-fg-muted">{card.setName}</span>}
        <span className="block text-xs font-bold text-brand-600">{formatScryfallPrice(card, previewFinish)}</span>
        <span className="flex flex-wrap gap-1 pt-1">
          {(card.finishes?.length ? card.finishes : ['nonfoil']).map((finish) => (
            <Badge key={finish} className="uppercase">
              {finish}
            </Badge>
          ))}
        </span>
      </span>
    </button>
  )
}

function SelectedCardEditor({
  card,
  quantity,
  condition,
  isFoil,
  pending,
  onQuantityChange,
  onConditionChange,
  onFinishChange,
  onAdd,
}: {
  card: CardSummary
  quantity: number
  condition: Condition
  isFoil: boolean
  pending: boolean
  onQuantityChange: (value: number) => void
  onConditionChange: (value: Condition) => void
  onFinishChange: (value: 'nonfoil' | 'foil') => void
  onAdd: () => void
}) {
  const onlyFoil = card.finishes?.includes('foil') && !card.finishes?.includes('nonfoil')
  const onlyNonfoil = card.finishes?.includes('nonfoil') && !card.finishes?.includes('foil')
  return (
    <div className="rounded-card border border-border bg-bg p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-fg">{card.name}</h3>
          <p className="text-sm text-fg-muted">
            {(card.setCode ?? '---').toUpperCase()} #{card.collectorNumber ?? '---'}
            {card.setName ? ` · ${card.setName}` : ''}
          </p>
        </div>
        <p className="text-xs uppercase text-fg-muted">
          {(card.finishes?.length ? card.finishes : ['nonfoil']).join(' / ')}
        </p>
      </div>

      <div className="mt-4 grid gap-3 rounded-card border border-border bg-surface p-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Meta label="Market price" value={formatScryfallPrice(card, isFoil ? 'foil' : 'nonfoil')} />
        <Meta label="Mana cost" value={card.manaCost || '-'} />
        <Meta label="Released" value={card.releasedAt || '-'} />
        <Meta label="Artist" value={card.artist || '-'} />
        {card.oracleText && <p className="text-fg sm:col-span-2 lg:col-span-4">{card.oracleText}</p>}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 text-sm font-bold text-fg">Quantity</p>
          <QuantityStepper value={quantity} onChange={onQuantityChange} />
        </div>
        <div>
          <p className="mb-1.5 text-sm font-bold text-fg">Finish</p>
          <FoilToggle
            value={isFoil}
            onChange={(v) => onFinishChange(v ? 'foil' : 'nonfoil')}
            disabled={Boolean(onlyFoil || onlyNonfoil)}
          />
        </div>
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-sm font-bold text-fg">Condition</p>
          <ConditionSegmented value={condition} onChange={onConditionChange} />
        </div>
        <div className="flex items-center justify-between rounded-card border border-border bg-surface px-4 py-3 sm:col-span-2">
          <span className="text-sm text-fg-muted">Market price — applied automatically on add</span>
          <span className="font-display text-xl font-bold text-fg">
            {formatScryfallPrice(card, isFoil ? 'foil' : 'nonfoil')}
          </span>
        </div>
      </div>

      <div className="mt-4">
        <Button onClick={onAdd} loading={pending}>
          <Plus className="size-4" aria-hidden />
          Add {card.name}
        </Button>
      </div>
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase text-fg-muted">{label}</p>
      <p className="font-bold text-fg">{value}</p>
    </div>
  )
}

function InventoryResultCard({
  item,
  onEdit,
  onDelete,
  deleting,
}: {
  item: InventoryItem
  onEdit: () => void
  onDelete: () => void
  deleting: boolean
}) {
  const accent = rarityAccent(item.card.rarity)
  const image = cardImage(item.card)
  return (
    <div className="group flex gap-4 rounded-card border border-border bg-surface p-4 shadow-card transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-16px_rgb(16_24_40_/0.25)]">
      <div className="relative h-32 w-[5.5rem] flex-shrink-0 overflow-hidden rounded-btn border-2" style={{ borderColor: accent }}>
        {image ? (
          <img src={image} alt={item.card.name} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center px-2 text-center text-xs text-fg-muted">No image</div>
        )}
        {item.isFoil && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-50 mix-blend-color-dodge"
            style={{ backgroundImage: FOIL_GRADIENT, backgroundSize: '200% 200%' }}
          />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: accent }} />
              <h3 className="truncate font-display text-base font-bold tracking-tight text-fg">{item.card.name}</h3>
            </div>
            <p className="mt-0.5 text-xs uppercase tracking-wide text-fg-muted">
              {item.card.setCode?.toUpperCase() ?? '-'} · #{item.card.collectorNumber ?? '-'}
            </p>
          </div>
          <div className="flex flex-shrink-0 gap-1">
            <Button variant="ghost" size="sm" onClick={onEdit} aria-label={`Edit ${item.card.name}`} title="Edit item">
              <Pencil className="size-4" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              loading={deleting}
              aria-label={`Remove ${item.card.name}`}
              title="Remove item"
              className="text-danger-700"
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge>{item.condition}</Badge>
          {item.isFoil ? (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-white/60 px-2 py-0.5 text-[0.7rem] font-bold text-black/80"
              style={{ backgroundImage: FOIL_GRADIENT }}
            >
              <Sparkles aria-hidden className="size-3" />
              Foil
            </span>
          ) : (
            <Badge tone="neutral">Nonfoil</Badge>
          )}
          <Badge tone="brand">{item.quantity} in stock</Badge>
        </div>

        {item.notes && <p className="mt-2 line-clamp-1 text-xs text-fg-muted">{item.notes}</p>}

        <div className="mt-auto grid grid-cols-2 gap-3 pt-3 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-fg-muted">Your price</p>
            <p className="mt-0.5 font-display text-lg font-bold text-fg">{formatPrice(item.priceCents)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-fg-muted">Market</p>
            <p className="mt-0.5 font-display text-lg font-bold text-fg">
              {formatScryfallPrice(item.card, item.isFoil ? 'foil' : 'nonfoil')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function EditInventoryModal({
  slug,
  item,
  inventory,
  pending,
  onClose,
  onSave,
}: {
  slug: string
  item: InventoryItem | null
  inventory: InventoryItem[]
  pending: boolean
  onClose: () => void
  onSave: (payload: {
    itemId: number
    cardId: string
    quantity: number
    priceText: string
    condition: Condition
    isFoil: boolean
  }) => void
}) {
  if (!item) return null
  return <EditInventoryModalBody slug={slug} item={item} inventory={inventory} pending={pending} onClose={onClose} onSave={onSave} />
}

function EditInventoryModalBody({
  slug,
  item,
  inventory,
  pending,
  onClose,
  onSave,
}: {
  slug: string
  item: InventoryItem
  inventory: InventoryItem[]
  pending: boolean
  onClose: () => void
  onSave: (payload: {
    itemId: number
    cardId: string
    quantity: number
    priceText: string
    condition: Condition
    isFoil: boolean
  }) => void
}) {
  const [editSelectedCard, setEditSelectedCard] = useState<CardSummary>(item.card)
  const [editQuantity, setEditQuantity] = useState(item.quantity)
  const [editPriceText, setEditPriceText] = useState(formatPrice(item.priceCents))
  const [editCondition, setEditCondition] = useState<Condition>(item.condition)
  const [editIsFoil, setEditIsFoil] = useState(item.isFoil)
  const [variantSearchActive, setVariantSearchActive] = useState(false)

  const marketCents = scryfallPriceCents(editSelectedCard, editIsFoil ? 'foil' : 'nonfoil')
  const priceCents = parsePriceInput(editPriceText)
  const priceInvalid = priceCents === null

  // Warn when the chosen printing + condition + finish already exists on another
  // listing — saving will MERGE (sum quantities) rather than create a duplicate.
  const mergeTarget = inventory.find(
    (it) =>
      it.id !== item.id &&
      it.card.id === editSelectedCard.id &&
      it.condition === editCondition &&
      it.isFoil === editIsFoil,
  )

  const { data: variantResults = [], isFetching: variantsLoading } = useQuery({
    queryKey: ['card-variants', slug, item.card.id, item.card.name],
    queryFn: async () => {
      const { data } = await api.get<CardSummary[]>('/catalog/search', {
        params: { q: item.card.name },
      })
      return data.filter((card) => card.id !== item.card.id).slice(0, 12)
    },
    enabled: variantSearchActive,
  })

  function selectVariant(card: CardSummary) {
    setEditSelectedCard(card)
    const cardHasFoil = card.finishes?.includes('foil') ?? false
    const cardHasNonfoil = card.finishes?.includes('nonfoil') ?? false
    const nextIsFoil = cardHasFoil && !cardHasNonfoil ? true : cardHasNonfoil && !cardHasFoil ? false : editIsFoil
    setEditIsFoil(nextIsFoil)
    setEditPriceText(formatPrice(scryfallPriceCents(card, nextIsFoil ? 'foil' : 'nonfoil') ?? 0))
  }

  function useMarketPrice() {
    if (marketCents !== null) setEditPriceText(formatPrice(marketCents))
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit ${item.card.name}`}
      className="max-w-[calc(100vw-2rem)] 2xl:max-w-[92rem]"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={pending}
            disabled={priceInvalid}
            onClick={() =>
              onSave({
                itemId: item.id,
                cardId: editSelectedCard.id,
                quantity: editQuantity,
                priceText: editPriceText,
                condition: editCondition,
                isFoil: editIsFoil,
              })
            }
          >
            {mergeTarget ? 'Save & merge' : 'Save changes'}
          </Button>
        </>
      }
    >
      <div className="space-y-8">
        <div className="grid gap-8 xl:grid-cols-[24rem_minmax(0,1fr)]">
          {/* Left: interactive holographic card + facts */}
          <div className="space-y-4">
            <InteractiveCard
              image={cardImage(editSelectedCard)}
              alt={editSelectedCard.name}
              foil={editIsFoil}
              accent={rarityAccent(editSelectedCard.rarity)}
              maxTilt={12}
            />
            <div>
              <p className="font-display font-bold leading-snug text-fg">{editSelectedCard.name}</p>
              <p className="text-xs uppercase tracking-wide text-fg-muted">
                {editSelectedCard.setCode?.toUpperCase() ?? '-'} · #{editSelectedCard.collectorNumber ?? '-'}
              </p>
            </div>
            <dl className="space-y-2 border-t border-border pt-3 text-sm">
              <Row label="Stored price" value={formatPrice(item.priceCents)} />
              <Row label="Market price" value={marketCents !== null ? formatPrice(marketCents) : 'Unavailable'} />
              <Row label="In stock" value={String(item.quantity)} />
            </dl>
          </div>

          {/* Right: interactive editable fields */}
          <div className="space-y-5">
            <div>
              <p className="mb-1.5 text-sm font-bold text-fg">Quantity</p>
              <QuantityStepper value={editQuantity} onChange={setEditQuantity} />
            </div>

            <div>
              <p className="mb-1.5 text-sm font-bold text-fg">Condition</p>
              <ConditionSegmented value={editCondition} onChange={setEditCondition} />
              <p className="mt-1 text-xs text-fg-muted">{CONDITION_LABELS[editCondition]}</p>
            </div>

            <div>
              <p className="mb-1.5 text-sm font-bold text-fg">Finish</p>
              <FoilToggle value={editIsFoil} onChange={setEditIsFoil} />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-sm font-bold text-fg">Price</p>
                <button
                  type="button"
                  onClick={useMarketPrice}
                  disabled={marketCents === null}
                  className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 hover:underline disabled:cursor-not-allowed disabled:text-fg-muted disabled:no-underline"
                >
                  <TrendingUp aria-hidden className="size-3.5" />
                  Use market {marketCents !== null ? `(${formatPrice(marketCents)})` : '(n/a)'}
                </button>
              </div>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted">$</span>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={editPriceText}
                  onChange={(e) => setEditPriceText(e.target.value)}
                  aria-invalid={priceInvalid || undefined}
                  className="pl-7"
                />
              </div>
              {priceInvalid && <p className="mt-1 text-xs font-medium text-danger-700">Enter a valid price.</p>}
            </div>

            {mergeTarget && (
              <div className="flex gap-2 rounded-card border border-warning-500/40 bg-warning-50 p-3 text-sm text-warning-700">
                <AlertTriangle aria-hidden className="mt-0.5 size-4 flex-shrink-0" />
                <p>
                  A listing for this printing ({editCondition}, {editIsFoil ? 'Foil' : 'Nonfoil'}) already exists with{' '}
                  <span className="font-bold">{mergeTarget.quantity}</span> in stock. Saving will <span className="font-bold">merge</span>{' '}
                  them into one listing of <span className="font-bold">{mergeTarget.quantity + editQuantity}</span>.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Variants — spans the full modal width so cards have room to breathe */}
        <div className="border-t border-border pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-bold text-fg">Variants</h3>
              <p className="text-xs text-fg-muted">
                {variantSearchActive ? 'Other printings matching this name.' : 'Find other printings of this card.'}
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setVariantSearchActive(true)} loading={variantsLoading}>
              <Search className="size-4" aria-hidden />
              Find variants
            </Button>
          </div>

          {variantSearchActive && (
            <div className="mt-4">
              {variantResults.length > 0 ? (
                <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                  {variantResults.map((card) => {
                    const selectedVariant = editSelectedCard.id === card.id
                    const previewFinish =
                      card.finishes?.includes('foil') && !card.finishes.includes('nonfoil') ? 'foil' : 'nonfoil'
                    return (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => selectVariant(card)}
                        className={`flex min-h-40 items-start gap-4 rounded-card border p-4 text-left transition-colors ${
                          selectedVariant
                            ? 'border-brand-500 bg-brand-50'
                            : 'border-border bg-surface hover:border-brand-300'
                        }`}
                      >
                        <div className="h-32 w-[5.75rem] flex-shrink-0 overflow-hidden rounded-btn border border-border bg-bg">
                          {cardImage(card) ? (
                            <img src={cardImage(card)} alt={card.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="grid h-full place-items-center text-[0.7rem] text-fg-muted">No image</div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-display text-base font-bold leading-snug text-fg [overflow-wrap:anywhere]">{card.name}</p>
                          <p className="mt-0.5 text-xs uppercase text-fg-muted">
                            {card.setCode?.toUpperCase() ?? '-'} · #{card.collectorNumber ?? '-'}
                          </p>
                          <p className="mt-1 text-sm font-bold text-brand-600">{formatScryfallPrice(card, previewFinish)}</p>
                          {card.setName && <p className="mt-1 line-clamp-2 text-xs text-fg-muted">{card.setName}</p>}
                          {card.rarity && <Badge className="mt-2 capitalize">{card.rarity}</Badge>}
                          {selectedVariant && (
                            <p className="mt-1 text-[0.7rem] font-semibold uppercase tracking-wide text-brand-600">
                              Selected
                            </p>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                !variantsLoading && <p className="text-sm text-fg-muted">No additional variants found.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-fg-muted">{label}</span>
      <span className="font-bold text-fg">{value}</span>
    </div>
  )
}
