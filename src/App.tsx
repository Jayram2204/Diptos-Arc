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
    let title = 'Diptos — Condition-Verified USDC Settlement on Arc'
    let description =
      'Lock USDC against objective proof—merged code, passing tests, or valid AI agent output. 0.5% flat fee, <1s Arc finality, automatic late-delivery rebate.'

    if (route.view === 'pay' && route.escrowId) {
      title = `Escrow ${route.escrowId.slice(0, 12)} — app.diptos.xyz`
      description = 'Inspect live non-custodial USDC settlement terms, objective proof status, and TECD late-delivery math.'
    } else if (route.view === 'app') {
      title = 'Diptos App — Condition-Verified USDC Escrow Engine | app.diptos.xyz'
      description = 'Create and manage non-custodial USDC settlement links on Arc Testnet (5042002) with automatic TECD late-delivery rebates.'
    } else if (route.view === 'sdk') {
      title = 'Diptos Docs — @diptos/sdk & Multi-Chain Settlement Reference | sdk.diptos.xyz'
      description = 'Developer documentation for @diptos/sdk, @diptos/agent-guard, Arc Native USDC (18-dec), Base ERC-20 USDC (6-dec) + x402, and live TECD eth_call.'
    } else if (route.view === 'agent') {
      title = 'Diptos / Dipto — Proof-Gated AI Agent USDC Budgets | agent.diptos.xyz'
      description = 'Give autonomous AI agents non-custodial USDC spend caps that only unlock on verified output over HTTP 402 (x402).'
    }

    document.title = title
    const setMeta = (selector: string, content: string) => {
      const el = document.querySelector(selector)
      if (el) el.setAttribute('content', content)
    }
    setMeta('meta[name="description"]', description)
    setMeta('meta[property="og:title"]', title)
    setMeta('meta[property="og:description"]', description)
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
