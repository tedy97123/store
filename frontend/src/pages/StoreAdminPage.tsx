import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import api from '../api/client'
import type { Store } from '../api/types'
import SearchTab from './store-admin/SearchTab'
import OrdersTab from './store-admin/OrdersTab'
import CsvTab from './store-admin/CsvTab'

type Tab = 'search' | 'orders' | 'csv'

const TABS: { key: Tab; label: string; hint: string }[] = [
  { key: 'search', label: 'Search', hint: 'Browse & manage inventory' },
  { key: 'orders', label: 'Orders', hint: 'Customer orders' },
  { key: 'csv', label: 'CSV', hint: 'Bulk import' },
]

export default function StoreAdminPage() {
  const { slug = '' } = useParams()
  const [tab, setTab] = useState<Tab>('search')

  const { data: store } = useQuery({
    queryKey: ['store', slug],
    queryFn: async () => {
      const { data } = await api.get<Store>(`/stores/${slug}`)
      return data
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

      <div className="flex flex-col gap-8 lg:flex-row">
        <aside className="lg:w-56 lg:flex-shrink-0">
          <nav className="flex gap-2 lg:flex-col">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex-1 rounded-lg border px-4 py-3 text-left transition lg:flex-none ${
                  tab === t.key
                    ? 'border-amber-500 bg-amber-500/10 text-white'
                    : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600'
                }`}
              >
                <span className="block font-medium">{t.label}</span>
                <span className="hidden text-xs text-slate-500 lg:block">{t.hint}</span>
              </button>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          {tab === 'search' && <SearchTab slug={slug} />}
          {tab === 'orders' && <OrdersTab slug={slug} />}
          {tab === 'csv' && <CsvTab slug={slug} />}
        </div>
      </div>
    </div>
  )
}
