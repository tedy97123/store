import { useQuery } from '@tanstack/react-query'
import api from '../api/client'
import type { CartItem, CustomerFavorite, CustomerNotification, CustomerWantListEntry, Order, StoreCustomer } from '../api/types'

/**
 * Centralized React Query keys + fetchers for a customer's per-store data.
 * Shared by the storefront (CardDetailsPage) and the account page
 * (CustomerProfilePage) so the cache stays consistent across both.
 */
export const customerKeys = {
  profile: (slug: string) => ['customer-profile', slug] as const,
  favorites: (slug: string) => ['customer-favorites', slug] as const,
  wantList: (slug: string) => ['customer-want-list', slug] as const,
  cart: (slug: string) => ['customer-cart', slug] as const,
  orders: (slug: string) => ['customer-orders', slug] as const,
  notifications: (slug: string) => ['customer-notifications', slug] as const,
}

export function useCustomerProfile(slug: string, enabled = true) {
  return useQuery({
    queryKey: customerKeys.profile(slug),
    queryFn: async () => {
      const { data } = await api.get<StoreCustomer>(`/stores/${slug}/customer`)
      return data
    },
    enabled: Boolean(slug) && enabled,
  })
}

export function useCustomerFavorites(slug: string, enabled = true) {
  return useQuery({
    queryKey: customerKeys.favorites(slug),
    queryFn: async () => {
      const { data } = await api.get<CustomerFavorite[]>(`/stores/${slug}/customer/favorites`)
      return data
    },
    enabled: Boolean(slug) && enabled,
  })
}

export function useCustomerWantList(slug: string, enabled = true) {
  return useQuery({
    queryKey: customerKeys.wantList(slug),
    queryFn: async () => {
      const { data } = await api.get<CustomerWantListEntry[]>(`/stores/${slug}/customer/want-list`)
      return data
    },
    enabled: Boolean(slug) && enabled,
  })
}

export function useCustomerCart(slug: string, enabled = true) {
  return useQuery({
    queryKey: customerKeys.cart(slug),
    queryFn: async () => {
      const { data } = await api.get<CartItem[]>(`/stores/${slug}/customer/cart`)
      return data
    },
    enabled: Boolean(slug) && enabled,
  })
}

export function useCustomerOrders(slug: string, enabled = true) {
  return useQuery({
    queryKey: customerKeys.orders(slug),
    queryFn: async () => {
      const { data } = await api.get<Order[]>(`/stores/${slug}/customer/orders`)
      return data
    },
    enabled: Boolean(slug) && enabled,
  })
}

export function useCustomerNotifications(slug: string, enabled = true) {
  return useQuery({
    queryKey: customerKeys.notifications(slug),
    queryFn: async () => {
      const { data } = await api.get<CustomerNotification[]>(`/stores/${slug}/customer/notifications`)
      return data
    },
    enabled: Boolean(slug) && enabled,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnReconnect: 'always',
    refetchOnWindowFocus: 'always',
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  })
}
