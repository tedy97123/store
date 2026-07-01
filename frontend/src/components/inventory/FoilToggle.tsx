import { Sparkles } from 'lucide-react'
import { cx } from '../../lib/cx'
import { FOIL_GRADIENT } from '../../lib/mtg'

export interface FoilToggleProps {
  value: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}

/** Foil toggle switch (binary, immediate). */
export function FoilToggle({ value, onChange, disabled }: FoilToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      disabled={disabled}
      onClick={() => onChange(!value)}
      className={cx(
        'relative inline-flex h-11 w-full items-center justify-between rounded-btn border px-3 text-sm font-bold transition-colors disabled:opacity-50',
        value ? 'border-transparent text-black/80' : 'border-border bg-surface text-fg-muted',
      )}
      style={value ? { backgroundImage: FOIL_GRADIENT } : undefined}
    >
      <span className="inline-flex items-center gap-1.5">
        <Sparkles aria-hidden className={cx('size-4', value ? 'opacity-90' : 'opacity-40')} />
        {value ? 'Foil' : 'Nonfoil'}
      </span>
      <span className="grid size-6 place-items-center rounded-full bg-white shadow">
        <span className={cx('size-2.5 rounded-full', value ? 'bg-brand-500' : 'bg-border')} />
      </span>
    </button>
  )
}

export default FoilToggle
