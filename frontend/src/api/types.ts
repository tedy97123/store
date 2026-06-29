export interface Store {
  id: number
  name: string
  slug: string
  isActive?: boolean
  owner?: {
    id: number
    email: string
    displayName: string
  }
  createdAt?: string
}

export interface CardSummary {
  id: string
  oracleId?: string
  name: string
  setCode?: string
  collectorNumber?: string
  rarity?: string
  manaCost?: string
  typeLine?: string
  imageUrl?: string
  imageUris?: {
    normal?: string
    small?: string
  }
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
