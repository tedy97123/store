/** Shared value formatters used across pages. */

/** Localized short date ("Jul 1, 2026"); returns "-" for missing/blank input. */
export function formatDate(value?: string): string {
  if (!value) return '-'
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
