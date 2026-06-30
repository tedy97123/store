import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import { tv, type VariantProps } from 'tailwind-variants'
import { Loader2 } from 'lucide-react'
import { cx } from '../../lib/cx'

export const buttonVariants = tv({
  base: cx(
    'inline-flex items-center justify-center gap-2 rounded-btn font-bold',
    'whitespace-nowrap select-none transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
    'disabled:pointer-events-none disabled:opacity-50',
  ),
  variants: {
    variant: {
      primary: 'bg-brand-500 text-white shadow-sm hover:bg-brand-600',
      secondary: 'bg-surface text-fg border border-border hover:bg-bg',
      ghost: 'bg-transparent text-fg hover:bg-border/60',
      danger: 'bg-danger-500 text-white shadow-sm hover:bg-danger-700',
    },
    size: {
      sm: 'h-8 px-3 text-xs',
      md: 'h-10 px-4 text-sm',
      lg: 'h-12 px-6 text-base',
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'md',
  },
})

type ButtonVariantProps = VariantProps<typeof buttonVariants>

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'>,
    ButtonVariantProps {
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, loading = false, disabled, children, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {loading && <Loader2 aria-hidden className="size-4 animate-spin" />}
      {children}
    </button>
  )
})
