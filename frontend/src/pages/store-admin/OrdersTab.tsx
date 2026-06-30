import { useQuery } from '@tanstack/react-query'
import { ReceiptText } from 'lucide-react'
import api, { formatPrice, httpStatus, unwrapCollection } from '../../api/client'
import type { Order } from '../../api/types'
import {
  Card,
  CardHeader,
  CardBody,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  Badge,
  LoadingPanel,
  EmptyState,
  ErrorState,
} from '../../components/ui'

export default function OrdersTab({ slug }: { slug: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['orders', slug],
    queryFn: async () => {
      const { data } = await api.get(`/stores/${slug}/orders`)
      return unwrapCollection<Order>(data)
    },
    retry: false,
  })

  // The orders endpoint may not be implemented on the backend yet.
  const status = httpStatus(error)
  const endpointMissing = status === 404 || status === 405

  if (isLoading) {
    return <LoadingPanel label="Loading orders…" />
  }

  if (endpointMissing) {
    return (
      <Card>
        <CardBody>
          <EmptyState
            icon={ReceiptText}
            title="Orders backend not available yet"
            description={
              <>
                This page expects a <code className="text-fg">GET /api/stores/{slug}/orders</code> endpoint.
                Once an Order entity and API resource are added on the backend, orders will appear here
                automatically.
              </>
            }
          />
        </CardBody>
      </Card>
    )
  }

  if (error) {
    return <ErrorState title="Failed to load orders" description="Please try again." />
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardBody>
          <EmptyState icon={ReceiptText} title="No orders yet" description="Customer orders will appear here." />
        </CardBody>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader title="Orders" subtitle="Customer orders for this store." />
      <CardBody className="p-0">
        <Table>
          <THead>
            <TR className="hover:bg-transparent">
              <TH>Reference</TH>
              <TH>Customer</TH>
              <TH>Status</TH>
              <TH>Total</TH>
              <TH>Placed</TH>
            </TR>
          </THead>
          <TBody>
            {data.map((order) => (
              <TR key={order.id}>
                <TD className="font-mono text-xs">{order.reference}</TD>
                <TD>{order.customerName ?? '—'}</TD>
                <TD>
                  <Badge className="uppercase">{order.status}</Badge>
                </TD>
                <TD>{formatPrice(order.totalCents)}</TD>
                <TD className="text-fg-muted">
                  {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '—'}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </CardBody>
    </Card>
  )
}
