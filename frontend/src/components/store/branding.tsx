/* eslint-disable react-refresh/only-export-components */
import { Field, Input } from '../ui'

export const HEX = /^#[0-9a-fA-F]{6}$/

/** Token fallbacks (mirror the platform default theme in index.css). */
export const PALETTE_DEFAULTS = {
  primaryColor: '#6d5efc',
  accentColor: '#ff7a59',
  backgroundColor: '#f7f8fa',
  surfaceColor: '#ffffff',
  textColor: '#0f172a',
  mutedColor: '#64748b',
  borderColor: '#e7e9ee',
} as const

export type PaletteKey = keyof typeof PALETTE_DEFAULTS
export type Palette = Record<PaletteKey, string>

export interface ThemePreset {
  name: string
  palette: Palette
}

// Curated, ready-to-use themes spanning light → dark → seasonal → pastel.
export const THEME_PRESETS: ThemePreset[] = [
  {
    name: 'Clean Light',
    palette: { primaryColor: '#6d5efc', accentColor: '#ff7a59', backgroundColor: '#f7f8fa', surfaceColor: '#ffffff', textColor: '#0f172a', mutedColor: '#64748b', borderColor: '#e7e9ee' },
  },
  {
    name: 'Midnight',
    palette: { primaryColor: '#8b8cf7', accentColor: '#f472b6', backgroundColor: '#0f1220', surfaceColor: '#191d2e', textColor: '#f4f5fb', mutedColor: '#a6abc8', borderColor: '#2c3146' },
  },
  {
    name: 'Spring Bloom',
    palette: { primaryColor: '#2fb574', accentColor: '#ff7eb6', backgroundColor: '#f2fbf6', surfaceColor: '#ffffff', textColor: '#14342a', mutedColor: '#5f7d70', borderColor: '#d6ece0' },
  },
  {
    name: 'Summer Sun',
    palette: { primaryColor: '#f5a524', accentColor: '#ff5d8f', backgroundColor: '#fff8ec', surfaceColor: '#ffffff', textColor: '#3a2a12', mutedColor: '#8a7355', borderColor: '#f3e3c9' },
  },
  {
    name: 'Pastel Dream',
    palette: { primaryColor: '#a78bfa', accentColor: '#f9a8d4', backgroundColor: '#faf7ff', surfaceColor: '#ffffff', textColor: '#4a3f5c', mutedColor: '#8b80a3', borderColor: '#ece6f9' },
  },
  {
    name: 'Ocean Breeze',
    palette: { primaryColor: '#2b8ad6', accentColor: '#18c2b3', backgroundColor: '#f0f8fc', surfaceColor: '#ffffff', textColor: '#0e2a3a', mutedColor: '#5b7689', borderColor: '#d4e8f2' },
  },
  {
    name: 'Forest Night',
    palette: { primaryColor: '#4caf7d', accentColor: '#e6b85c', backgroundColor: '#0e2018', surfaceColor: '#163026', textColor: '#eaf5ee', mutedColor: '#9bbfaa', borderColor: '#274536' },
  },
  {
    name: 'Sunset Coral',
    palette: { primaryColor: '#ef5777', accentColor: '#ffa801', backgroundColor: '#fff4f1', surfaceColor: '#ffffff', textColor: '#3d1f24', mutedColor: '#9a6b71', borderColor: '#f6d9d3' },
  },
]

export function ColorField({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string
  value: string
  fallback: string
  onChange: (value: string) => void
}) {
  return (
    <Field label={label} hint="6-digit hex, e.g. #6d5efc">
      {({ id }) => (
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label={`${label} swatch`}
            value={HEX.test(value) ? value : fallback}
            onChange={(e) => onChange(e.target.value)}
            className="size-10 flex-shrink-0 cursor-pointer rounded-btn border border-border bg-surface p-1"
          />
          <Input id={id} value={value} placeholder={fallback} onChange={(e) => onChange(e.target.value)} className="font-mono" />
        </div>
      )}
    </Field>
  )
}

/** One-click palette swatch button used by the presets grid. */
export function ThemePresetButton({ preset, onSelect }: { preset: ThemePreset; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group rounded-card border border-border p-3 text-left transition-colors hover:border-brand-500"
    >
      <span className="flex h-10 overflow-hidden rounded-btn border border-border">
        {(['backgroundColor', 'surfaceColor', 'primaryColor', 'accentColor', 'textColor'] as PaletteKey[]).map((key) => (
          <span key={key} className="flex-1" style={{ backgroundColor: preset.palette[key] }} />
        ))}
      </span>
      <span className="mt-2 block text-sm font-bold text-fg">{preset.name}</span>
    </button>
  )
}
