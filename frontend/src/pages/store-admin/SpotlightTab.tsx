import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import api, { formatPrice, parsePriceInput } from '../../api/client'
import { useStore } from '../../hooks'
import { Card, CardHeader, CardBody, Field, Input, Button } from '../../components/ui'

export default function SpotlightTab({ slug }: { slug: string }) {
  const queryClient = useQueryClient()
  const [minPriceDollars, setMinPriceDollars] = useState('10.00')

  const { data: store } = useStore(slug)

  useEffect(() => {
    if (store?.spotlightMinPriceCents !== undefined) {
      setMinPriceDollars((store.spotlightMinPriceCents / 100).toFixed(2))
    }
  }, [store?.spotlightMinPriceCents])

  const updateMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/stores/${slug}/settings`, {
        spotlightMinPriceCents: Math.max(0, parsePriceInput(minPriceDollars) ?? 0),
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['store', slug] })
    },
  })

  const currentCents = store?.spotlightMinPriceCents ?? 1000

  return (
    <Card>
      <CardHeader
        title="Spotlight carousel"
        subtitle="Cards at or above this store price appear in the public storefront spotlight."
      />
      <CardBody className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-[16rem_auto] sm:items-end">
          <Field label="Minimum price">
            {({ id }) => (
              <Input
                id={id}
                value={minPriceDollars}
                onChange={(e) => setMinPriceDollars(e.target.value)}
                inputMode="decimal"
              />
            )}
          </Field>
          <Button
            onClick={() => updateMutation.mutate()}
            loading={updateMutation.isPending}
          >
            <Sparkles className="size-4" aria-hidden />
            Save spotlight setting
          </Button>
        </div>

        <p className="text-sm text-fg-muted">
          Current threshold: <span className="font-bold text-fg">{formatPrice(currentCents)}</span>
        </p>

        {updateMutation.isSuccess && (
          <p className="text-sm font-medium text-success-700" role="status">
            Spotlight setting saved.
          </p>
        )}
        {updateMutation.isError && (
          <p className="text-sm font-medium text-danger-700" role="alert">
            Could not save spotlight setting.
          </p>
        )}
      </CardBody>
    </Card>
  )
}
