/**
 * storeAccent — a small, tasteful accent palette for the marketplace directory.
 * Each store gets a stable color for its avatar/logo chip: its own brand color
 * when set, otherwise a cycled palette hue. Kept deliberately harmonious (not
 * clashing) so the directory reads as one trustworthy marketplace.
 */

const HEX = /^#[0-9a-fA-F]{6}$/

export const STORE_ACCENTS = [
  '#6d5efc', // brand violet
  '#0ea5e9', // sky
  '#f59e0b', // amber
  '#f43f5e', // rose
  '#10b981', // emerald
  '#8b5cf6', // purple
  '#ef4444', // red
  '#14b8a6', // teal
] as const

export function storeAccent(seed: number, override?: string | null): string {
  const o = override?.trim()
  if (o && HEX.test(o)) return o
  const i = ((seed % STORE_ACCENTS.length) + STORE_ACCENTS.length) % STORE_ACCENTS.length
  return STORE_ACCENTS[i]
}

/** A soft, readable tint of the accent for chip/avatar backgrounds. */
export function accentTint(accent: string, pct = 12): string {
  return `color-mix(in srgb, ${accent} ${pct}%, white)`
}

/** Year a store joined, for a "Since 20XX" trust signal. Empty when unknown. */
export function memberSince(createdAt?: string): string {
  if (!createdAt) return ''
  const year = new Date(createdAt).getFullYear()
  return Number.isFinite(year) && year > 1970 ? String(year) : ''
}
