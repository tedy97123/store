import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, ExternalLink, RefreshCw, Square, Unplug } from 'lucide-react'
import api, { extractErrorMessage } from '../../api/client'
import type { SquareConnectResponse, StorePaymentStatus } from '../../api/types'
import { Badge, Button, Card, CardBody, CardHeader, ErrorState, LoadingPanel } from '../../components/ui'

const paymentKey = (slug: string) => ['store-payments', slug] as const

export default function PaymentsTab({ slug }: { slug: string }) {
  const queryClient = useQueryClient()
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: paymentKey(slug),
    queryFn: async () => {
      const { data } = await api.get<StorePaymentStatus>(`/stores/${slug}/payments`)
      return data
    },
  })

  const connectMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<SquareConnectResponse>(`/stores/${slug}/payments/square/connect`)
      return data
    },
    onSuccess: (result) => {
      window.location.assign(result.authorizationUrl)
    },
  })

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<StorePaymentStatus>(`/stores/${slug}/payments/square/disconnect`)
      return data
    },
    onSuccess: (result) => {
      queryClient.setQueryData(paymentKey(slug), result)
    },
  })

  const square = data?.square
  const connected = square?.status === 'connected'
  const errorMessage =
    extractErrorMessage(connectMutation.error, '') ||
    extractErrorMessage(disconnectMutation.error, '') ||
    square?.lastError ||
    ''

  if (isLoading) return <LoadingPanel label="Loading payment connections..." />

  if (error) {
    return (
      <div className="rounded-card border border-border bg-surface">
        <ErrorState title="Could not load payments" description="Payment connections could not be loaded." onRetry={() => void refetch()} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Payment connections"
          subtitle="Connect this store to payment providers. Square is the first live provider; PayPal can plug into the same surface next."
          actions={
            <Button variant="secondary" size="sm" onClick={() => void refetch()}>
              <RefreshCw aria-hidden className="size-4" />
              Refresh
            </Button>
          }
        />
        <CardBody>
          <div className="rounded-card border border-border bg-bg p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-card bg-surface text-fg shadow-card">
                  <Square aria-hidden className="size-6" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-xl font-bold text-fg">Square</h3>
                    <Badge tone={connected ? 'success' : square?.status === 'error' ? 'danger' : 'neutral'}>
                      {connected ? 'Connected' : square?.status === 'error' ? 'Needs attention' : 'Not connected'}
                    </Badge>
                    {square?.environment && <Badge tone="neutral">{square.environment}</Badge>}
                  </div>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-fg-muted">
                    Let this store authorize Square so checkout can charge through the store owner's Square seller account.
                  </p>

                  {connected && (
                    <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                      <PaymentFact label="Merchant" value={square.merchantId ?? '-'} />
                      <PaymentFact label="Connected" value={formatDate(square.connectedAt)} />
                      <PaymentFact label="Token expires" value={formatDate(square.tokenExpiresAt)} />
                      <PaymentFact label="Scopes" value={square.scopes.join(', ') || '-'} wide />
                    </dl>
                  )}

                  {errorMessage && (
                    <p role="alert" className="mt-3 text-sm font-medium text-danger-700">
                      {errorMessage}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                {connected ? (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={connectMutation.isPending}
                      onClick={() => connectMutation.mutate()}
                    >
                      <ExternalLink aria-hidden className="size-4" />
                      Reconnect
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      loading={disconnectMutation.isPending}
                      onClick={() => disconnectMutation.mutate()}
                    >
                      <Unplug aria-hidden className="size-4" />
                      Disconnect
                    </Button>
                  </>
                ) : (
                  <Button loading={connectMutation.isPending} onClick={() => connectMutation.mutate()}>
                    <CheckCircle2 aria-hidden className="size-4" />
                    Connect Square
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

function PaymentFact({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <dt className="text-xs font-bold uppercase tracking-wide text-fg-muted">{label}</dt>
      <dd className="mt-0.5 break-words font-medium text-fg">{value}</dd>
    </div>
  )
}

function formatDate(value?: string | null): string {
  if (!value) return '-'
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
