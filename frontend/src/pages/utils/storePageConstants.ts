import { ClipboardList, GalleryHorizontalEnd, Package, Search, WalletCards, type LucideIcon } from 'lucide-react'

/** Storefront (StorePage) filter, sort, and layout constants. */

export type FinishFilter = 'all' | 'foil' | 'nonfoil'
export type SortKey = 'featured' | 'price-desc' | 'price-asc' | 'name' | 'newest'
export type ViewMode = 'grid' | 'list'

export const DEFAULT_SPOTLIGHT_MIN_PRICE_CENTS = 1000
export const SPOTLIGHT_MAX_ITEMS = 12
export const RESULTS_PAGE_SIZE = 24

export const COLORS = [
  { key: 'W', label: 'White', dark: true },
  { key: 'U', label: 'Blue', dark: false },
  { key: 'B', label: 'Black', dark: false },
  { key: 'R', label: 'Red', dark: false },
  { key: 'G', label: 'Green', dark: false },
  { key: 'C', label: 'Colorless', dark: true },
] as const

export const FINISH_OPTIONS: { key: FinishFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'nonfoil', label: 'Nonfoil' },
  { key: 'foil', label: 'Foil' },
]

export const SORTS: { value: SortKey; label: string }[] = [
  { value: 'featured', label: 'Featured' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'name', label: 'Name: A–Z' },
  { value: 'newest', label: 'Newest' },
]

/**
 * Themed shortcut tiles shown above the spotlight. Entries with a `path` link
 * to a store-relative page, `action` entries trigger page behavior, and the
 * rest are placeholders until their destinations are built.
 */
export type QuickAction = { label: string; icon: LucideIcon; path?: string; action?: 'search' }

export const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Search Cards', icon: Search, action: 'search' },
  { label: 'Case cards', icon: GalleryHorizontalEnd, path: 'case-cards' },
  { label: 'Mass Search', icon: ClipboardList, path: 'mass-search' },
  { label: 'Deck Builder', icon: Package },
  { label: 'Sell/Trade', icon: WalletCards },
]
