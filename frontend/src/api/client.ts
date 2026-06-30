import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor: on 401, clear the stored token and bounce to /login.
// Uses window.location (no router dependency) so it works from anywhere.
api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (httpStatus(error) === 401) {
      localStorage.removeItem('token')
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.assign('/login')
      }
    }
    return Promise.reject(error)
  },
)

/** Safely read the HTTP status code off an axios/fetch-style error. */
export function httpStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: { status?: number } }).response
    return response?.status
  }
  return undefined
}

export default api

export function unwrapCollection<T>(data: T[] | { member?: T[] }): T[] {
  if (Array.isArray(data)) {
    return data
  }
  if (data && typeof data === 'object' && Array.isArray(data.member)) {
    return data.member
  }
  return []
}

export function cardImage(card: { imageUrl?: string; imageUris?: { normal?: string; small?: string } }): string | undefined {
  return card.imageUrl ?? card.imageUris?.normal ?? card.imageUris?.small
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export function parseScryfallPrice(value?: string | null): number | null {
  if (!value) return null
  const parsed = Number(value)
  if (Number.isNaN(parsed)) return null
  return Math.round(parsed * 100)
}

export function scryfallPriceCents(
  card: { prices?: { usd?: string | null; usd_foil?: string | null; usd_etched?: string | null } },
  finish: 'nonfoil' | 'foil' | 'etched' = 'nonfoil',
): number | null {
  if (finish === 'foil') {
    return parseScryfallPrice(card.prices?.usd_foil) ?? parseScryfallPrice(card.prices?.usd)
  }
  if (finish === 'etched') {
    return (
      parseScryfallPrice(card.prices?.usd_etched) ??
      parseScryfallPrice(card.prices?.usd_foil) ??
      parseScryfallPrice(card.prices?.usd)
    )
  }
  return parseScryfallPrice(card.prices?.usd)
}

export function formatScryfallPrice(
  card: { prices?: { usd?: string | null; usd_foil?: string | null; usd_etched?: string | null } },
  finish: 'nonfoil' | 'foil' | 'etched' = 'nonfoil',
): string {
  return formatMarketPrice(card, finish)
}

export function formatMarketPrice(
  card: { prices?: { usd?: string | null; usd_foil?: string | null; usd_etched?: string | null } },
  finish: 'nonfoil' | 'foil' | 'etched' = 'nonfoil',
): string {
  const cents = scryfallPriceCents(card, finish)
  return cents === null ? '-' : formatPrice(cents)
}
