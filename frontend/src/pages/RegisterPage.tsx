import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register(email, password, displayName)
      navigate('/')
    } catch {
      setError('Registration failed. Email may already be in use.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6">
      <h1 className="text-2xl font-bold">Create account</h1>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label className="block space-y-1">
          <span className="text-sm text-slate-400">Display name</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
            required
          />
        </label>
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
            minLength={8}
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
          {loading ? 'Creating account...' : 'Register'}
        </button>
      </form>
      <p className="mt-4 text-sm text-slate-400">
        Already have an account? <Link to="/login" className="text-amber-400 hover:underline">Login</Link>
      </p>
    </div>
  )
}
