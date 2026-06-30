import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Heart, ImageOff, Palette, Search } from 'lucide-react'
import api, { httpStatus } from '../../api/client'
import type { ApiError, Store } from '../../api/types'
import { useStore } from '../../hooks'
import { Badge, Button, Card, CardBody, CardHeader, Field, FilterPill, Input, Textarea } from '../../components/ui'
import { StoreHero, DEFAULT_PRIMARY, DEFAULT_ACCENT } from '../../components/store/StoreHero'
import { storeThemeVars } from '../../lib/storeTheme'

const HEX = /^#[0-9a-fA-F]{6}$/

/** Token fallbacks (mirror the platform default theme in index.css). */
const DEFAULTS = {
  primaryColor: DEFAULT_PRIMARY,
  accentColor: DEFAULT_ACCENT,
  backgroundColor: '#f7f8fa',
  surfaceColor: '#ffffff',
  textColor: '#0f172a',
  mutedColor: '#64748b',
  borderColor: '#e7e9ee',
}

type PaletteKey = keyof typeof DEFAULTS

interface BrandingForm {
  primaryColor: string
  accentColor: string
  backgroundColor: string
  surfaceColor: string
  textColor: string
  mutedColor: string
  borderColor: string
  logoUrl: string
  heroImageUrl: string
  heroHeading: string
  heroSubheading: string
  tagline: string
}

const EMPTY: BrandingForm = {
  primaryColor: '',
  accentColor: '',
  backgroundColor: '',
  surfaceColor: '',
  textColor: '',
  mutedColor: '',
  borderColor: '',
  logoUrl: '',
  heroImageUrl: '',
  heroHeading: '',
  heroSubheading: '',
  tagline: '',
}

function fromStore(store: Store): BrandingForm {
  return {
    primaryColor: store.primaryColor ?? '',
    accentColor: store.accentColor ?? '',
    backgroundColor: store.backgroundColor ?? '',
    surfaceColor: store.surfaceColor ?? '',
    textColor: store.textColor ?? '',
    mutedColor: store.mutedColor ?? '',
    borderColor: store.borderColor ?? '',
    logoUrl: store.logoUrl ?? '',
    heroImageUrl: store.heroImageUrl ?? '',
    heroHeading: store.heroHeading ?? '',
    heroSubheading: store.heroSubheading ?? '',
    tagline: store.tagline ?? '',
  }
}

type Palette = Record<PaletteKey, string>

interface Preset {
  name: string
  palette: Palette
}

// Curated, ready-to-use themes spanning light → dark → seasonal → pastel.
const PRESETS: Preset[] = [
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

export default function BrandingTab({ slug }: { slug: string }) {
  const queryClient = useQueryClient()
  const { data: store, isLoading } = useStore(slug)
  const [form, setForm] = useState<BrandingForm>(EMPTY)

  useEffect(() => {
    if (store) setForm(fromStore(store))
  }, [store])

  const set = <K extends keyof BrandingForm>(key: K, value: BrandingForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const applyPreset = (preset: Preset) => setForm((current) => ({ ...current, ...preset.palette }))

  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.patch<Store>(`/stores/${slug}/settings`, form)
      return data
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['store', slug] })
    },
  })

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="space-y-6">
        <Card>
          <CardHeader title="Theme presets" subtitle="One click to apply a curated palette — then fine-tune below." />
          <CardBody>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="group rounded-card border border-border p-3 text-left transition-colors hover:border-brand-500"
                >
                  <span className="flex h-10 overflow-hidden rounded-btn border border-border">
                    {(['backgroundColor', 'surfaceColor', 'primaryColor', 'accentColor', 'textColor'] as PaletteKey[]).map(
                      (key) => (
                        <span key={key} className="flex-1" style={{ backgroundColor: preset.palette[key] }} />
                      ),
                    )}
                  </span>
                  <span className="mt-2 block text-sm font-bold text-fg">{preset.name}</span>
                </button>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Brand colors" subtitle="Primary drives buttons, links, and accents across your store." />
          <CardBody className="grid gap-5 sm:grid-cols-2">
            <ColorField label="Primary / button color" value={form.primaryColor} fallback={DEFAULTS.primaryColor} onChange={(v) => set('primaryColor', v)} />
            <ColorField label="Accent color" value={form.accentColor} fallback={DEFAULTS.accentColor} onChange={(v) => set('accentColor', v)} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Surface & text" subtitle="Theme the page background, cards, text, and borders." />
          <CardBody className="grid gap-5 sm:grid-cols-2">
            <ColorField label="Page background" value={form.backgroundColor} fallback={DEFAULTS.backgroundColor} onChange={(v) => set('backgroundColor', v)} />
            <ColorField label="Card / surface" value={form.surfaceColor} fallback={DEFAULTS.surfaceColor} onChange={(v) => set('surfaceColor', v)} />
            <ColorField label="Text color" value={form.textColor} fallback={DEFAULTS.textColor} onChange={(v) => set('textColor', v)} />
            <ColorField label="Muted text" value={form.mutedColor} fallback={DEFAULTS.mutedColor} onChange={(v) => set('mutedColor', v)} />
            <ColorField label="Border color" value={form.borderColor} fallback={DEFAULTS.borderColor} onChange={(v) => set('borderColor', v)} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Logo & hero image" subtitle="Paste hosted image URLs (https:// or a /path)." />
          <CardBody className="space-y-4">
            <Input label="Logo / icon URL" placeholder="https://…/logo.png" value={form.logoUrl} onChange={(e) => set('logoUrl', e.target.value)} />
            <Input label="Hero banner image URL" placeholder="https://…/banner.jpg" value={form.heroImageUrl} onChange={(e) => set('heroImageUrl', e.target.value)} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Messaging" subtitle="Headline and supporting copy for your storefront banner." />
          <CardBody className="space-y-4">
            <Input label="Tagline" placeholder="Your local Magic singles shop" maxLength={160} value={form.tagline} onChange={(e) => set('tagline', e.target.value)} />
            <Input label="Hero heading" placeholder="Defaults to your store name" maxLength={160} value={form.heroHeading} onChange={(e) => set('heroHeading', e.target.value)} />
            <Textarea label="Hero subheading" rows={3} placeholder="A sentence or two about your store, shipping, or specialties." value={form.heroSubheading} onChange={(e) => set('heroSubheading', e.target.value)} />
          </CardBody>
        </Card>

        <div className="flex items-center gap-4">
          <Button onClick={() => mutation.mutate()} loading={mutation.isPending} disabled={isLoading}>
            <Palette aria-hidden className="size-4" />
            Save branding
          </Button>
          {mutation.isSuccess && (
            <span role="status" className="text-sm font-medium text-success-700">
              Branding saved.
            </span>
          )}
          {mutation.isError && (
            <span role="alert" className="text-sm font-medium text-danger-700">
              {readError(mutation.error)}
            </span>
          )}
        </div>
      </div>

      {/* Live preview */}
      <div className="xl:sticky xl:top-8 xl:self-start">
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-fg-muted">Live store preview</p>
        <StorePreview form={form} storeName={store?.name ?? slug} />
        <p className="mt-3 text-xs text-fg-muted">
          A live preview of your storefront — background, cards, text, buttons, and accents update as you edit.
        </p>
      </div>
    </div>
  )
}

