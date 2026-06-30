import { Badge } from '../../components/ui'
import { formatPrice, scryfallPriceCents } from '../../api/client'
import type { BadgeProps } from '../../components/ui'
import type { CsvImportJobStatus, CsvImportRow } from '../../api/types'

/** True when a job is still doing work (drives polling intervals + upload gating). */
export function isActive(status: CsvImportJobStatus | null | undefined): boolean {
  return status === 'queued' || status === 'processing'
}

/** Map a run status to a design-system Badge tone. */
const STATUS_TONE: Record<CsvImportJobStatus, BadgeProps['tone']> = {
  queued: 'neutral',
  processing: 'brand',
  completed: 'success',
  failed: 'danger',
  paused: 'warning',
  cancelled: 'neutral',
}

/** Shared run-status badge used by CsvTab and ImportRunDetailsPage. */
export function RunStatusBadge({ status }: { status: CsvImportJobStatus }) {
  const label = status === 'completed' ? 'succeeded' : status
  return (
    <Badge tone={STATUS_TONE[status]} className="uppercase">
      {label}
    </Badge>
  )
}

/** Formatted market price preview for a single import row. */
export function rowMarketPrice(row: CsvImportRow): string {
  if (!row.card) return '-'
  const cents = scryfallPriceCents(row.card, row.isFoil ? 'foil' : 'nonfoil')
  return cents === null ? '-' : formatPrice(cents)
}
