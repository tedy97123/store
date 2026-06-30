import { useEffect, useState } from 'react'

/**
 * useDebouncedValue — returns `value` after it has stopped changing for `delayMs`.
 * Useful for search-as-you-type inputs to avoid firing a request on every keystroke.
 */
export function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(handle)
  }, [value, delayMs])

  return debounced
}

export default useDebouncedValue
