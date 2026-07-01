import { cx } from '../../lib/cx'
import { CONDITIONS, CONDITION_LABELS, type Condition } from './condition'

export interface ConditionSegmentedProps {
  value: Condition
  onChange: (v: Condition) => void
}

/** Condition segmented control (single active option). */
export function ConditionSegmented({ value, onChange }: ConditionSegmentedProps) {
  return (
    <div className="flex overflow-hidden rounded-btn border border-border">
      {CONDITIONS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-pressed={value === c}
          title={CONDITION_LABELS[c]}
          className={cx(
            'flex-1 px-2 py-2 text-xs font-bold transition-colors',
            value === c ? 'bg-brand-50 text-brand-700' : 'bg-surface text-fg-muted hover:text-fg',
          )}
        >
          {c}
        </button>
      ))}
    </div>
  )
}

export default ConditionSegmented
