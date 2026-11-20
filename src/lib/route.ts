import { useEffect, useState } from 'react'

export type RouteView = 'gateway' | 'app' | 'pay' | 'sdk'

export interface AppRoute {
  view: RouteView
  escrowId: string | null
}

function getHost(): string {
  return typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : ''
}

export function isProdDiptosDomain(): boolean {
  const host = getHost()
  return host === 'diptos.xyz' || host.endsWith('.diptos.xyz')
}

export function isAppSubdomain(): boolean {
  const host = getHost()
  return host === 'app.diptos.xyz' || host === 'launch.diptos.xyz'
}

export function isSdkSubdomain(): boolean {
  return getHost() === 'sdk.diptos.xyz'
}

export function getApexUrl(): string {
  return isProdDiptosDomain() ? 'https://diptos.xyz' : '/'
}

export function getAppUrl(subPath = ''): string {
  const clean = subPath.startsWith('/') ? subPath : subPath ? `/${subPath}` : ''
  if (isProdDiptosDomain()) {
    return `https://app.diptos.xyz${clean}`
  }
  return `/app${clean}`
}

export function getSdkUrl(): string {
  return isProdDiptosDomain() ? 'https://sdk.diptos.xyz' : '/sdk'
}

export function getPayUrl(escrowPathOrId: string): string {
  const normalized = escrowPathOrId.startsWith('/pay/')
    ? escrowPathOrId
    : `/pay/${escrowPathOrId.replace(/^\/+/, '')}`
  return isProdDiptosDomain() ? `https://app.diptos.xyz${normalized}` : normalized
}

function parseRoute(): AppRoute {
  if (typeof window === 'undefined') return { view: 'gateway', escrowId: null }
  const pathname = window.location.pathname
  const hash = window.location.hash

  // Pay checkout match works on app.diptos.xyz/pay/:id, diptos.xyz/pay/:id, and localhost/pay/:id
  const pathPay = pathname.match(/^(?:\/app)?\/pay\/([^/?#]+)/)
  if (pathPay) {
    return { view: 'pay', escrowId: decodeURIComponent(pathPay[1]) }
  }
  const hashPay = hash.match(/^#(?:\/app)?\/pay\/([^/?#]+)/)
  if (hashPay) {
    return { view: 'pay', escrowId: decodeURIComponent(hashPay[1]) }
  }

  // Hostname-based subdomain routing in production
  if (isSdkSubdomain()) {
    return { view: 'sdk', escrowId: null }
  }
  if (isAppSubdomain()) {
    return { view: 'app', escrowId: null }
  }

  // Path-based fallbacks for localhost & *.vercel.app preview deployments
  if (pathname === '/sdk' || pathname.startsWith('/sdk/') || hash.startsWith('#/sdk')) {
    return { view: 'sdk', escrowId: null }
  }
  if (pathname === '/app' || pathname.startsWith('/app/') || hash.startsWith('#/app')) {
    return { view: 'app', escrowId: null }
  }

  return { view: 'gateway', escrowId: null }
}

const ROUTE_EVENT = 'diptos:navigate'

export function navigate(to: string) {
  if (typeof window === 'undefined') return
  if (/^https?:\/\//i.test(to)) {
    const targetUrl = new URL(to)
    if (targetUrl.origin !== window.location.origin) {
      window.location.assign(to)
      return
    }
    window.history.pushState({}, '', `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`)
  } else if (to.startsWith('#')) {
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
