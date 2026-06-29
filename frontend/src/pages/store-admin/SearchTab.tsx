import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api, { cardImage, formatPrice, unwrapCollection } from '../../api/client'
import type { CardSummary, InventoryItem } from '../../api/types'

const CONDITIONS = ['NM', 'LP', 'MP', 'HP', 'DMG'] as const

export default function SearchTab({ slug }: { slug: string }) {
  const queryClient = useQueryClient()

  // Searches the inventory that belongs to this store.
  const [filter, setFilter] = useState('')

  // Add-inventory state (searches the Scryfall catalog to pick a card).
  const [catalogSearch, setCatalogSearch] = useState('')
  const [selectedCard, setSelectedCard] = useState<CardSummary | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [priceCents, setPriceCents] = useState(199)
  const [condition, setCondition] = useState<(typeof CONDITIONS)[number]>('NM')
  const [isFoil, setIsFoil] = useState(false)

  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory', slug],
    queryFn: async () => {
      const { data } = await api.get(`/stores/${slug}/inventory`)
      return unwrapCollection<InventoryItem>(data)
    },
  })

  const { data: catalogResults = [], refetch: runCatalogSearch } = useQuery({
    queryKey: ['card-search', catalogSearch],
    queryFn: async () => {
      if (!catalogSearch.trim()) return []
      const { data } = await api.get<CardSummary[]>('/catalog/search', {
        params: { q: catalogSearch },
      })
      return data
    },
    enabled: false,
  })

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCard) return
      await api.post(`/stores/${slug}/inventory`, {
        cardId: selectedCard.id,
        quantity,
        priceCents,
        condition,
        isFoil,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['inventory', slug] })
      setSelectedCard(null)
      setCatalogSearch('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/stores/${slug}/inventory/${id}`)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['inventory', slug] })
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
        (card.typeLine ?? '').toLowerCase().includes(term)
      )
    })
  }, [inventory, filter])

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-lg font-semibold">Add inventory</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <input
            value={catalogSearch}
            onChange={(e) => setCatalogSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void runCatalogSearch()}
            placeholder="Search Scryfall catalog..."
            className="min-w-64 flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
          />
          <button
            type="button"
            onClick={() => void runCatalogSearch()}
            className="rounded-md bg-slate-800 px-4 py-2 hover:bg-slate-700"
          >
            Search catalog
          </button>
        </div>
        {catalogResults.length > 0 && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {catalogResults.map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => setSelectedCard(card)}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-left ${
                  selectedCard?.id === card.id
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-slate-700 hover:border-slate-500'
                }`}
              >
                {cardImage(card) && (
                  <img src={cardImage(card)} alt={card.name} className="h-10 rounded" />
                )}
                <span>{card.name}</span>
              </button>
            ))}
          </div>
        )}
        {selectedCard && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1 text-sm">
              <span className="text-slate-400">Quantity</span>
              <input
                type="number"
                min={0}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-slate-400">Price (cents)</span>
              <input
                type="number"
                min={0}
                value={priceCents}
                onChange={(e) => setPriceCents(Number(e.target.value))}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-slate-400">Condition</span>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as (typeof CONDITIONS)[number])}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
              >
                {CONDITIONS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-end gap-2 text-sm">
              <input
                type="checkbox"
                checked={isFoil}
                onChange={(e) => setIsFoil(e.target.checked)}
              />
              Foil
            </label>
          </div>
        )}
        {selectedCard && (
          <button
            type="button"
            onClick={() => addMutation.mutate()}
            disabled={addMutation.isPending}
            className="mt-4 rounded-md bg-amber-500 px-4 py-2 font-medium text-slate-950 hover:bg-amber-400"
          >
            Add {selectedCard.name}
          </button>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Store inventory</h2>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search this store's inventory..."
            className="min-w-64 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="px-4 py-3">Card</th>
                <th className="px-4 py-3">Set</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Condition</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredInventory.map((item) => (
                <tr key={item.id} className="border-t border-slate-800">
                  <td className="px-4 py-3">{item.card.name}</td>
                  <td className="px-4 py-3 uppercase text-slate-400">{item.card.setCode ?? '—'}</td>
                  <td className="px-4 py-3">{item.quantity}</td>
                  <td className="px-4 py-3">{formatPrice(item.priceCents)}</td>
                  <td className="px-4 py-3">
                    {item.condition}
                    {item.isFoil ? ' (Foil)' : ''}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => deleteMutation.mutate(item.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {filteredInventory.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    {filter.trim()
                      ? 'No inventory matches your search.'
                      : 'No inventory yet. Add cards above or import a CSV.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
