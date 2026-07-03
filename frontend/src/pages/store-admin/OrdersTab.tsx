import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock3, PackageCheck, Printer, ReceiptText, RotateCcw, XCircle, type LucideIcon } from 'lucide-react'
import api, { extractErrorMessage, formatPrice, httpStatus } from '../../api/client'
import type { Order, OrderStatus } from '../../api/types'
import { ordersKey, useOrders } from '../../hooks'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  LoadingPanel,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '../../components/ui'
import { cx } from '../../lib/cx'
import { formatDateTime } from '../../lib/format'
import { printOrderSheet } from '../../lib/printOrderSheet'
import { OrderLineList } from '../../components/orders/OrderLineList'
import { OrderStatusBadge } from '../../components/orders/OrderStatusBadge'
import { OrderWorkflow } from '../../components/orders/OrderWorkflow'
import {
  ORDER_STATUSES,
  isFulfilledStatus,
  isOpenOrder,
  orderItemCount,
  orderStatusLabel,
} from '../../lib/orders'

/**
 * Actions the admin UI offers per status. The backend enforces the full
 * transition map (OrderStatus::allowedTransitions); this is just the curated
 * subset surfaced as buttons.
 */
function statusActions(status: OrderStatus): { status: OrderStatus; label: string; icon: LucideIcon }[] {
  if (status === 'pending') {
    return [
      { status: 'received', label: 'Mark received', icon: CheckCircle2 },
      { status: 'cancelled', label: 'Cancel', icon: XCircle },
    ]
  }
  if (status === 'received' || status === 'paid' || status === 'shipped') {
    return [
      { status: 'fulfilled', label: 'Mark fulfilled', icon: PackageCheck },
      { status: 'refunded', label: 'Refund', icon: RotateCcw },
    ]
  }
  if (isFulfilledStatus(status)) {
    return [{ status: 'refunded', label: 'Refund', icon: RotateCcw }]
  }
  return []
}

