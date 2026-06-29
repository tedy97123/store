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
