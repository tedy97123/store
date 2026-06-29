import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import api, { cardImage, formatPrice, unwrapCollection } from '../api/client'
import type { CardSummary, InventoryItem, Store } from '../api/types'

const CONDITIONS = ['NM', 'LP', 'MP', 'HP', 'DMG'] as const

export default function StoreAdminPage() {
  const { slug = '' } = useParams()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedCard, setSelectedCard] = useState<CardSummary | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [priceCents, setPriceCents] = useState(199)
  const [condition, setCondition] = useState<(typeof CONDITIONS)[number]>('NM')
  const [isFoil, setIsFoil] = useState(false)

  const { data: store } = useQuery({
    queryKey: ['store', slug],
    queryFn: async () => {
      const { data } = await api.get<Store>(`/stores/${slug}`)
      return data
    },
  })

  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory', slug],
    queryFn: async () => {
      const { data } = await api.get(`/stores/${slug}/inventory`)
      return unwrapCollection<InventoryItem>(data)
    },
  })

  const { data: searchResults = [], refetch: runSearch } = useQuery({
    queryKey: ['card-search', search],
    queryFn: async () => {
      if (!search.trim()) return []
      const { data } = await api.get<CardSummary[]>('/catalog/search', { params: { q: search } })
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
      setSearch('')
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

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-amber-400">Store Admin</p>
          <h1 className="text-3xl font-bold">{store?.name ?? slug}</h1>
        </div>
        <Link to={`/s/${slug}`} className="text-sm text-slate-400 hover:text-white">
          View public store
        </Link>
      </div>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-lg font-semibold">Add inventory</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Scryfall catalog..."
            className="min-w-64 flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
          />
          <button
            type="button"
            onClick={() => void runSearch()}
            className="rounded-md bg-slate-800 px-4 py-2 hover:bg-slate-700"
          >
            Search
          </button>
        </div>
        {searchResults.length > 0 && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {searchResults.map((card) => (
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

      <section className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="px-4 py-3">Card</th>
              <th className="px-4 py-3">Qty</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Condition</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {inventory.map((item) => (
              <tr key={item.id} className="border-t border-slate-800">
                <td className="px-4 py-3">{item.card.name}</td>
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
          </tbody>
        </table>
      </section>
    </div>
  )
}
