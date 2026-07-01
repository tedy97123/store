/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import api from '../api/client'
import type { UserProfile } from '../api/types'

interface AuthContextValue {
  user: UserProfile | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (
    email: string,
    password: string,
    displayName: string,
    accountType: 'owner' | 'customer' | 'admin',
  ) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
  isSuperAdmin: boolean
  isStoreOwner: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    if (!localStorage.getItem('token')) {
      setUser(null)
      setLoading(false)
      return
    }

    try {
      const { data } = await api.get<UserProfile>('/me')
      setUser(data)
    } catch {
      localStorage.removeItem('token')
      setToken(null)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshUser()
  }, [refreshUser])

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<{ token: string }>('/login', { email, password })
    localStorage.setItem('token', data.token)
    setToken(data.token)
    await refreshUser()
  }, [refreshUser])

  const register = useCallback(async (
    email: string,
    password: string,
    displayName: string,
    accountType: 'owner' | 'customer' | 'admin',
  ) => {
    await api.post('/register', { email, password, displayName, accountType })
    await login(email, password)
  }, [login])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      login,
      register,
      logout,
      refreshUser,
      isSuperAdmin: user?.roles.includes('ROLE_SUPER_ADMIN') ?? false,
      isStoreOwner:
        (user?.roles.includes('ROLE_STORE_OWNER') ?? false) ||
        (user?.ownedStores?.length ?? 0) > 0,
    }),
    [user, token, loading, login, register, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
