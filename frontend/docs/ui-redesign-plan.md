# Flat UI Enterprise Redesign — Plan

> Goal: rework the entire frontend into a clean, flat, minimalist enterprise design
> system — like the JOBIX reference (light enterprise dashboard with bold accent,
> rounded cards, pill filters, generous whitespace) and the flat mobile mocks.

## 1. Design principles (the rules we hold every screen to)

- **Minimalist & flat** — no skeuomorphism, no heavy gradients-as-chrome, no deep
  shadows. Surfaces separated by whitespace, hairline borders, and at most a soft
  shadow (`shadow-sm`). One accent gradient is allowed as a *hero* device only.
- **Typography first** — sans-serif (Lato / Aller for UI, MuseoSlab for display/
  headings). Hierarchy via size + weight + color, not decoration.
- **Bold, vibrant, *restrained* color** — one strong brand accent + one secondary,
  used intentionally on CTAs, active states, and data highlights. Everything else
  is neutral (slate/zinc scale). Vibrancy comes from where color is *absent*.
- **Simple iconography** — single icon set, geometric, 1.5px stroke, currentColor.
- **Simple buttons** — solid fill or subtle outline, rounded corners (`rounded-lg`),
  light shadow only on the primary action.
- **One theme language** — stop maintaining two divergent palettes (light storefront
  vs. dark admin). Move to a single tokenized light theme with an optional dark mode
  driven by the same tokens, so we don't hand-write `isAdminRoute ? dark : light`
  class pairs ever again.

## 2. Foundation: design tokens (Tailwind v4 `@theme`)

Tailwind v4 lets us define tokens in CSS via `@theme`. Put these in `index.css`
so utilities like `bg-brand-500`, `text-fg-muted`, `rounded-card` are generated.

```css
@import "tailwindcss";

@theme {
  /* Brand — pick the JOBIX-style violet, or your MTG brand color */
  --color-brand-50:  #f1efff;
  --color-brand-500: #6d5efc;   /* primary accent */
  --color-brand-600: #5b4ce0;   /* hover */
  --color-brand-700: #4a3dc4;

  --color-accent-500: #ff7a59;  /* secondary / highlight (the coral in the mocks) */

  /* Neutrals — single ramp, used for both light surfaces and dark mode */
  --color-fg:        #0f172a;   /* primary text */
  --color-fg-muted:  #64748b;   /* secondary text */
  --color-bg:        #f7f8fa;   /* app background */
  --color-surface:   #ffffff;   /* cards/panels */
  --color-border:    #e7e9ee;

  /* Radii / shadows / fonts */
  --radius-card: 16px;
  --radius-btn:  10px;
  --shadow-card: 0 1px 2px rgb(16 24 40 / 0.04), 0 1px 3px rgb(16 24 40 / 0.06);

  --font-sans:    "Lato", "Aller", system-ui, sans-serif;
  --font-display: "MuseoSlab", "Lato", serif;
}
```

Fonts: self-host Lato + a MuseoSlab/Aller fallback via `@font-face` (or Lato + a
free slab like "Bitter"/"Zilla Slab" for MuseoSlab, which is licensed) under
`frontend/src/assets/fonts/`. Avoid Google Fonts CDN for an enterprise app — bundle
them.

## 3. Component library — `frontend/src/components/ui/`

This is the single biggest lever. Today every page hand-writes Tailwind blobs and
duplicates the `isAdminRoute ? ... : ...` pattern. Build a small primitive set and
refactor pages to consume it. Use `class-variance-authority`-style variant maps (or
a tiny local `cx()` helper) — no need for a heavy UI framework.

Primitives to create (each its own file, with variants):

| Component | Variants / props | Replaces |
|---|---|---|
| `Button` | `variant: primary \| secondary \| ghost \| danger`, `size`, `loading` | every hand-rolled `<button className="rounded-md bg-blue-700...">` |
| `Card` / `CardHeader` / `CardBody` | padded surface w/ `radius-card`, `shadow-card` | repeated panel divs |
| `Input` / `Textarea` / `Select` | label, error, hint (wire to react-hook-form) | duplicated form fields in Login/Register |
| `Field` | label + control + error wrapper | form boilerplate |
| `Badge` / `Pill` | `tone: brand \| success \| warning \| danger \| neutral` | inline status spans |
| `FilterPill` | toggle pill (the JOBIX filter row) | search filters |
| `Tabs` | accessible tab list + panels | StoreAdminPage tab switching |
| `Table` / `DataList` | header, rows, empty state, loading | Orders/Reports/Imports tables |
| `Modal` / `Drawer` | focus-trap, esc-to-close | account/menu popovers |
| `Avatar`, `Icon` | icon wrapper (lucide-react) | ad-hoc SVGs |
| `EmptyState`, `Spinner`, `ErrorState` | shared async states | inline loading text everywhere |
| `PageHeader` | title + subtitle + actions slot | repeated page headers |

Add **`lucide-react`** for iconography (flat, geometric, tree-shakeable, currentColor).

## 4. Layout system — `frontend/src/components/layout/`

- `AppLayout` (storefront): top nav using `Button`/`NavLink` tokens — delete the
  dual-palette conditionals.
- `AdminLayout` (new): enterprise shell = left **sidebar** nav + top bar + content
  area, matching the JOBIX dashboard. Store-admin and platform-admin both use it.
  This replaces the current "admin = dark recolor of the same top nav" approach.
- Shared `PageContainer` (`max-w-7xl`, responsive padding).

## 5. Page-by-page rollout (phased)

**Phase 0 — Foundation (no visual regressions yet)**
1. Add tokens to `index.css`, self-host fonts, install `lucide-react` + `cva`/`clsx`.
2. Build `ui/` primitives + Storybook-less "kitchen sink" route (`/_ui`) to eyeball them.

**Phase 1 — Shells & shared chrome**
3. Refactor `AppLayout`; build `AdminLayout` (sidebar). Remove `isAdminRoute` branching.

**Phase 2 — Auth & entry (small, high-traffic, good first conversions)**
4. `LoginPage`, `RegisterPage` → `Card` + `Field`/`Input`/`Button`.

**Phase 3 — Storefront (customer-facing, most visible)**
5. `HomePage` (store directory → card grid + hero).
6. `StorePage` (catalog + search → `FilterPill` row + result cards, JOBIX-style
   list/detail split).
7. `CardDetailsPage` (detail panel layout).

**Phase 4 — Store admin workspace**
8. `StoreAdminPage` + tabs (`SearchTab`, `OrdersTab`, `CsvTab`, `ReportsTab`,
   `SpotlightTab`) → `Tabs`, `Table`, `DataList`, `Card`.
9. `ImportRunDetailsPage`.

**Phase 5 — Platform admin**
10. `PlatformAdminPage`, `PlatformStoreImportsPage`.

**Phase 6 — Polish**
11. Empty/loading/error states everywhere via shared components, responsive QA,
    a11y pass (focus rings, contrast, keyboard nav), dark mode toggle if desired.

## 6. Conventions to lock in

- No raw color literals in components — only token utilities (`bg-brand-500`, not
  `bg-[#6d5efc]`).
- No conditional palette strings — variants live in the component, not the caller.
- Every async surface renders `Spinner` / `EmptyState` / `ErrorState`.
- Co-locate page-specific subcomponents under the page folder; promote to `ui/`
  only when reused 2+ times.

## 7. Suggested deps

```
npm i lucide-react clsx tailwind-variants
```
(`tailwind-variants` or `cva` for variant maps; `clsx` for conditional classes.)
