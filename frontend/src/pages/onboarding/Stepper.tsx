import { CheckCircle2 } from 'lucide-react'
import { STEPS } from './config'

/** The numbered progress rail across the top of the wizard. */
export function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((s, i) => {
        const done = i < current
        const active = i === current
        const Icon = s.icon
        return (
          <li key={s.key} className="flex flex-1 items-center gap-2">
            <span
              className={`grid size-9 shrink-0 place-items-center rounded-full border text-sm font-bold transition-colors ${
                active
                  ? 'border-brand-500 bg-brand-500 text-white'
                  : done
                    ? 'border-brand-500 bg-brand-50 text-brand-600'
                    : 'border-border bg-surface text-fg-muted'
              }`}
            >
              {done ? <CheckCircle2 aria-hidden className="size-5" /> : <Icon aria-hidden className="size-4" />}
            </span>
            <span className={`hidden text-xs font-bold sm:block ${active ? 'text-fg' : 'text-fg-muted'}`}>{s.title}</span>
            {i < STEPS.length - 1 && <span className={`h-0.5 flex-1 rounded-full ${done ? 'bg-brand-500' : 'bg-border'}`} />}
          </li>
        )
      })}
    </ol>
  )
}

export default Stepper
