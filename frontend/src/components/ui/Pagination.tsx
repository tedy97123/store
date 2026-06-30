import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cx } from '../../lib/cx'
import { Button } from './Button'

export interface PaginationProps {
  /** 1-based current page. */
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  /** Optional total item count, shown as context ("X items"). */
  totalItems?: number
  className?: string
}

export function Pagination({ page, pageCount, onPageChange, totalItems, className }: PaginationProps) {
  if (pageCount <= 1) return null
  return (
    <div className={cx('flex items-center justify-between gap-3', className)}>
      <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        <ChevronLeft aria-hidden className="size-4" />
        Prev
      </Button>
      <span className="text-sm text-fg-muted">
        Page <span className="font-bold text-fg">{page}</span> of {pageCount}
        {typeof totalItems === 'number' && <span className="hidden sm:inline"> · {totalItems} items</span>}
      </span>
      <Button variant="secondary" size="sm" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
        Next
        <ChevronRight aria-hidden className="size-4" />
      </Button>
    </div>
  )
}

export default Pagination
