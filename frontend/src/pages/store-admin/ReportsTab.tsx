import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp } from 'lucide-react'
import api, { formatPrice, httpStatus, unwrapCollection } from '../../api/client'
import type { Order } from '../../api/types'
import {
  Card,
  CardHeader,
  CardBody,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  EmptyRow,
  Badge,
  LoadingPanel,
  EmptyState,
  ErrorState,
} from '../../components/ui'

const REVENUE_STATUSES = new Set(['paid', 'shipped', 'completed'])

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardBody>
        <p className="text-sm text-fg-muted">{label}</p>
        <p className="mt-2 text-2xl font-bold text-fg">{value}</p>
      </CardBody>
    </Card>
  )
}

export default function ReportsTab({ slug }: { slug: string }) {
  const { data: orders = [], isLoading, error } = useQuery({
    queryKey: ['orders', slug],
    queryFn: async () => {
      const { data } = await api.get(`/stores/${slug}/orders`)
      return unwrapCollection<Order>(data)
    },
    retry: false,
  })

  const report = useMemo(() => {
    const revenueOrders = orders.filter((order) => REVENUE_STATUSES.has(order.status))
    const revenueCents = revenueOrders.reduce((sum, order) => sum + order.totalCents, 0)
    const pendingCents = orders
      .filter((order) => order.status === 'pending')
      .reduce((sum, order) => sum + order.totalCents, 0)
    const refundedCents = orders
      .filter((order) => order.status === 'refunded')
      .reduce((sum, order) => sum + order.totalCents, 0)
    const averageOrderCents =
      revenueOrders.length > 0 ? Math.round(revenueCents / revenueOrders.length) : 0

    const statusRows = Object.entries(
      orders.reduce<Record<string, { count: number; totalCents: number }>>((acc, order) => {
        acc[order.status] ??= { count: 0, totalCents: 0 }
        acc[order.status].count += 1
        acc[order.status].totalCents += order.totalCents
        return acc
      }, {}),
    ).sort(([a], [b]) => a.localeCompare(b))

    return {
      revenueOrders,
      revenueCents,
      pendingCents,
      refundedCents,
      averageOrderCents,
      statusRows,
      recentOrders: revenueOrders.slice(0, 8),
    }
  }, [orders])

  const status = httpStatus(error)
  const endpointMissing = status === 404 || status === 405

  if (isLoading) {
    return <LoadingPanel label="Loading reports…" />
  }

  if (endpointMissing) {
    return (
      <Card>
        <CardBody>
          <EmptyState
            icon={TrendingUp}
            title="Reports need the orders endpoint"
            description={
              <>
                Revenue is calculated from <code className="text-fg">GET /api/stores/{slug}/orders</code>.
              </>
            }
          />
        </CardBody>
      </Card>
    )
  }

  if (error) {
    return <ErrorState title="Failed to load reports" description="Please try again." />
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-fg">Revenue report</h2>
        <p className="mt-1 text-sm text-fg-muted">Revenue includes paid, shipped, and completed orders.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Revenue generated" value={formatPrice(report.revenueCents)} />
        <MetricCard label="Revenue orders" value={report.revenueOrders.length} />
        <MetricCard label="Average order" value={formatPrice(report.averageOrderCents)} />
        <MetricCard label="Pending value" value={formatPrice(report.pendingCents)} />
      </div>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader title="Recent revenue orders" />
          <CardBody className="p-0">
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Reference</TH>
                  <TH>Customer</TH>
                  <TH>Status</TH>
                  <TH>Total</TH>
                  <TH>Date</TH>
                </TR>
              </THead>
              <TBody>
                {report.recentOrders.map((order) => (
                  <TR key={order.id}>
                    <TD className="font-mono text-xs">{order.reference}</TD>
                    <TD>{order.customerName ?? '-'}</TD>
                    <TD>
                      <Badge className="uppercase">{order.status}</Badge>
                    </TD>
                    <TD>{formatPrice(order.totalCents)}</TD>
                    <TD className="text-fg-muted">{formatDate(order.createdAt)}</TD>
                  </TR>
                ))}
                {report.recentOrders.length === 0 && (
                  <EmptyRow colSpan={5}>No revenue-generating orders yet.</EmptyRow>
                )}
              </TBody>
            </Table>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Totals by status" />
          <CardBody className="space-y-3">
            {report.statusRows.map(([statusName, row]) => (
              <div key={statusName} className="flex items-center justify-between gap-3 text-sm">
                <div>
                  <p className="font-bold uppercase text-fg">{statusName}</p>
                  <p className="text-xs text-fg-muted">
                    {row.count} order{row.count === 1 ? '' : 's'}
                  </p>
                </div>
                <p className="font-bold text-fg">{formatPrice(row.totalCents)}</p>
              </div>
            ))}
            {report.statusRows.length === 0 && (
              <p className="text-sm text-fg-muted">No orders to report yet.</p>
            )}
            {report.refundedCents > 0 && (
              <p className="border-t border-border pt-4 text-sm text-fg-muted">
                Refunded value: {formatPrice(report.refundedCents)}
              </p>
            )}
          </CardBody>
        </Card>
      </section>
    </div>
  )
}
