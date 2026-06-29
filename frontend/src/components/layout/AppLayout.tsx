import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function AppLayout() {
  const { user, logout, isSuperAdmin, isStoreOwner } = useAuth()
  const showAdmin = isSuperAdmin || isStoreOwner

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/" className="text-lg font-semibold tracking-tight text-amber-400">
            MTG Store
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <NavLink
              to="/"
              className={({ isActive }) =>
                isActive ? 'text-amber-300' : 'text-slate-300 hover:text-white'
              }
            >
              Stores
            </NavLink>
            {showAdmin && (
              <div className="relative group">
                <span className="cursor-pointer text-slate-300 hover:text-white">Admin</span>
                <div className="absolute right-0 z-20 mt-2 hidden min-w-48 rounded-lg border border-slate-700 bg-slate-900 p-2 shadow-xl group-hover:block">
                  {isSuperAdmin && (
                    <Link
                      to="/platform/admin"
                      className="block rounded px-3 py-2 hover:bg-slate-800"
                    >
                      Platform Admin
                    </Link>
                  )}
                  {user?.ownedStores.map((store) => (
                    <Link
                      key={store.id}
                      to={`/s/${store.slug}/admin`}
                      className="block rounded px-3 py-2 hover:bg-slate-800"
                    >
                      {store.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {user ? (
              <>
                <span className="text-slate-400">{user.displayName}</span>
                <button
                  type="button"
                  onClick={logout}
                  className="rounded-md bg-slate-800 px-3 py-1.5 hover:bg-slate-700"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-slate-300 hover:text-white">
                  Login
                </Link>
                <Link
                  to="/register"
                  className="rounded-md bg-amber-500 px-3 py-1.5 font-medium text-slate-950 hover:bg-amber-400"
                >
                  Register
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
