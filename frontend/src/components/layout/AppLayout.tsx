import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useMatch } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Avatar, Button, buttonVariants } from '../ui'
import { ChevronDown, LogIn, LogOut, Store, UserCircle, UserPlus } from 'lucide-react'

export default function AppLayout() {
  const { user, logout, isSuperAdmin } = useAuth()
  const ownedStores = user?.ownedStores ?? []
  // The customer profile is per-store, so only surface an "Account" link when the
  // current route is within a store (e.g. /s/:slug, /s/:slug/cards/:id).
  const storeMatch = useMatch('/s/:slug/*')
  const storeSlug = storeMatch?.params.slug
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [storeMenuOpen, setStoreMenuOpen] = useState(false)
  const accountMenuRef = useRef<HTMLDivElement | null>(null)
  const storeMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setAccountMenuOpen(false)
      }
      if (!storeMenuRef.current?.contains(event.target as Node)) {
        setStoreMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? 'text-sm font-semibold text-brand-600'
      : 'text-sm font-medium text-fg-muted hover:text-brand-600'

  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold tracking-tight text-brand-600">
            <span className="grid size-9 place-items-center rounded-btn bg-brand-500 text-sm font-bold text-white">
              MTG
            </span>
            <span>MTG Marketplace</span>
          </Link>

          <nav className="flex items-center gap-3">
            <NavLink to="/" className={navLinkClass} end>
              Stores
            </NavLink>

            {isSuperAdmin && (
              <Link to="/platform/admin" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
                Platform admin
              </Link>
            )}

            {ownedStores.length === 1 && (
              <Link
                to={`/s/${ownedStores[0].slug}/admin`}
                className={buttonVariants({ variant: 'primary', size: 'sm' })}
              >
                <Store aria-hidden className="size-4" />
                Manage store
              </Link>
            )}

            {ownedStores.length > 1 && (
              <div ref={storeMenuRef} className="relative">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setStoreMenuOpen((current) => !current)}
                  aria-haspopup="menu"
                  aria-expanded={storeMenuOpen}
                >
                  <Store aria-hidden className="size-4" />
                  Manage stores
                  <ChevronDown aria-hidden className="size-4" />
                </Button>
                {storeMenuOpen && (
                  <div className="absolute right-0 z-20 mt-2 min-w-56 rounded-card border border-border bg-surface p-2 shadow-card">
                    {ownedStores.map((store) => (
                      <Link
                        key={store.id}
                        to={`/s/${store.slug}/admin`}
                        onClick={() => setStoreMenuOpen(false)}
                        className="block rounded-btn px-3 py-2 text-sm text-fg hover:bg-bg"
                      >
                        {store.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {user ? (
              <>
                {storeSlug && (
                  <Link
                    to={`/s/${storeSlug}/account`}
                    className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                  >
                    <UserCircle aria-hidden className="size-4" />
                    Account
                  </Link>
                )}
                <span className="flex items-center gap-2 text-sm text-fg-muted">
                  <Avatar name={user.displayName} size="sm" />
                  <span className="hidden sm:inline">{user.displayName}</span>
                </span>
                <Button variant="secondary" size="sm" onClick={logout}>
                  <LogOut aria-hidden className="size-4" />
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Link to="/login" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
                  <LogIn aria-hidden className="size-4" />
                  Sign in
                </Link>
                <div ref={accountMenuRef} className="relative">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setAccountMenuOpen((current) => !current)}
                    aria-haspopup="menu"
                    aria-expanded={accountMenuOpen}
                  >
                    <UserPlus aria-hidden className="size-4" />
                    Create account
                    <ChevronDown aria-hidden className="size-4" />
                  </Button>
                  {accountMenuOpen && (
                    <div className="absolute right-0 z-20 mt-2 w-48 rounded-card border border-border bg-surface p-2 shadow-card">
                      <Link
                        to="/register/customer"
                        onClick={() => setAccountMenuOpen(false)}
                        className="block rounded-btn px-3 py-2 text-sm text-fg hover:bg-bg"
                      >
                        Customer
                      </Link>
                      <Link
                        to="/register/owner"
                        onClick={() => setAccountMenuOpen(false)}
                        className="block rounded-btn px-3 py-2 text-sm text-fg hover:bg-bg"
                      >
                        Owner
                      </Link>
                    </div>
                  )}
                </div>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
