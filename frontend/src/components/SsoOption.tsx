/* eslint-disable react-refresh/only-export-components */
import { useQuery } from '@tanstack/react-query'
import { KeyRound } from 'lucide-react'
import api from '../api/client'
import type { SsoStatus } from '../api/types'
import { Button } from './ui'

/** Whether SSO is configured server-side, and under what provider name. */
export function useSsoStatus(): SsoStatus | undefined {
  const { data } = useQuery({
    queryKey: ['sso-status'],
    queryFn: async () => {
      const { data } = await api.get<SsoStatus>('/auth/sso/status')
      return data
    },
    staleTime: 5 * 60_000,
  })
  return data
}

/**
 * "Continue with <provider>" button plus an "or" divider, for the sign-in and
 * sign-up pages. `next` is where the SSO callback should land the user after
 * the provider round-trip; it rides in sessionStorage (same browser, same tab).
 */
export function SsoOption({ sso, next = '/' }: { sso: SsoStatus | undefined; next?: string }) {
  const providerName = sso?.providerName ?? 'Google'
  const isGoogle = providerName.toLowerCase().includes('google')

  const start = () => {
    sessionStorage.setItem('sso-next', next)
    window.location.assign('/api/auth/sso/start')
  }

  return (
    <div className="mt-8 space-y-4">
      <Button type="button" variant="secondary" size="lg" className="w-full" onClick={start}>
        {isGoogle ? <GoogleLogo /> : <KeyRound aria-hidden className="size-4" />}
        Continue with {providerName}
      </Button>
      <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-fg-muted">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  )
}

function GoogleLogo() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5" focusable="false">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.3 9.14 5.38 12 5.38z"
      />
    </svg>
  )
}
