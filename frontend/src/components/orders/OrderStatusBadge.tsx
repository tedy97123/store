import { Badge } from '../ui'
import type { OrderStatus } from '../../api/types'
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONES } from '../../lib/orders'

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={ORDER_STATUS_TONES[status]}>{ORDER_STATUS_LABELS[status]}</Badge>
}
