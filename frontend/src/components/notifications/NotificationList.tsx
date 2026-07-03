import { Bell, Check } from 'lucide-react'
import type { CustomerNotification } from '../../api/types'
import { Button } from '../ui'
import { cx } from '../../lib/cx'

export function NotificationList({
  notifications,
  pendingId,
  onMarkRead,
  compact = false,
}: {
  notifications: CustomerNotification[]
  pendingId?: number
  onMarkRead: (id: number) => void
  compact?: boolean
}) {
  if (notifications.length === 0) {
    return <p className="px-2 py-6 text-center text-sm text-fg-muted">No unread notifications.</p>
  }

  return (
    <div className={cx('grid gap-2', compact && 'max-h-80 overflow-y-auto')}>
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={cx(
            'flex items-start justify-between gap-3 rounded-btn border border-success-500/30 bg-success-50 px-3 py-2',
            compact && 'border-transparent bg-transparent hover:bg-bg',
          )}
        >
          <div className="flex min-w-0 gap-2">
            {!compact && (
              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-btn bg-success-100 text-success-700">
                <Bell aria-hidden className="size-3.5" />
              </span>
            )}
            <div className="min-w-0">
              <p className={cx('truncate text-sm font-bold', compact ? 'text-fg' : 'text-success-700')}>
                {notification.title}
              </p>
              <p className={cx('text-sm leading-5', compact ? 'line-clamp-2 text-xs text-fg-muted' : 'text-success-700/90')}>
                {notification.body}
              </p>
            </div>
          </div>

          {compact ? (
            <button
              type="button"
              onClick={() => onMarkRead(notification.id)}
              disabled={pendingId === notification.id}
              className="grid size-7 shrink-0 place-items-center rounded-btn text-fg-muted hover:bg-surface hover:text-success-700 disabled:opacity-50"
              aria-label={`Mark ${notification.title} as read`}
              title="Mark read"
            >
              <Check aria-hidden className="size-4" />
            </button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              loading={pendingId === notification.id}
              onClick={() => onMarkRead(notification.id)}
            >
              <Check aria-hidden className="size-4" />
              Read
            </Button>
          )}
        </div>
      ))}
    </div>
  )
}
