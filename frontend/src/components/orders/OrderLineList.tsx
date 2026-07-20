import { ImageOff } from 'lucide-react'
import { formatPrice } from '../../api/client'
import type { OrderLine } from '../../api/types'
import { orderLineImage } from '../../lib/orders'
import { cx } from '../../lib/cx'

export function OrderLineList({
  lines = [],
  compact = false,
}: {
  lines?: OrderLine[]
  compact?: boolean
}) {
  if (lines.length === 0) {
    return <p className="rounded-btn border border-border bg-bg px-3 py-3 text-sm text-fg-muted">No line items.</p>
  }

  return (
    <div className="grid gap-2">
      {lines.map((line) => {
        const image = orderLineImage(line)
        return (
          <div
            key={line.id}
            className={cx(
              'flex items-center justify-between gap-3 rounded-btn border border-border bg-surface px-3 py-2',
              compact && 'px-2 py-1.5',
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                className={cx(
                  'grid shrink-0 place-items-center overflow-hidden rounded-btn border border-border bg-bg',
                  compact ? 'h-12 w-9' : 'h-16 w-12',
                )}
              >
                {image ? (
                  <img src={image} alt={line.cardName} className="size-full object-cover" />
                ) : (
                  <ImageOff aria-hidden className="size-4 text-fg-muted" />
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-fg">{line.cardName}</p>
                <p className="text-xs text-fg-muted">
                  {line.setCode ? `${line.setCode.toUpperCase()} · ` : ''}Qty {line.quantity} x {formatPrice(line.priceCents)}
                </p>
                {(line.caseQuantity ?? 0) > 0 && (
                  <p className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-brand-700">
                    Case card · {line.caseName ?? 'Case'} / {line.sectionTitle ?? 'Section'}
                    {(line.caseQuantity ?? 0) < line.quantity ? ` (${line.caseQuantity} of ${line.quantity})` : ''}
                  </p>
                )}
              </div>
            </div>
            <p className="shrink-0 text-sm font-bold text-fg">{formatPrice(line.quantity * line.priceCents)}</p>
          </div>
        )
      })}
    </div>
  )
}
