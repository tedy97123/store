import { cardImage } from '../api/client'
import type { Order, OrderLine, OrderStatus } from '../api/types'

/** Every status the backend can produce, in workflow order (for filters). */
export const ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'received',
  'paid',
  'shipped',
  'fulfilled',
  'completed',
  'cancelled',
  'refunded',
]

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  received: 'Received',
  fulfilled: 'Fulfilled',
  paid: 'Paid',
  shipped: 'Shipped',
  completed: 'Completed',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
}

export const ORDER_STATUS_TONES: Record<OrderStatus, 'neutral' | 'brand' | 'success' | 'warning' | 'danger'> = {
  pending: 'warning',
  received: 'brand',
  fulfilled: 'success',
  paid: 'brand',
  shipped: 'brand',
  completed: 'success',
  cancelled: 'danger',
  refunded: 'neutral',
}

/** Tolerates statuses the union doesn't know yet (new backend enum cases). */
export function orderStatusLabel(status: OrderStatus): string {
  return ORDER_STATUS_LABELS[status] ?? status
}

/** The three-step progress bar shown on order cards. */
export const ORDER_WORKFLOW: OrderStatus[] = ['pending', 'received', 'fulfilled']

/** Statuses that still need staff action. */
export const OPEN_ORDER_STATUSES: OrderStatus[] = ['pending', 'received', 'paid', 'shipped']

export function isOpenOrder(order: Pick<Order, 'status'>): boolean {
  return OPEN_ORDER_STATUSES.includes(order.status)
}

export function isFulfilledStatus(status: OrderStatus): boolean {
  return status === 'fulfilled' || status === 'completed'
}

/** Map legacy statuses (paid/shipped/completed) onto the 3-step workflow. */
export function normalizeWorkflowStatus(status: OrderStatus): OrderStatus {
  if (status === 'paid' || status === 'shipped') return 'received'
  if (status === 'completed') return 'fulfilled'
  return status
}

export function orderItemCount(order: Pick<Order, 'lines'>): number {
  return (order.lines ?? []).reduce((sum, line) => sum + line.quantity, 0)
}

export function orderLineImage(line: OrderLine): string | undefined {
  return cardImage({
    imageUrl: line.imageUrl ?? undefined,
    imageUris: line.imageUris ?? undefined,
  })
}
