import { lazy, Suspense, useEffect } from 'react'
import { SmoothScrollProvider } from '@/lib/SmoothScroll'
import { useAppRoute } from '@/lib/route'
import { Gateway } from '@/site/Gateway'

const PayCheckout = lazy(() => import('@/app/PayCheckout').then((m) => ({ default: m.PayCheckout })))

export default function App() {
  const route = useAppRoute()

  useEffect(() => {
    document.title =
      route.view === 'pay' && route.escrowId
        ? `Escrow ${route.escrowId.slice(0, 12)} — Diptos on Arc`
        : 'Diptos — Programmable Escrow & Atomic USDC Settlement on Arc'
    window.scrollTo({ top: 0 })
  }, [route.view, route.escrowId])

  return (
    <SmoothScrollProvider>
      {route.view === 'pay' && route.escrowId ? (
        <Suspense fallback={<div className="min-h-screen bg-black" />}>
          <PayCheckout escrowId={route.escrowId} />
        </Suspense>
      ) : (
        <Gateway />
      )}
    </SmoothScrollProvider>
  )
}
