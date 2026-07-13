import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Loader2 } from 'lucide-react'
import api, { extractErrorMessage, formatPrice } from '../../../api/client'
import type { OnboardingPaymentMethod, PaymentClientToken, Plan } from '../../../api/types'
import { Button, Input } from '../../../components/ui'
import { METHOD_LABELS } from '../config'
import type { OnboardingPayment, PatchPayment } from '../types'

export function PaymentStep({
  required,
  plan,
  payment,
  patchPayment,
}: {
  required: boolean
  plan?: Plan
  payment: OnboardingPayment
  patchPayment: PatchPayment
}) {
  const tokenQuery = useQuery({
    queryKey: ['onboarding-payment-token'],
    queryFn: async () => {
      const { data } = await api.get<PaymentClientToken>('/payments/onboarding/client-token')
      return data
    },
    enabled: required,
  })

  if (!required) {
    return (
      <p className="flex items-center gap-2 rounded-btn bg-success-50 px-3 py-2 text-sm font-medium text-success-700">
        <CheckCircle2 aria-hidden className="size-4" />
        {plan?.name ?? 'This plan'} is free — no payment method needed. Continue to review.
      </p>
    )
  }

  if (tokenQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-fg-muted">
        <Loader2 aria-hidden className="size-4 animate-spin" />
        Loading payment options…
      </p>
    )
  }

  if (tokenQuery.isError || !tokenQuery.data) {
    return (
      <div className="max-w-xl space-y-3">
        <p role="alert" className="rounded-btn bg-danger-50 px-3 py-2 text-sm font-medium text-danger-700">
          {extractErrorMessage(tokenQuery.error, 'Payment options could not be loaded.')}
        </p>
        <Button variant="secondary" onClick={() => void tokenQuery.refetch()}>
          Try again
        </Button>
      </div>
    )
  }

  const { mode, methods } = tokenQuery.data

  // Only mock mode can tokenize in this build; live mode needs the Braintree
  // Drop-in UI (not bundled yet), so we say so instead of faking a nonce that
  // the gateway would decline at submit.
  if (mode !== 'mock') {
    return (
      <p role="alert" className="max-w-xl rounded-btn bg-danger-50 px-3 py-2 text-sm font-medium text-danger-700">
        Live payments are enabled on the server, but this app build does not include the payment form yet. Please
        contact support to finish signing up for a paid plan.
      </p>
    )
  }

  const makeNonce = (method: OnboardingPaymentMethod) => `mock-${method}-${Date.now().toString(36)}`

  return (
    <div className="max-w-xl space-y-5">
      <div className="flex items-center justify-between rounded-card border border-border bg-bg p-4">
        <div>
          <p className="text-sm text-fg-muted">You're subscribing to</p>
          <p className="font-display text-lg font-bold text-fg">{plan?.name}</p>
        </div>
        <p className="font-display text-2xl font-bold text-fg">
          {plan ? formatPrice(plan.priceCents) : ''}
          <span className="text-sm font-medium text-fg-muted">/mo</span>
        </p>
      </div>

      <p className="rounded-btn bg-brand-50 px-3 py-2 text-xs font-medium text-brand-700">
        Sandbox mode — no real charge is made. Configure Braintree credentials to go live.
      </p>

      <div className="grid grid-cols-2 gap-3">
        {methods
          .filter((m) => m !== 'card')
          .map((method) => (
            <button
              key={method}
              type="button"
              onClick={() => patchPayment({ methodType: method, nonce: makeNonce(method), last4: '' })}
              aria-pressed={payment.methodType === method}
              className={`flex items-center justify-center gap-2 rounded-card border px-4 py-3 text-sm font-bold transition-colors ${
                payment.methodType === method
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-border bg-surface text-fg hover:border-brand-500'
              }`}
            >
              {payment.methodType === method && <CheckCircle2 aria-hidden className="size-4" />}
              {METHOD_LABELS[method]}
            </button>
          ))}
      </div>

      {methods.includes('card') && (
        <CardEntry
          active={payment.methodType === 'card'}
          onTokenize={(last4) => patchPayment({ methodType: 'card', nonce: makeNonce('card'), last4 })}
        />
      )}

      {payment.methodType && payment.nonce && (
        <p className="flex items-center gap-2 text-sm font-medium text-success-700">
          <CheckCircle2 aria-hidden className="size-4" />
          {METHOD_LABELS[payment.methodType]} ready{payment.last4 ? ` •••• ${payment.last4}` : ''}.
        </p>
      )}
    </div>
  )
}

function CardEntry({ active, onTokenize }: { active: boolean; onTokenize: (last4: string) => void }) {
  const [number, setNumber] = useState('')
  const [exp, setExp] = useState('')
  const [cvc, setCvc] = useState('')
  const digits = number.replace(/\D/g, '')
  const valid = digits.length >= 12 && /^\d{2}\s*\/\s*\d{2}$/.test(exp) && cvc.length >= 3

  return (
    <div className={`space-y-3 rounded-card border p-4 ${active ? 'border-brand-500' : 'border-border'}`}>
      <p className="text-sm font-bold text-fg">Or pay by card</p>
      <p className="text-xs text-fg-muted">Sandbox simulation — card details are never sent or stored.</p>
      <Input label="Card number" inputMode="numeric" autoComplete="cc-number" placeholder="4111 1111 1111 1111" value={number} onChange={(e) => setNumber(e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Expiry" placeholder="MM / YY" autoComplete="cc-exp" value={exp} onChange={(e) => setExp(e.target.value)} />
        <Input label="CVC" inputMode="numeric" autoComplete="cc-csc" placeholder="123" value={cvc} onChange={(e) => setCvc(e.target.value)} />
      </div>
      <Button variant="secondary" disabled={!valid} onClick={() => onTokenize(digits.slice(-4))}>
        Use this card
      </Button>
    </div>
  )
}

export default PaymentStep
