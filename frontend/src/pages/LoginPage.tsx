import { useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import { useStore } from '../hooks'
import { Button, Card, CardBody, Input } from '../components/ui'
import AuthMarketingAside from '../components/AuthMarketingAside'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const storeSlug = searchParams.get('store') ?? ''
  const { data: store } = useStore(storeSlug)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const from = (location.state as { from?: string } | null)?.from ?? (storeSlug ? `/s/${storeSlug}` : '/')

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate(from)
    } catch {
      setError('Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  const hasError = Boolean(error)

  return (
    <div className="grid min-h-[calc(100vh-10rem)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,32rem)] lg:items-stretch">
      <section className="flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardBody className="p-6">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-600">Account</p>
            <h1 className="mt-1 font-display text-2xl font-bold text-fg">Sign in</h1>
            <p className="mt-2 text-sm text-fg-muted">
              Access your account to save favorites, manage orders, or work as a store owner.
            </p>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={hasError || undefined}
                required
              />
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={hasError || undefined}
                required
              />
              {hasError && (
                <p role="alert" aria-live="polite" className="text-sm font-medium text-danger-700">
                  {error}
                </p>
              )}
              <Button type="submit" loading={loading} className="w-full">
                <LogIn aria-hidden className="size-4" />
                {loading ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <Link to="/register/customer" className="font-bold text-brand-600 hover:underline">
                Create customer account
              </Link>
              <Link to="/register/owner" className="font-bold text-brand-600 hover:underline">
                Owner signup
              </Link>
            </div>
            <p className="mt-2 text-sm text-fg-muted">
              Setting up the platform?{' '}
              <Link to="/register/admin" className="font-bold text-brand-600 hover:underline">
                Admin signup
              </Link>
            </p>
          </CardBody>
        </Card>
      </section>

      <AuthMarketingAside
        storeName={store?.name}
        description="Sign in to browse inventory, keep a want list, and move across store pages with one customer account."
      />
    </div>
  )
}
