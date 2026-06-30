import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'

export interface StatProps {
  label: ReactNode
  value: ReactNode
  className?: string
}

/**
 * Stat — compact label/value metric block used in store headers.
 * Flat enterprise style: hairline border, no shadow beyond the surrounding card.
 */
export function Stat({ label, value, className }: StatProps) {
  return (
    <div className={cx('rounded-card border border-border bg-bg px-4 py-3', className)}>
      <span className="block text-xs font-medium uppercase tracking-wide text-fg-muted">{label}</span>
      <span className="text-xl font-bold text-fg">{value}</span>
    </div>
  )
}

export default Stat
