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
  // Enterprise onboarding (status/planKey in store:read; rest in store:admin)
  status?: 'pending' | 'approved' | 'rejected'
  rejectionReason?: string | null
  planKey?: string | null
  subscriptionStatus?: string
  paymentMethodType?: string | null
  paymentLast4?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  region?: string | null
  postalCode?: string | null
  country?: string | null
  phone?: string | null
  latitude?: number | null
  longitude?: number | null
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

export interface SsoStatus {
  configured: boolean
  providerName: string
}

export interface IntegrationStatus {
  configured: boolean
  provider?: string
  mode?: string
  envKeys: string[]
}

export interface AdminIntegrations {
  sso: IntegrationStatus & { providerName: string }
  addressAutocomplete: IntegrationStatus
  subscriptionPayments: IntegrationStatus
}

export interface Plan {
  key: string
  name: string
  priceCents: number
  tagline: string
  popular?: boolean
  features: string[]
}

export interface GeocodeSuggestion {
  label: string
  addressLine1: string
  city: string
  region: string
  postalCode: string
  country: string
  latitude: number | null
  longitude: number | null
}

export type OnboardingPaymentMethod = 'paypal' | 'apple_pay' | 'google_pay' | 'card'

export interface PaymentClientToken {
  clientToken: string
  mode: 'braintree' | 'mock'
  environment: string
  methods: OnboardingPaymentMethod[]
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
  imageUrl?: string | null
  imageUris?: {
    normal?: string
    small?: string
    large?: string
    png?: string
  } | null
  setCode?: string | null
  collectorNumber?: string | null
}

export interface Order {
  id: number
  reference: string
  status: OrderStatus
  storeName?: string | null
  storeSlug?: string | null
  customerName?: string
  customerEmail?: string
  totalCents: number
  createdAt: string
  lines?: OrderLine[]
}

export type OrderStatus = 'pending' | 'received' | 'fulfilled' | 'paid' | 'shipped' | 'completed' | 'cancelled' | 'refunded'

export interface CustomerNotification {
  id: number
  type: string
  title: string
  body: string
  orderId?: number | null
  orderReference?: string | null
  createdAt: string
  readAt?: string | null
}
