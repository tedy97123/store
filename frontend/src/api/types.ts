export interface ApiError {
  response?: {
    status?: number
    data?: unknown
  }
}

export type CardDisplayStyle = 'gallery' | 'marketplace'

export interface Store {
  id: number
  name: string
  slug: string
  isActive?: boolean
  featured?: boolean
  spotlightMinPriceCents?: number
  // Storefront branding (owner-managed via /settings)
  primaryColor?: string | null
  accentColor?: string | null
  backgroundColor?: string | null
  surfaceColor?: string | null
  textColor?: string | null
  mutedColor?: string | null
  borderColor?: string | null
  logoUrl?: string | null
  heroImageUrl?: string | null
  heroHeading?: string | null
  heroSubheading?: string | null
  tagline?: string | null
  cardDisplayStyle?: CardDisplayStyle
  owner?: {
    id: number
    email: string
    displayName: string
  }
  createdAt?: string
}

export interface StorePaymentAccount {
  provider: 'square'
  status: 'connected' | 'disconnected' | 'error'
  environment: 'sandbox' | 'production' | string
  merchantId?: string | null
  locationId?: string | null
  scopes: string[]
  tokenExpiresAt?: string | null
  connectedAt?: string | null
  disconnectedAt?: string | null
  lastError?: string | null
}

export interface StorePaymentStatus {
  square: StorePaymentAccount | null
}

export interface SquareConnectResponse {
  authorizationUrl: string
  environment: 'sandbox' | 'production' | string
  scopes: string[]
}

export interface CardFace {
  name?: string
  imageUrl?: string
  imageUris?: {
    normal?: string
    small?: string
    large?: string
    png?: string
  }
  manaCost?: string
  typeLine?: string
  oracleText?: string
  power?: string
  toughness?: string
  loyalty?: string
  flavorText?: string
  artist?: string
  colors?: string[]
}

export interface CardSummary {
  id: string
  oracleId?: string
  name: string
  setCode?: string
  setName?: string
  collectorNumber?: string
  rarity?: string
  manaCost?: string
  typeLine?: string
  oracleText?: string
  cmc?: number
  imageUrl?: string
  imageUris?: {
    normal?: string
    small?: string
    large?: string
    png?: string
  }
  prices?: {
    usd?: string | null
    usd_foil?: string | null
    usd_etched?: string | null
    eur?: string | null
    eur_foil?: string | null
    tix?: string | null
  }
  colors?: string[]
  colorIdentity?: string[]
  keywords?: string[]
  power?: string
  toughness?: string
  loyalty?: string
  artist?: string
  flavorText?: string
  legalities?: Record<string, string>
  finishes?: string[]
  games?: string[]
  releasedAt?: string
  lang?: string
  layout?: string
  scryfallUri?: string
  /** Per-face art/text for multi-faced cards (transform, modal_dfc, flip, …). */
  cardFaces?: CardFace[]
}

export interface InventoryItem {
  id: number
  quantity: number
  priceCents: number
  condition: 'NM' | 'LP' | 'MP' | 'HP' | 'DMG'
  isFoil: boolean
  notes?: string | null
  card: CardSummary
}

export interface StoreCustomer {
  // `id` is null when the current user has no saved profile for the store yet
  // (the GET endpoint returns an empty representation rather than persisting one).
  id: number | null
  phone?: string | null
  shippingAddress?: string | null
  paymentBrand?: string | null
  paymentLast4?: string | null
  paymentExpires?: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface CustomerFavorite {
  id: number
  inventoryItem: InventoryItem
  createdAt: string
}

export interface CartItem {
  id: number
  quantity: number
  inventoryItem: InventoryItem
  createdAt: string
  updatedAt: string
}

export interface CustomerWantListEntry {
  id: number
  card?: CardSummary | null
  cardName: string
  setCode?: string | null
  isFoil: boolean
  quantity: number
  notes?: string | null
  createdAt: string
}

export type CsvImportJobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'paused' | 'cancelled'

export type CsvImportRowStatus = 'queued' | 'processing' | 'imported' | 'error'

export interface CsvImportRow {
  rowIndex: number
  name: string
  game: string
  set: string
  condition: string
  isFoil: boolean
  rarity: string
  quantity: number
  variant: string
  collectorNumber: string
  status: CsvImportRowStatus
  card?: CardSummary | null
  error?: string | null
  importedItemId?: number
}

export interface CsvImportJob {
  id: number
  status: CsvImportJobStatus
  originalFilename: string
  storagePath: string
  totalRows: number
  processedRows: number
  importedRows: number
  failedRows: number
  queuedRows: number
  processingRows: number
  errorMessage?: string | null
  createdAt: string
  updatedAt: string
  startedAt?: string | null
  finishedAt?: string | null
  rowOffset: number
  rowLimit: number
  rows: CsvImportRow[]
}

export interface CsvImportJobSummary {
  id: number
  status: CsvImportJobStatus
  originalFilename: string
  totalRows: number
  processedRows: number
  importedRows: number
  failedRows: number
  errorMessage?: string | null
  createdAt: string
  updatedAt: string
  startedAt?: string | null
  finishedAt?: string | null
}

export interface UserProfile {
  id: number
  email: string
  displayName: string
  roles: string[]
  ownedStores: Pick<Store, 'id' | 'name' | 'slug'>[]
}

export interface AdminUser {
  id: number
  email: string
  displayName: string
  roles: string[]
}

export interface ScryfallSyncResult {
  status: string
  inserted: number
  updated: number
  total: number
}

export interface OrderLine {
  id: number
  cardName: string
  quantity: number
  priceCents: number
}

export interface Order {
  id: number
  reference: string
  status: string
  customerName?: string
  totalCents: number
  createdAt: string
  lines?: OrderLine[]
}
