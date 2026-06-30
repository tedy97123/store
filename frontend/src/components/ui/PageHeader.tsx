import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'

export interface PageHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  className?: string
}

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div className={cx('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-bold text-fg sm:text-3xl">{title}</h1>
        {subtitle != null && <p className="mt-1 text-sm text-fg-muted">{subtitle}</p>}
      </div>
      {actions != null && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