/**
 * StorePreview — a scaled-down, live mock of the storefront. The in-progress
 * palette is scoped to this container by overriding the design-token CSS
 * variables; every primitive inside (Button, Card, Badge, FilterPill, hero)
 * reads those tokens, so the whole preview retones instantly as the owner edits
 * — before anything is saved.
 */
function StorePreview({ form, storeName }: { form: BrandingForm; storeName: string }) {
  // Same derivation the live site uses, scoped to this container so the preview
  // is an exact match — including readable neutrals derived from a dark background.
  const vars = storeThemeVars(form)
  const themeStyle = {
    ...vars,
    backgroundColor: vars['--color-bg'] ?? DEFAULTS.backgroundColor,
    color: vars['--color-fg'] ?? DEFAULTS.textColor,
  } as CSSProperties

  return (
    <div style={themeStyle} className="space-y-4 overflow-hidden rounded-card border border-border p-4">
      <StoreHero
        name={storeName}
        tagline={form.tagline}
        heroHeading={form.heroHeading}
        heroSubheading={form.heroSubheading}
        heroImageUrl={form.heroImageUrl}
        logoUrl={form.logoUrl}
        primaryColor={form.primaryColor}
        accentColor={form.accentColor}
      />

      <div className="flex flex-wrap items-center gap-2">
        <FilterPill active>Foil</FilterPill>
        <FilterPill>Rare</FilterPill>
        <FilterPill>Mythic</FilterPill>
        <Button size="sm" className="ml-auto">
          <Search aria-hidden className="size-4" />
          Search
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[1, 2].map((n) => (
          <div key={n} className="rounded-card border border-border bg-surface p-3 shadow-card">
            <div className="grid h-20 place-items-center rounded-btn bg-bg text-fg-muted">
              <ImageOff aria-hidden className="size-5" />
            </div>
            <p className="mt-2 truncate text-sm font-bold text-brand-600">Sample Card {n}</p>
            <div className="mt-1 flex items-center justify-between">
              <Badge tone={n === 1 ? 'brand' : 'neutral'}>{n === 1 ? 'Foil' : 'NM'}</Badge>
              <span className="text-sm font-bold text-fg">${(n * 1.53).toFixed(2)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button className="flex-1">
          <Heart aria-hidden className="size-4" />
          Save favorite
        </Button>
        <Button variant="secondary" className="flex-1">
          Add to want list
        </Button>
      </div>
    </div>
  )
}

function readError(error: unknown): string {
  if (httpStatus(error) === 422) {
    const detail = (error as ApiError | null)?.response?.data
    if (detail && typeof detail === 'object' && 'detail' in detail) {
      return String((detail as { detail: unknown }).detail)
    }
    return 'Please check your colors and image URLs.'
  }
  return 'Could not save branding. Please try again.'
}

function ColorField({
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
