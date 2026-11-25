import { lazy, Suspense, useEffect } from 'react'
import { CookieConsentPill } from '@/components/CookieConsentPill'
import { Gateway } from '@/site/Gateway'
import { useAppRoute } from '@/lib/route'

const EscrowApp = lazy(() => import('@/app/EscrowApp').then((m) => ({ default: m.EscrowApp })))
const PayCheckout = lazy(() => import('@/app/PayCheckout').then((m) => ({ default: m.PayCheckout })))
const SdkPortal = lazy(() => import('@/site/SdkPortal').then((m) => ({ default: m.SdkPortal })))
const AgentPortal = lazy(() => import('@/site/AgentPortal').then((m) => ({ default: m.AgentPortal })))

/**
 * Hostname + path-fallback routing:
 * - diptos.xyz      (or `/`)       → Apex Institutional Protocol Landing Page
 * - app.diptos.xyz  (or `/app`)    → Dedicated Escrow Link Composer & Active Deals App
 * - app.diptos.xyz/pay/:id         → Escrow Checkout, Grok AI & ElevenLabs Settlement Room
 * - sdk.diptos.xyz  (or `/sdk`)    → Dedicated @diptos/sdk Developer Portal & Live Console
 */
export default function App() {
  const route = useAppRoute()

  useEffect(() => {
    if (route.view === 'pay' && route.escrowId) {
      document.title = `Escrow ${route.escrowId.slice(0, 12)} — app.diptos.xyz`
    } else if (route.view === 'app') {
      document.title = 'Diptos App — Programmable Escrow Links on Arc'
    } else if (route.view === 'sdk') {
      document.title = '@diptos/sdk — Developer Portal & Live Console'
    } else if (route.view === 'agent') {
      document.title = 'Dipto — Proof-Gated AI Agent USDC Budgets | agent.diptos.xyz'
    } else {
      document.title = 'Diptos — Programmable Escrow & AI Settlement on Arc'
    }
    window.scrollTo({ top: 0 })
  }, [route.view, route.escrowId])

  if (route.view === 'pay' && route.escrowId) {
    return (
      <>
        <Suspense fallback={<div className="min-h-screen bg-black" />}>
          <PayCheckout escrowId={route.escrowId} />
        </Suspense>
        <CookieConsentPill />
      </>
    )
  }

  if (route.view === 'app') {
    return (
      <>
        <Suspense fallback={<div className="min-h-screen bg-black" />}>
          <EscrowApp />
        </Suspense>
        <CookieConsentPill />
      </>
    )
  }

  if (route.view === 'agent') {
    return (
      <>
        <Suspense fallback={<div className="min-h-screen bg-black" />}>
          <AgentPortal />
        </Suspense>
        <CookieConsentPill />
      </>
    )
  }

  if (route.view === 'sdk') {
    return (
      <>
        <Suspense fallback={<div className="min-h-screen bg-black" />}>
          <SdkPortal />
        </Suspense>
        <CookieConsentPill />
      </>
    )
  }

  return (
    <>
      <Gateway />
      <CookieConsentPill />
    </>
  )
}
