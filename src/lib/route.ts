import { useEffect, useState } from 'react'

export interface AppRoute {
  view: 'gateway' | 'pay'
  escrowId: string | null
}

function parseRoute(): AppRoute {
  if (typeof window === 'undefined') return { view: 'gateway', escrowId: null }
  const pathname = window.location.pathname
  const hash = window.location.hash

  const pathMatch = pathname.match(/^\/pay\/([^/?#]+)/)
  if (pathMatch) {
    return { view: 'pay', escrowId: decodeURIComponent(pathMatch[1]) }
  }

  const hashMatch = hash.match(/^#\/pay\/([^/?#]+)/)
  if (hashMatch) {
    return { view: 'pay', escrowId: decodeURIComponent(hashMatch[1]) }
  }

  return { view: 'gateway', escrowId: null }
}

const ROUTE_EVENT = 'diptos:navigate'

export function navigate(to: string) {
  if (typeof window === 'undefined') return
  if (to.startsWith('#')) {
    window.location.hash = to
  } else {
    window.history.pushState({}, '', to)
  }
  window.dispatchEvent(new Event(ROUTE_EVENT))
}

export function useAppRoute(): AppRoute {
  const [route, setRoute] = useState<AppRoute>(parseRoute)

  useEffect(() => {
    const onChange = () => setRoute(parseRoute())
    window.addEventListener('popstate', onChange)
    window.addEventListener('hashchange', onChange)
    window.addEventListener(ROUTE_EVENT, onChange)
    return () => {
      window.removeEventListener('popstate', onChange)
      window.removeEventListener('hashchange', onChange)
      window.removeEventListener(ROUTE_EVENT, onChange)
    }
  }, [])

  return route
}
