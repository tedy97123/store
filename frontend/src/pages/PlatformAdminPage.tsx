import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api, { unwrapCollection } from '../api/client'
import type { AdminUser, ScryfallSyncResult, Store } from '../api/types'

export default function PlatformAdminPage() {
  const queryClient = useQueryClient()
  const [storeName, setStoreName] = useState('')
  const [storeSlug, setStoreSlug] = useState('')
  const [ownerId, setOwnerId] = useState<number | ''>('')

  const { data: stores = [] } = useQuery({
    queryKey: ['admin-stores'],
    queryFn: async () => {
      const { data } = await api.get('/admin/stores')
      return unwrapCollection<Store>(data)
    },
  })

  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data } = await api.get('/admin/users')
      return unwrapCollection<AdminUser>(data)
    },
  })

  const createStore = useMutation({
    mutationFn: async () => {
      await api.post('/admin/stores', {
        name: storeName,
        slug: storeSlug,
        owner: `/api/admin/users/${ownerId}`,
        isActive: true,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-stores'] })
      await queryClient.invalidateQueries({ queryKey: ['stores'] })
      setStoreName('')
      setStoreSlug('')
      setOwnerId('')
    },
  })

  const syncScryfall = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<ScryfallSyncResult>('/admin/scryfall/sync')
      return data
    },
  })

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-wide text-amber-400">Platform Admin</p>
        <h1 className="text-3xl font-bold">Manage tenants</h1>
      </div>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-lg font-semibold">Scryfall catalog sync</h2>
        <p className="mt-2 text-sm text-slate-400">
          Downloads oracle_cards bulk data and upserts the global card catalog.
        </p>
        <button
          type="button"
          onClick={() => syncScryfall.mutate()}
          disabled={syncScryfall.isPending}
          className="mt-4 rounded-md bg-amber-500 px-4 py-2 font-medium text-slate-950 hover:bg-amber-400 disabled:opacity-60"
        >
          {syncScryfall.isPending ? 'Syncing...' : 'Run Scryfall sync'}
        </button>
        {syncScryfall.data && (
          <p className="mt-3 text-sm text-green-400">
            Synced {syncScryfall.data.total} cards ({syncScryfall.data.inserted} inserted,{' '}
            {syncScryfall.data.updated} updated).
          </p>
        )}
        {syncScryfall.isError && (
          <p className="mt-3 text-sm text-red-400">Scryfall sync failed.</p>
        )}
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-lg font-semibold">Create store</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            placeholder="Store name"
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
          />
          <input
            value={storeSlug}
            onChange={(e) => setStoreSlug(e.target.value)}
            placeholder="slug"
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
          />
          <select
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value ? Number(e.target.value) : '')}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
          >
            <option value="">Select owner</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName} ({user.email})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => createStore.mutate()}
            disabled={!storeName || !storeSlug || !ownerId || createStore.isPending}
            className="rounded-md bg-amber-500 px-4 py-2 font-medium text-slate-950 hover:bg-amber-400 disabled:opacity-60"
          >
            Create store
          </button>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800">
          <h2 className="border-b border-slate-800 px-4 py-3 font-semibold">Stores</h2>
          <ul className="divide-y divide-slate-800">
            {stores.map((store) => (
              <li key={store.id} className="px-4 py-3 text-sm">
                <div className="font-medium">{store.name}</div>
                <div className="text-slate-400">/{store.slug}</div>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-slate-800">
          <h2 className="border-b border-slate-800 px-4 py-3 font-semibold">Users</h2>
          <ul className="divide-y divide-slate-800">
            {users.map((user) => (
              <li key={user.id} className="px-4 py-3 text-sm">
                <div className="font-medium">{user.displayName}</div>
                <div className="text-slate-400">{user.email}</div>
                <div className="mt-1 text-xs text-amber-300">{user.roles.join(', ')}</div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
