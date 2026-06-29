import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import api, { unwrapCollection } from '../api/client'
import type { Store } from '../api/types'

export default function HomePage() {
  const { data: stores = [], isLoading, error } = useQuery({
    queryKey: ['stores'],
    queryFn: async () => {
      const { data } = await api.get('/stores')
      return unwrapCollection<Store>(data)
    },
  })

  if (isLoading) {
    return <p className="text-slate-400">Loading stores...</p>
  }

  if (error) {
    return <p className="text-red-400">Failed to load stores.</p>
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Browse Stores</h1>
        <p className="mt-2 text-slate-400">
          Multi-tenant Magic: The Gathering inventory from local game stores.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stores.map((store) => (
          <Link
            key={store.id}
            to={`/s/${store.slug}`}
            className="rounded-xl border border-slate-800 bg-slate-900 p-5 transition hover:border-amber-500/50 hover:bg-slate-900/80"
          >
            <h2 className="text-xl font-semibold">{store.name}</h2>
            <p className="mt-2 text-sm text-slate-400">/{store.slug}</p>
          </Link>
        ))}
      </div>
      {stores.length === 0 && (
        <p className="text-slate-400">No active stores yet. Platform admins can create one.</p>
      )}
    </div>
  )
}
