import { forwardRef, useId } from 'react'
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { cx } from '../../lib/cx'

const fieldShell = 'flex flex-col gap-1.5'

function Label({ id, children, required }: { id: string; children: ReactNode; required?: boolean }) {
  return (
    <label htmlFor={id} className="text-sm font-bold text-fg">
      {children}
      {required && <span className="text-danger-500"> *</span>}
    </label>
  )
}

function Caption({ id, error, hint }: { id?: string; error?: ReactNode; hint?: ReactNode }) {
  if (error != null) {
    return (
      <p id={id} className="text-xs font-medium text-danger-700">
        {error}
      </p>
    )
  }
  if (hint != null) {
    return (
      <p id={id} className="text-xs text-fg-muted">
        {hint}
      </p>
    )
  }
  return null
}

const controlBase = cx(
  'w-full rounded-btn border bg-surface text-fg placeholder:text-fg-muted',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-0',
  'disabled:cursor-not-allowed disabled:opacity-60',
)

function controlBorder(hasError?: boolean) {
  return hasError ? 'border-danger-500' : 'border-border'
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode
  error?: ReactNode
  hint?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, className, id, required, ...props },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const descId = error || hint ? `${inputId}-desc` : undefined
  return (
    <div className={fieldShell}>
      {label != null && (
        <Label id={inputId} required={required}>
          {label}
        </Label>
      )}
      <input
        ref={ref}
        id={inputId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={descId}
        className={cx(controlBase, controlBorder(!!error), 'h-10 px-3 text-sm', className)}
        {...props}
      />
      <Caption id={descId} error={error} hint={hint} />
    </div>
  )
})

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode
  error?: ReactNode
  hint?: ReactNode
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, className, id, required, rows = 4, ...props },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const descId = error || hint ? `${inputId}-desc` : undefined
  return (
    <div className={fieldShell}>
      {label != null && (
        <Label id={inputId} required={required}>
          {label}
        </Label>
      )}
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={descId}
        className={cx(controlBase, controlBorder(!!error), 'px-3 py-2 text-sm', className)}
        {...props}
      />
      <Caption id={descId} error={error} hint={hint} />
    </div>
  )
})

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode
  error?: ReactNode
  hint?: ReactNode
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hint, className, id, required, children, ...props },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const descId = error || hint ? `${inputId}-desc` : undefined
  return (
    <div className={fieldShell}>
      {label != null && (
        <Label id={inputId} required={required}>
          {label}
        </Label>
      )}
      <select
        ref={ref}
        id={inputId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={descId}
        className={cx(controlBase, controlBorder(!!error), 'h-10 px-3 text-sm', className)}
        {...props}
      >
        {children}
      </select>
      <Caption id={descId} error={error} hint={hint} />
    </div>
  )
})