export default function OrdersTab({ slug }: { slug: string }) {
  const queryClient = useQueryClient()
  const { data = [], isLoading, error, refetch } = useOrders(slug)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')

  const filtered = useMemo(
    () => (statusFilter === 'all' ? data : data.filter((order) => order.status === statusFilter)),
    [data, statusFilter],
  )
  // Derived, not synced state: the details pane always shows an order from
  // the visible (filtered) list, defaulting to its first row.
  const selected = filtered.find((order) => order.id === selectedId) ?? filtered[0] ?? null

  const metrics = useMemo(
    () => ({
      open: data.filter(isOpenOrder).length,
      pending: data.filter((order) => order.status === 'pending').length,
      fulfilled: data.filter((order) => isFulfilledStatus(order.status)).length,
      totalCents: data.reduce((sum, order) => sum + order.totalCents, 0),
    }),
    [data],
  )

  const updateStatus = useMutation({
    mutationFn: async ({ order, status }: { order: Order; status: OrderStatus }) => {
      const { data: updated } = await api.patch<Order>(`/stores/${slug}/orders/${order.id}`, { status })
      return updated
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<Order[]>(ordersKey(slug), (current = []) =>
        current.map((order) => (order.id === updated.id ? updated : order)),
      )
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ordersKey(slug) }),
  })

  const status = httpStatus(error)
  const endpointMissing = status === 404 || status === 405

  if (isLoading) return <LoadingPanel label="Loading orders..." />

  if (endpointMissing) {
    return (
      <Card>
        <CardBody>
          <EmptyState
            icon={ReceiptText}
            title="Orders backend not available yet"
            description={
              <>
                This page expects a <code className="text-fg">GET /api/stores/{slug}/orders</code> endpoint.
              </>
            }
          />
        </CardBody>
      </Card>
    )
  }

  if (error) return <ErrorState title="Failed to load orders" description="Please try again." onRetry={() => void refetch()} />

  if (data.length === 0) {
    return (
      <Card>
        <CardBody>
          <EmptyState icon={ReceiptText} title="No orders yet" description="Customer orders will appear here." />
        </CardBody>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <OrderMetric icon={Clock3} label="Needs action" value={String(metrics.open)} />
        <OrderMetric icon={ReceiptText} label="Pending" value={String(metrics.pending)} />
        <OrderMetric icon={PackageCheck} label="Fulfilled" value={String(metrics.fulfilled)} />
        <OrderMetric icon={CheckCircle2} label="Order value" value={formatPrice(metrics.totalCents)} />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_25rem]">
        <Card>
          <CardHeader
            title="Past orders"
            subtitle={`${data.length} ${data.length === 1 ? 'order' : 'orders'} for this store.`}
            actions={
              <select
                aria-label="Filter orders by status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as OrderStatus | 'all')}
                className="h-9 rounded-btn border border-border bg-surface px-3 text-sm font-medium text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <option value="all">All statuses</option>
                {ORDER_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {orderStatusLabel(status)}
                  </option>
                ))}
              </select>
            }
          />
          <CardBody className="p-0">
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Reference</TH>
                  <TH>Customer</TH>
                  <TH>Status</TH>
                  <TH>Total</TH>
                  <TH>Placed</TH>
                </TR>
              </THead>
              <TBody>
                {filtered.map((order) => (
                  <TR
                    key={order.id}
                    onClick={() => setSelectedId(order.id)}
                    className={cx('cursor-pointer', selected?.id === order.id && 'bg-brand-50/70 hover:bg-brand-50')}
                  >
                    <TD className="font-mono text-xs font-bold">{order.reference}</TD>
                    <TD>
                      <div className="max-w-48">
                        <p className="truncate font-medium">{order.customerName ?? '-'}</p>
                        {order.customerEmail && <p className="truncate text-xs text-fg-muted">{order.customerEmail}</p>}
                      </div>
                    </TD>
                    <TD>
                      <OrderStatusBadge status={order.status} />
                    </TD>
                    <TD className="font-bold">{formatPrice(order.totalCents)}</TD>
                    <TD className="text-fg-muted">{formatDateTime(order.createdAt)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            {filtered.length === 0 && (
              <p className="border-t border-border px-4 py-8 text-center text-sm text-fg-muted">
                No orders match this status.
              </p>
            )}
          </CardBody>
        </Card>

        <OrderDetails
          order={selected}
          pendingStatus={
            updateStatus.isPending && updateStatus.variables?.order.id === selected?.id
              ? updateStatus.variables.status
              : null
          }
          error={updateStatus.error}
          onUpdateStatus={(status) => selected && updateStatus.mutate({ order: selected, status })}
        />
      </div>
    </div>
  )
}

function OrderDetails({
  order,
  pendingStatus,
  error,
  onUpdateStatus,
}: {
  order: Order | null
  pendingStatus: OrderStatus | null
  error: unknown
  onUpdateStatus: (status: OrderStatus) => void
}) {
  if (!order) return null

  const actions = statusActions(order.status)
  const itemCount = orderItemCount(order)

  return (
    <Card className="xl:sticky xl:top-20">
      <CardHeader
        title={order.reference}
        subtitle={`${itemCount} ${itemCount === 1 ? 'item' : 'items'} · ${formatDateTime(order.createdAt)}`}
        actions={<OrderStatusBadge status={order.status} />}
      />
      <CardBody className="space-y-5">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-fg-muted">Workflow</p>
          <OrderWorkflow status={order.status} />
        </div>

        <div className="rounded-card border border-border bg-bg px-3 py-3">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-fg-muted">Customer</p>
          <div>
            <p className="text-sm font-bold text-fg">{order.customerName ?? 'Customer'}</p>
            <p className="text-sm text-fg-muted">{order.customerEmail ?? '-'}</p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-fg-muted">Items</p>
          <OrderLineList lines={order.lines ?? []} compact />
        </div>

        <div className="flex items-baseline justify-between border-t border-border pt-4">
          <span className="font-bold text-fg">Order total</span>
          <span className="font-display text-3xl font-extrabold text-fg">{formatPrice(order.totalCents)}</span>
        </div>

        {actions.length > 0 ? (
          <div className="grid gap-2">
            {actions.map(({ status, label, icon: Icon }) => (
              <Button
                key={status}
                variant={status === 'cancelled' || status === 'refunded' ? 'secondary' : 'primary'}
                onClick={() => onUpdateStatus(status)}
                loading={pendingStatus === status}
                className="w-full"
              >
                <Icon aria-hidden className="size-4" />
                {label}
              </Button>
            ))}
          </div>
        ) : (
          <p className="rounded-btn border border-border bg-bg px-3 py-2 text-sm text-fg-muted">
            This order is in a terminal status.
          </p>
        )}

        <Button variant="secondary" className="w-full" onClick={() => printOrderSheet(order)}>
          <Printer aria-hidden className="size-4" />
          Print order sheet
        </Button>

        {Boolean(error) && (
          <p role="alert" className="rounded-btn border border-danger-500/30 bg-danger-50 px-3 py-2 text-sm text-danger-700">
            {extractErrorMessage(error, 'Could not update this order. Please try again.')}
          </p>
        )}
      </CardBody>
    </Card>
  )
}

function OrderMetric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <Card>
      <CardBody className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-btn bg-brand-50 text-brand-700">
          <Icon aria-hidden className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-fg-muted">{label}</p>
          <p className="truncate font-display text-2xl font-extrabold text-fg">{value}</p>
        </div>
      </CardBody>
    </Card>
  )
}
