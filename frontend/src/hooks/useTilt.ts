import { useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * useTilt — pointer-driven holographic tilt. Attach `ref` + the returned
 * handlers to a wrapper; it writes CSS variables (--rx/--ry rotation,
 * --mx/--my highlight origin, --op intensity) that the `.tilt-card` /
 * `.tilt-glare` / `.tilt-holo` styles consume. Honors reduced-motion (skips
 * rotation, keeps the highlight).
 */
export function useTilt(maxTilt = 12) {
  const ref = useRef<HTMLDivElement>(null)

  function set(vars: Record<string, string>) {
    const el = ref.current
    if (!el) return
    for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v)
  }

  function onPointerMove(e: ReactPointerEvent<HTMLElement>) {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width
    const py = (e.clientY - rect.top) / rect.height
    const reduce = prefersReducedMotion()
    set({
      '--rx': reduce ? '0deg' : `${(0.5 - py) * maxTilt}deg`,
      '--ry': reduce ? '0deg' : `${(px - 0.5) * maxTilt}deg`,
      '--mx': `${px * 100}%`,
      '--my': `${py * 100}%`,
      '--op': '1',
    })
  }

  function onPointerLeave() {
    set({ '--rx': '0deg', '--ry': '0deg', '--mx': '50%', '--my': '50%', '--op': '0' })
  }

  return { ref, onPointerMove, onPointerLeave }
}

export default useTilt
