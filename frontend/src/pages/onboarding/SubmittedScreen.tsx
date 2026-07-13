import { CheckCircle2 } from 'lucide-react'
import { Button } from '../../components/ui'

/** Confirmation shown after a store application is submitted for review. */
export function SubmittedScreen({ name, onHome }: { name: string; onHome: () => void }) {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-lg flex-col items-center justify-center px-6 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-success-50 text-success-700">
        <CheckCircle2 aria-hidden className="size-9" />
      </span>
      <h1 className="mt-6 font-display text-3xl font-bold tracking-tight text-fg">Application submitted</h1>
      <p className="mt-3 text-fg-muted">
        <span className="font-bold text-fg">{name}</span> is now pending review. A platform admin will approve your store,
        and we'll email you the moment it goes live. You can then manage inventory, orders, and branding from your dashboard.
      </p>
      <Button size="lg" className="mt-8" onClick={onHome}>
        Back to marketplace
      </Button>
    </div>
  )
}

export default SubmittedScreen
