import { useQuery } from '@tanstack/react-query'
import api, { formatPrice, unwrapCollection } from '../../api/client'
import type { Order } from '../../api/types'

export default function OrdersTab({ slug }: { slug: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['orders', slug],
    queryFn: async () => {
      const { data } = await api.get(`/stores/${slug}/orders`)
      return unwrapCollection<Order>(data)
    },
    retry: false,
  })

  // The orders endpoint may not be implemented on the backend yet.
  const status = (error as { response?: { status?: number } } | null)?.response?.status
  const endpointMissing = status === 404 || status === 405

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Orders</h2>

      {isLoading && <p className="text-sm text-slate-400">Loading orders…</p>}

      {endpointMissing && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-5 text-sm">
          <p className="font-medium text-amber-300">Orders backend not available yet</p>
          <p className="mt-1 text-slate-300">
            This page expects a <code className="text-amber-300">GET /api/stores/{slug}/orders</code>{' '}
            endpoint. Once an Order entity and API resource are added on the backend, orders will
            appear here automatically.
          </p>
        </div>
      )}

      {error && !endpointMissing && (
        <p className="text-sm text-red-400">Failed to load orders.</p>
      )}

      {data && data.length === 0 && (
        <p className="text-sm text-slate-500">No orders yet.</p>
      )}

      {data && data.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Placed</th>
              </tr>
            </thead>
            <tbody>
              {data.map((order) => (
                <tr key={order.id} className="border-t border-slate-800">
                  <td className="px-4 py-3 font-mono text-xs">{order.reference}</td>
                  <td className="px-4 py-3">{order.customerName ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs uppercase">
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{formatPrice(order.totalCents)}</td>
                  <td className="px-4 py-3 text-slate-400">
                    {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
