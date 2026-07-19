import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { GalleryHorizontalEnd, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react'
import api, { cardImage, extractErrorMessage, formatPrice, parsePriceInput } from '../../api/client'
import { storeSectionsKey, useInventory, useStoreSections } from '../../hooks'
import { useDebouncedValue } from '../../hooks'
import type { InventoryItem, StoreSection, StoreSectionMode } from '../../api/types'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Input,
  LoadingPanel,
  Modal,
  Select,
} from '../../components/ui'

/** Rarities the auto-fill filter accepts — must mirror the backend allow-list. */
const RARITIES = ['common', 'uncommon', 'rare', 'mythic', 'special', 'bonus'] as const

/**
 * Case Cards admin tab. The owner creates named sections and fills each one
 * either by hand (search inventory, pick listings) or automatically (set a
 * price range + rarity, then "Pull from inventory"). Both paths produce a
 * concrete, editable list of cards shown on the public Case Cards page.
 */
export default function CaseCardsTab({ slug }: { slug: string }) {
  const { data: sections, isLoading } = useStoreSections(slug)
  const queryClient = useQueryClient()

  const [title, setTitle] = useState('')
  const [mode, setMode] = useState<StoreSectionMode>('manual')

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/stores/${slug}/sections`, { title: title.trim(), mode })
    },
    onSuccess: async () => {
      setTitle('')
      setMode('manual')
      await queryClient.invalidateQueries({ queryKey: storeSectionsKey(slug) })
    },
  })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Create a case card section"
          subtitle="Sections appear on your storefront's Case Cards page, in the order you create them."
        />
        <CardBody>
          <form
            className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end"
            onSubmit={(e) => {
              e.preventDefault()
              if (title.trim()) createMutation.mutate()
            }}
          >
            <Input
              label="Section title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Vintage power, budget staples…"
              maxLength={120}
            />
            <Select label="Fill mode" value={mode} onChange={(e) => setMode(e.target.value as StoreSectionMode)}>
              <option value="manual">Manual — pick cards</option>
              <option value="auto">Auto — pull by price/rarity</option>
            </Select>
            <Button type="submit" loading={createMutation.isPending} disabled={!title.trim()}>
              <Plus className="size-4" aria-hidden />
              Add section
            </Button>
          </form>
          {createMutation.isError && (
            <p className="mt-3 text-sm font-medium text-danger-700" role="alert">
              {extractErrorMessage(createMutation.error, 'Could not create the section.')}
            </p>
          )}
        </CardBody>
      </Card>

      {isLoading ? (
        <LoadingPanel />
      ) : (sections ?? []).length === 0 ? (
        <EmptyState
          icon={GalleryHorizontalEnd}
          title="No sections yet"
          description="Create your first section above to start featuring cards."
        />
      ) : (
        <div className="space-y-6">
          {sections!.map((section) => (
            <SectionEditor key={section.id} slug={slug} section={section} />
          ))}
        </div>
      )}
    </div>
  )
}

function SectionEditor({ slug, section }: { slug: string; section: StoreSection }) {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: storeSectionsKey(slug) })

  const [pickerOpen, setPickerOpen] = useState(false)
  const [min, setMin] = useState(section.autoMinPriceCents != null ? (section.autoMinPriceCents / 100).toFixed(2) : '')
  const [max, setMax] = useState(section.autoMaxPriceCents != null ? (section.autoMaxPriceCents / 100).toFixed(2) : '')
  const [rarity, setRarity] = useState(section.autoRarity ?? '')

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/stores/${slug}/sections/${section.id}`)
    },
    onSuccess: invalidate,
  })

  const removeItemMutation = useMutation({
    mutationFn: async (cardId: number) => {
      await api.delete(`/stores/${slug}/sections/${section.id}/items/${cardId}`)
    },
    onSuccess: invalidate,
  })

  const autoFillMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/stores/${slug}/sections/${section.id}/auto-fill`, {
        autoMinPriceCents: parsePriceInput(min),
        autoMaxPriceCents: parsePriceInput(max),
        autoRarity: rarity || null,
      })
    },
    onSuccess: invalidate,
  })

  return (
    <Card>
      <CardHeader
        title={section.title}
        subtitle={
          section.mode === 'auto'
            ? 'Auto — pulled from inventory by price and rarity'
            : 'Manual — hand-picked listings'
        }
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (window.confirm(`Delete section "${section.title}"?`)) deleteMutation.mutate()
            }}
            loading={deleteMutation.isPending}
          >
            <Trash2 className="size-4" aria-hidden />
            Delete
          </Button>
        }
      />
      <CardBody className="space-y-5">
        {section.mode === 'auto' ? (
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
            <Input label="Min price ($)" value={min} onChange={(e) => setMin(e.target.value)} inputMode="decimal" placeholder="0" />
            <Input label="Max price ($)" value={max} onChange={(e) => setMax(e.target.value)} inputMode="decimal" placeholder="Any" />
            <Select label="Rarity" value={rarity} onChange={(e) => setRarity(e.target.value)}>
              <option value="">Any rarity</option>
              {RARITIES.map((r) => (
                <option key={r} value={r}>
                  {r[0].toUpperCase() + r.slice(1)}
                </option>
              ))}
            </Select>
            <Button onClick={() => autoFillMutation.mutate()} loading={autoFillMutation.isPending}>
              <RefreshCw className="size-4" aria-hidden />
              Pull from inventory
            </Button>
          </div>
        ) : (
          <Button variant="secondary" onClick={() => setPickerOpen(true)}>
            <Plus className="size-4" aria-hidden />
            Add cards from inventory
          </Button>
        )}

        {autoFillMutation.isError && (
          <p className="text-sm font-medium text-danger-700" role="alert">
            {extractErrorMessage(autoFillMutation.error, 'Could not pull cards.')}
          </p>
        )}

        {section.cards.length === 0 ? (
          <p className="text-sm text-fg-muted">
            {section.mode === 'auto'
              ? 'No cards yet — set your criteria and pull from inventory.'
              : 'No cards yet — add some from your inventory.'}
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {section.cards.map((entry) => {
              const card = entry.inventoryItem.card
              return (
                <li key={entry.id} className="relative flex gap-3 rounded-card border border-border bg-surface p-2">
                  {card && cardImage(card) && (
                    <img src={cardImage(card)} alt={card.name} className="h-16 w-12 flex-shrink-0 rounded object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-fg">{card?.name ?? 'Unknown card'}</p>
                    <p className="text-xs text-fg-muted">{card?.setCode?.toUpperCase()}</p>
                    <p className="text-xs font-bold text-fg">{formatPrice(entry.inventoryItem.priceCents)}</p>
                  </div>
                  <button
                    type="button"
                    aria-label="Remove card"
                    onClick={() => removeItemMutation.mutate(entry.id)}
                    className="absolute right-1 top-1 rounded-full p-1 text-fg-muted hover:bg-bg hover:text-danger-700"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </CardBody>

      {pickerOpen && (
        <InventoryPicker
          slug={slug}
          section={section}
          onClose={() => setPickerOpen(false)}
          onChanged={invalidate}
        />
      )}
    </Card>
  )
}

function InventoryPicker({
  slug,
  section,
  onClose,
  onChanged,
}: {
  slug: string
  section: StoreSection
  onClose: () => void
  onChanged: () => void
}) {
  const { data: inventory = [], isLoading } = useInventory(slug)
  const [query, setQuery] = useState('')
  const debounced = useDebouncedValue(query, 200)

  const alreadyIn = useMemo(
    () => new Set(section.cards.map((c) => c.inventoryItem.id)),
    [section.cards],
  )

  const results = useMemo(() => {
    const q = debounced.trim().toLowerCase()
    const list: InventoryItem[] = q
      ? inventory.filter((item) => item.card.name.toLowerCase().includes(q))
      : inventory
    return list.slice(0, 60)
  }, [inventory, debounced])

  const addMutation = useMutation({
    mutationFn: async (inventoryItemId: number) => {
      await api.post(`/stores/${slug}/sections/${section.id}/items`, { inventoryItemId })
    },
    onSuccess: onChanged,
  })

  return (
    <Modal open onClose={onClose} title={`Add cards to “${section.title}”`}>
      <div className="space-y-4">
        <Input
          label="Search inventory"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Card name…"
          autoFocus
        />
        {isLoading ? (
          <LoadingPanel />
        ) : results.length === 0 ? (
          <EmptyState icon={Search} title="No matching listings" description="Try a different search." />
        ) : (
          <ul className="max-h-96 space-y-2 overflow-y-auto">
            {results.map((item) => {
              const added = alreadyIn.has(item.id)
              return (
                <li key={item.id} className="flex items-center gap-3 rounded-card border border-border bg-surface p-2">
                  {cardImage(item.card) && (
                    <img src={cardImage(item.card)} alt={item.card.name} className="h-14 w-10 flex-shrink-0 rounded object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-fg">{item.card.name}</p>
                    <p className="text-xs text-fg-muted">
                      {item.card.setCode?.toUpperCase()} · {formatPrice(item.priceCents)}
                      {item.isFoil ? ' · Foil' : ''}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={added ? 'ghost' : 'primary'}
                    disabled={added}
                    loading={addMutation.isPending && addMutation.variables === item.id}
                    onClick={() => addMutation.mutate(item.id)}
                  >
                    {added ? 'Added' : 'Add'}
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Modal>
  )
}
