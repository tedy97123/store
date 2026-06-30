import clsx, { type ClassValue } from 'clsx'

/**
 * cx — thin wrapper around clsx for conditional className composition.
 * Use everywhere we merge a component's internal classes with a caller's
 * `className` passthrough.
 */
export function cx(...inputs: ClassValue[]): string {
  return clsx(inputs)
}

export default cx
