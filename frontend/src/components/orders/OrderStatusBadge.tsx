import { Badge } from '../ui'
import type { OrderStatus } from '../../api/types'
import { ORDER_STATUS_TONES, orderStatusLabel } from '../../lib/orders'

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={ORDER_STATUS_TONES[status] ?? 'neutral'}>{orderStatusLabel(status)}</Badge>
}
