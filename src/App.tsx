import { lazy, Suspense, useEffect } from 'react'
import { Gateway } from '@/site/Gateway'
import { useAppRoute } from '@/lib/route'

const Terminal = lazy(() => import('@/app/Terminal').then((m) => ({ default: m.Terminal })))

/**
 * `/`         → Diptos Institutional Gateway (rwa.inc / launch.rwa.inc architecture)
 * `/pay/:id`  → Consumer & Agent Escrow Checkout Room (Stripe Checkout + Linear view)
 */
export default function App() {
  const route = useAppRoute()

  useEffect(() => {
    document.title =
      route.view === 'pay' && route.escrowId
        ? `Escrow ${route.escrowId} — Diptos on Arc`
        : 'Diptos — Programmable Escrow Links on Arc'
    window.scrollTo({ top: 0 })
  }, [route.view, route.escrowId])

  if (route.view === 'pay' && route.escrowId) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
        <Terminal escrowId={route.escrowId} />
      </Suspense>
    )
  }

  return <Gateway />
}
