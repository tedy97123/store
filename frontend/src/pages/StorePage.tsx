import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import api, { cardImage, formatPrice, unwrapCollection } from '../api/client'
import type { InventoryItem, Store } from '../api/types'
import { useAuth } from '../context/AuthContext'

export default function StorePage() {
  const { slug = '' } = useParams()
  const { isSuperAdmin, user } = useAuth()
  const [search, setSearch] = useState('')

  const { data: store } = useQuery({
    queryKey: ['store', slug],
    queryFn: async () => {
      const { data } = await api.get<Store>(`/stores/${slug}`)
      return data
    },
  })

  const { data: inventory = [], isLoading } = useQuery({
    queryKey: ['inventory', slug],
    queryFn: async () => {
      const { data } = await api.get(`/stores/${slug}/inventory`)
      return unwrapCollection<InventoryItem>(data)
    },
  })

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return inventory
    return inventory.filter((item) => item.card.name.toLowerCase().includes(term))
  }, [inventory, search])

  const canManage =
    isSuperAdmin ||
    user?.ownedStores.some((owned) => owned.slug === slug)

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-amber-400">Store</p>
          <h1 className="text-3xl font-bold">{store?.name ?? slug}</h1>
        </div>
        {canManage && (
          <Link
            to={`/s/${slug}/admin`}
            className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-amber-400"
          >
            Manage inventory
          </Link>
        )}
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search inventory..."
        className="mb-6 w-full rounded-md border border-slate-700 bg-slate-900 px-4 py-2"
      />

      {isLoading ? (
        <p className="text-slate-400">Loading inventory...</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="px-4 py-3">Card</th>
                <th className="px-4 py-3">Set</th>
                <th className="px-4 py-3">Condition</th>
                <th className="px-4 py-3">Foil</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Price</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-t border-slate-800">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {cardImage(item.card) && (
                        <img
                          src={cardImage(item.card)}
                          alt={item.card.name}
                          className="h-12 w-auto rounded"
                        />
                      )}
                      <div>
                        <div className="font-medium">{item.card.name}</div>
                        <div className="text-xs text-slate-400">{item.card.typeLine}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 uppercase">{item.card.setCode}</td>
                  <td className="px-4 py-3">{item.condition}</td>
                  <td className="px-4 py-3">{item.isFoil ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-3">{item.quantity}</td>
                  <td className="px-4 py-3">{formatPrice(item.priceCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="p-6 text-slate-400">No cards in inventory yet.</p>
          )}
        </div>
      )}
    </div>
  )
}
