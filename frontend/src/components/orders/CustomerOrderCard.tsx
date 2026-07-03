import { ChevronDown, Store } from 'lucide-react'
import { formatPrice } from '../../api/client'
import type { Order, OrderLine } from '../../api/types'
import { cx } from '../../lib/cx'
import { formatOrderShortDate, orderItemCount } from '../../lib/orders'
import { OrderLineList } from './OrderLineList'
import { OrderStatusBadge } from './OrderStatusBadge'
import { OrderWorkflow } from './OrderWorkflow'

export function CustomerOrderCard({
  order,
  expanded,
  onToggle,
}: {
  order: Order
  expanded: boolean
  onToggle: () => void
}) {
  const itemCount = orderItemCount(order)
  const previewLines = (order.lines ?? []).slice(0, 3)

  return (
    <article className="rounded-card border border-border bg-surface shadow-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-col gap-4 p-4 text-left sm:flex-row sm:items-start sm:justify-between"
        aria-expanded={expanded}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-sm font-bold text-fg">
              <Store aria-hidden className="size-4 text-brand-600" />
              {order.storeName ?? 'This store'}
            </span>
            <span className="font-mono text-xs font-bold text-fg-muted">{order.reference}</span>
            <OrderStatusBadge status={order.status} />
          </div>
          <p className="mt-2 text-sm text-fg-muted">
            {itemCount} {itemCount === 1 ? 'item' : 'items'} · {formatOrderShortDate(order.createdAt)}
          </p>

          {previewLines.length > 0 && (
            <div className="mt-3 flex -space-x-2">
              {previewLines.map((line) => (
                <CardThumb key={line.id} line={line} />
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-4 sm:flex-col sm:items-end">
          <p className="font-display text-2xl font-extrabold text-fg">{formatPrice(order.totalCents)}</p>
          <ChevronDown aria-hidden className={cx('size-5 text-fg-muted transition-transform', expanded && 'rotate-180')} />
        </div>
      </button>

      <div className="border-t border-border px-4 py-3">
        <OrderWorkflow status={order.status} />
      </div>

      {expanded && (
        <div className="border-t border-border bg-bg/60 p-4">
          <OrderLineList lines={order.lines ?? []} />
        </div>
      )}
    </article>
  )
}

function CardThumb({ line }: { line: OrderLine }) {
  const image = line.imageUris?.small ?? line.imageUris?.normal ?? line.imageUrl ?? undefined
  return (
    <span className="grid h-14 w-10 place-items-center overflow-hidden rounded-btn border border-border bg-bg ring-2 ring-surface">
      {image ? <img src={image} alt="" className="size-full object-cover" /> : <span className="text-xs font-bold text-fg-muted">?</span>}
    </span>
  )
}
