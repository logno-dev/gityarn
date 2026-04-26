import { useEffect } from 'react'

export function PwaRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return
    }

    if (!import.meta.env.PROD) {
      return
    }

    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Keep fail-silent to avoid noisy UX on unsupported environments.
    })
  }, [])

  return null
}
