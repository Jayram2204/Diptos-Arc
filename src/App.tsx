import { lazy, Suspense, useEffect } from 'react'
import { Gateway } from '@/site/Gateway'
import { useAppRoute } from '@/lib/route'

const PayCheckout = lazy(() => import('@/app/PayCheckout').then((m) => ({ default: m.PayCheckout })))

/**
 * `/`         → Diptos Institutional Gateway (rwa.inc / launch.rwa.inc architecture)
 * `/pay/:id`  → Consumer & Agent Escrow Checkout Room (Stripe Checkout + Linear view)
 */
export default function App() {
  const route = useAppRoute()

  useEffect(() => {
    document.title =
      route.view === 'pay' && route.escrowId
        ? `Escrow ${route.escrowId.slice(0, 12)} — Diptos on Arc`
        : 'Diptos — Programmable Escrow & AI Settlement on Arc'
    window.scrollTo({ top: 0 })
  }, [route.view, route.escrowId])

  if (route.view === 'pay' && route.escrowId) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
        <PayCheckout escrowId={route.escrowId} />
      </Suspense>
    )
  }

  return <Gateway />
}
