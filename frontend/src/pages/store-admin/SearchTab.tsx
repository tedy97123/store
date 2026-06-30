import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
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
  CardFooter,
  Input,
  Select,
  Field,
  Button,
  Badge,
  Modal,
  EmptyState,
  Pagination,
} from '../../components/ui'

const CONDITIONS = ['NM', 'LP', 'MP', 'HP', 'DMG'] as const
type Condition = (typeof CONDITIONS)[number]

/** Inventory cards shown per page in the admin grid. */
const INVENTORY_PAGE_SIZE = 24

function parsePriceInput(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value.replace(/[$,\s]/g, ''))
  return Number.isNaN(parsed) ? null : Math.round(parsed * 100)
}

/** Clamp a numeric text input to a non-negative integer, treating empty/NaN as 0. */
function clampQuantity(value: string): number {
  return Math.max(0, Number(value) || 0)
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

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Quantity">
          {({ id }) => (
            <Input
              id={id}
              type="number"
              min={0}
              value={quantity}
              onChange={(e) => onQuantityChange(clampQuantity(e.target.value))}
            />
          )}
        </Field>
        <Field label="Market price">
          <div className="flex h-10 items-center rounded-btn border border-border bg-surface px-3 text-sm font-bold text-fg">
            {formatScryfallPrice(card, isFoil ? 'foil' : 'nonfoil')}
          </div>
        </Field>
        <Field label="Condition">
          {({ id }) => (
            <Select id={id} value={condition} onChange={(e) => onConditionChange(e.target.value as Condition)}>
              {CONDITIONS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Inventory finish">
          {({ id }) => (
            <Select
              id={id}
              value={isFoil ? 'foil' : 'nonfoil'}
              onChange={(e) => onFinishChange(e.target.value as 'nonfoil' | 'foil')}
            >
              <option value="nonfoil" disabled={onlyFoil}>
                Nonfoil
              </option>
              <option value="foil" disabled={onlyNonfoil}>
                Foil
              </option>
            </Select>
          )}
        </Field>
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
  return (
    <Card className="overflow-hidden">
      <div className="flex gap-4 p-4">
        <div className="flex h-40 w-28 flex-shrink-0 items-center justify-center overflow-hidden rounded-card border border-border bg-bg">
          {cardImage(item.card) ? (
            <img src={cardImage(item.card)} alt={item.card.name} className="h-full w-full object-cover" />
          ) : (
            <span className="px-2 text-center text-xs text-fg-muted">No image</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold text-fg">{item.card.name}</h3>
              <p className="text-xs uppercase text-fg-muted">
                {item.card.setCode ?? '-'} #{item.card.collectorNumber ?? '-'}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onEdit} aria-label={`Edit ${item.card.name}`} title="Edit item">
              <Pencil className="size-4" aria-hidden />
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge>{item.condition}</Badge>
            <Badge>{item.isFoil ? 'Foil' : 'Nonfoil'}</Badge>
            <Badge>{item.quantity} qty</Badge>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-card border border-border bg-bg p-3">
              <p className="text-xs uppercase text-fg-muted">Stored price</p>
              <p className="mt-1 font-bold text-fg">{formatPrice(item.priceCents)}</p>
            </div>
            <div className="rounded-card border border-border bg-bg p-3">
              <p className="text-xs uppercase text-fg-muted">Market price</p>
              <p className="mt-1 font-bold text-fg">
                {formatScryfallPrice(item.card, item.isFoil ? 'foil' : 'nonfoil')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {item.notes && <div className="border-t border-border px-4 py-3 text-sm text-fg-muted">{item.notes}</div>}

      <CardFooter className="justify-between">
        <p className="text-xs text-fg-muted">Added to store inventory</p>
        <Button variant="ghost" size="sm" onClick={onDelete} loading={deleting} className="text-danger-700">
          <Trash2 className="size-4" aria-hidden />
          Remove
        </Button>
      </CardFooter>
    </Card>
  )
}

function EditInventoryModal({
  slug,
  item,
  pending,
  onClose,
  onSave,
}: {
  slug: string
  item: InventoryItem | null
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
  return <EditInventoryModalBody slug={slug} item={item} pending={pending} onClose={onClose} onSave={onSave} />
}

function EditInventoryModalBody({
  slug,
  item,
  pending,
  onClose,
  onSave,
}: {
  slug: string
  item: InventoryItem
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

  const { data: variantResults = [], isFetching: variantsLoading } = useQuery({
    // Key on the card id (not just the name) so distinct printings of the same
    // name don't collide in the query cache.
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

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit ${item.card.name}`}
      className="max-w-4xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={pending}
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
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-6 sm:grid-cols-[13rem_minmax(0,1fr)]">
          {/* Left: full card art + facts (flat — no nested card chrome) */}
          <div className="space-y-4">
            {cardImage(editSelectedCard) ? (
              <img
                src={cardImage(editSelectedCard)}
                alt={editSelectedCard.name}
                className="w-full rounded-card border border-border"
              />
            ) : (
              <div className="grid aspect-[5/7] place-items-center rounded-card border border-border bg-bg text-fg-muted">
                No image
              </div>
            )}

            <div>
              <p className="font-bold leading-snug text-fg">{editSelectedCard.name}</p>
              <p className="text-xs uppercase tracking-wide text-fg-muted">
                {editSelectedCard.setCode?.toUpperCase() ?? '-'} · #{editSelectedCard.collectorNumber ?? '-'}
              </p>
            </div>

            <dl className="space-y-2 border-t border-border pt-3 text-sm">
              <Row label="Stored price" value={formatPrice(item.priceCents)} />
              <Row label="Market price" value={formatScryfallPrice(editSelectedCard, editIsFoil ? 'foil' : 'nonfoil')} />
              <Row label="In stock" value={String(item.quantity)} />
            </dl>
          </div>

          {/* Right: editable fields */}
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Quantity">
                {({ id }) => (
                  <Input
                    id={id}
                    type="number"
                    min={0}
                    value={editQuantity}
                    onChange={(e) => setEditQuantity(clampQuantity(e.target.value))}
                  />
                )}
              </Field>
              <Field label="Price">
                {({ id }) => (
                  <Input id={id} type="text" inputMode="decimal" value={editPriceText} onChange={(e) => setEditPriceText(e.target.value)} />
                )}
              </Field>
              <Field label="Condition">
                {({ id }) => (
                  <Select id={id} value={editCondition} onChange={(e) => setEditCondition(e.target.value as Condition)}>
                    {CONDITIONS.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Finish">
                {({ id }) => (
                  <Select id={id} value={editIsFoil ? 'foil' : 'nonfoil'} onChange={(e) => setEditIsFoil(e.target.value === 'foil')}>
                    <option value="nonfoil">Nonfoil</option>
                    <option value="foil">Foil</option>
                  </Select>
                )}
              </Field>
            </div>

            <p className="text-xs text-fg-muted">
              Saving replaces this listing with the selected printing. If that printing already exists, it will be merged.
            </p>
          </div>
        </div>

        {/* Variants — spans the full modal width so cards have room to breathe */}
        <div className="border-t border-border pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-fg">Variants</h3>
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
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {variantResults.map((card) => {
                    const selectedVariant = editSelectedCard.id === card.id
                    const previewFinish =
                      card.finishes?.includes('foil') && !card.finishes.includes('nonfoil') ? 'foil' : 'nonfoil'
                    return (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => selectVariant(card)}
                        className={`flex items-start gap-3 rounded-card border p-3 text-left transition-colors ${
                          selectedVariant
                            ? 'border-brand-500 bg-brand-50'
                            : 'border-border bg-surface hover:border-brand-300'
                        }`}
                      >
                        <div className="h-20 w-14 flex-shrink-0 overflow-hidden rounded-btn border border-border bg-bg">
                          {cardImage(card) ? (
                            <img src={cardImage(card)} alt={card.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="grid h-full place-items-center text-[0.7rem] text-fg-muted">No image</div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold leading-snug text-fg [overflow-wrap:anywhere]">{card.name}</p>
                          <p className="mt-0.5 text-xs uppercase text-fg-muted">
                            {card.setCode?.toUpperCase() ?? '-'} · #{card.collectorNumber ?? '-'}
                          </p>
                          <p className="mt-1 text-sm font-bold text-brand-600">{formatScryfallPrice(card, previewFinish)}</p>
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
