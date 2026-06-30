import { useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { useStore } from '../hooks'
import { Button, Card, CardBody, Input } from '../components/ui'
import AuthMarketingAside from '../components/AuthMarketingAside'
import { useAuth } from '../context/AuthContext'

interface RegisterPageProps {
  accountType: 'owner' | 'customer'
}

const COPY = {
  owner: {
    eyebrow: 'Store owner',
    title: 'Create owner account',
    description: 'Use this account to manage store inventory, orders, and reports.',
    button: 'Create owner account',
    loading: 'Creating owner account...',
    alternateText: 'Need a customer account?',
    alternateLabel: 'Customer registration',
    alternateTo: '/register/customer',
    asideDescription:
      'Buy, sell, and build a customer account that follows you across store inventory, favorites, and want lists.',
  },
  customer: {
    eyebrow: 'Customer',
    title: 'Create customer account',
    description: 'Save favorites, build a want list, and sign in quickly on any store page.',
    button: 'Create customer account',
    loading: 'Creating customer account...',
    alternateText: 'Need an owner account?',
    alternateLabel: 'Owner registration',
    alternateTo: '/register/owner',
    asideDescription:
      'Buy, sell, and build a customer account that follows you across store inventory, favorites, and want lists.',
  },
} as const

export default function RegisterPage({ accountType }: RegisterPageProps) {
  const { register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const storeSlug = searchParams.get('store') ?? ''
  const { data: store } = useStore(storeSlug)
  const copy = COPY[accountType]
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const fallback = storeSlug ? `/s/${storeSlug}` : '/'
  const from = (location.state as { from?: string } | null)?.from ?? fallback

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register(email, password, displayName, accountType)
      navigate(from)
    } catch (e) {
      const message =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Registration failed. Email may already be in use.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const hasError = Boolean(error)

  return (
    <div className="grid min-h-[calc(100vh-10rem)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,32rem)] lg:items-stretch">
      <section className="flex items-center">
        <Card className="w-full max-w-md">
          <CardBody className="p-6">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-600">{copy.eyebrow}</p>
            <h1 className="mt-1 font-display text-2xl font-bold text-fg">{copy.title}</h1>
            <p className="mt-2 text-sm text-fg-muted">{copy.description}</p>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <Input
                label="Display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                aria-invalid={hasError || undefined}
                required
              />
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
                minLength={8}
                aria-invalid={hasError || undefined}
                required
              />
              {hasError && (
                <p role="alert" aria-live="polite" className="text-sm font-medium text-danger-700">
                  {error}
                </p>
              )}
              <Button type="submit" loading={loading} className="w-full">
                <UserPlus aria-hidden className="size-4" />
                {loading ? copy.loading : copy.button}
              </Button>
            </form>
            <p className="mt-4 text-sm text-fg-muted">
              Already have an account?{' '}
              <Link to="/login" className="font-bold text-brand-600 hover:underline">
                Sign in
              </Link>
            </p>
            <p className="mt-2 text-sm text-fg-muted">
              {copy.alternateText}{' '}
              <Link to={copy.alternateTo} className="font-bold text-brand-600 hover:underline">
                {copy.alternateLabel}
              </Link>
            </p>
          </CardBody>
        </Card>
      </section>

      <AuthMarketingAside storeName={store?.name} description={copy.asideDescription} />
    </div>
  )
}
