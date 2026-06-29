import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const from = (location.state as { from?: string } | null)?.from ?? '/'

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

  return (
    <div className="mx-auto max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6">
      <h1 className="text-2xl font-bold">Login</h1>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label className="block space-y-1">
          <span className="text-sm text-slate-400">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
            required
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-slate-400">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
            required
          />
        </label>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-amber-500 py-2 font-medium text-slate-950 hover:bg-amber-400 disabled:opacity-60"
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
      <p className="mt-4 text-sm text-slate-400">
        No account? <Link to="/register" className="text-amber-400 hover:underline">Register</Link>
      </p>
    </div>
  )
}
