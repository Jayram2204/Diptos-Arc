import { useEffect, useState } from 'react'
import { ArrowRight, Bot, RefreshCw, User } from 'lucide-react'
import { Button, Eyebrow, PulseDot, Reveal } from '@/components/ui'
import type { EscrowRecord } from '@/lib/api'
import { fmtAmount, shortHex } from '@/lib/chain'
import { useEscrows, useQuickNodeStream } from '@/lib/hooks'
import { navigate } from '@/lib/route'

const STATUS_BADGE: Record<EscrowRecord['status'], { label: string; progress: number }> = {
  created: { label: 'AWAITING DEPOSIT', progress: 25 },
  funded: { label: 'LIVE ON ARC', progress: 62 },
  verified: { label: 'GROK VERIFIED', progress: 86 },
  settled: { label: 'SETTLED ON ARC', progress: 100 },
  refunded: { label: 'REFUNDED', progress: 100 },
}

function formatRemaining(deadlineUnix: number, nowSec: number) {
  const diff = deadlineUnix - nowSec
  if (diff <= 0) return `LATE +${Math.floor(Math.abs(diff) / 3600)}H`
  const h = Math.floor(diff / 3600)
  const m = Math.floor((diff % 3600) / 60)
  return `${h}H ${m}M LEFT`
}

export function EscrowsGrid() {
  const { escrows, loading, refresh } = useEscrows(4000)
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000))

  useQuickNodeStream(() => {
    void refresh()
  })

  useEffect(() => {
    const t = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <section id="escrows" className="border-t border-paper/10 bg-black py-28 lg:py-36">
      <div className="mx-auto max-w-[1380px] px-6 lg:px-10">
        <div className="flex flex-col justify-between gap-6 border-b border-paper/10 pb-10 sm:flex-row sm:items-end">
          <Reveal>
            <Eyebrow>01 // ON-CHAIN DEAL FEED</Eyebrow>
            <h2 className="rwa-display mt-4 text-[clamp(2rem,3.8vw,3.2rem)] uppercase text-paper">
              LIVE ARC TESTNET ESCROWS.
            </h2>
          </Reveal>
          <Reveal delayMs={100} className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-paper/12 bg-surface px-3.5 py-2 font-mono text-[10.5px] uppercase tracking-[0.12em] text-secondary">
              <PulseDot color="bg-lime" />
              POLLING ARC EVERY 4S
            </span>
            <Button size="sm" variant="secondary" onClick={() => void refresh()}>
              <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} /> SYNC
            </Button>
          </Reveal>
        </div>

        {loading && escrows.length === 0 ? (
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-72 animate-pulse rounded-2xl border border-paper/10 bg-surface" />
            ))}
          </div>
        ) : escrows.length === 0 ? (
          <Reveal className="mt-12 rounded-2xl border border-paper/12 bg-surface p-12 text-center">
            <p className="rwa-hud text-lime">ZERO ON-CHAIN ESCROWS INDEXED YET</p>
            <h3 className="rwa-display mt-3 text-[28px] uppercase text-paper">
              DEPLOY THE FIRST LIVE ESCROW ON ARC.
            </h3>
            <p className="mx-auto mt-3 max-w-lg text-[14.5px] text-secondary">
              Every card in this feed is enumerated directly from{' '}
              <code className="font-mono text-paper">DiptosEscrow.getEscrowsPaginated()</code> on Arc Testnet
              (Chain ID 5042002)—zero static placeholders.
            </p>
            <div className="mt-8">
              <Button
                onClick={() => document.getElementById('composer')?.scrollIntoView({ behavior: 'smooth' })}
              >
                DEPLOY FIRST LIVE ESCROW ON ARC <ArrowRight className="size-4" />
              </Button>
            </div>
          </Reveal>
        ) : (
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {escrows.map((e, idx) => {
              const badge = STATUS_BADGE[e.status]
              return (
                <Reveal key={e.id} delayMs={(idx % 3) * 80}>
                  <article className="flex h-full flex-col justify-between rounded-2xl border border-paper/10 bg-surface p-7 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-lime/50">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-2 rounded-full border border-lime/30 bg-lime/10 px-3 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-lime">
                          <span className="size-1.5 rounded-full bg-lime" />
                          {badge.label}
                        </span>
                        <span className="inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-secondary">
                          {e.mode === 'agent' ? <Bot className="size-3.5 text-lime" /> : <User className="size-3.5" />}
                          {e.mode}
                        </span>
                      </div>

                      <h3 className="rwa-display mt-5 text-[21px] text-paper">{e.title}</h3>
                      <p className="mt-2 line-clamp-2 text-[13.5px] text-secondary">{e.scope}</p>

                      <div className="mt-6 flex items-baseline justify-between border-t border-paper/10 pt-5 font-mono">
                        <div>
                          <span className="block text-[10px] uppercase tracking-[0.12em] text-secondary">
                            LOCKED PRINCIPAL
                          </span>
                          <span className="mt-1 block text-[24px] font-semibold tabular-nums text-paper">
                            {fmtAmount(e.amountUsdc)} <span className="text-[12px] text-lime">USDC</span>
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="block text-[10px] uppercase tracking-[0.12em] text-secondary">
                            SLA TIMER
                          </span>
                          <span className="mt-1 block text-[12px] font-medium tabular-nums text-paper/90">
                            {formatRemaining(e.deadlineUnix, nowSec)}
                          </span>
                        </div>
                      </div>

                      {/* Acid Lime SLA progress bar */}
                      <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-paper/10">
                        <div
                          className="h-full bg-lime transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
                          style={{ width: `${badge.progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-6 flex items-center justify-between gap-3 pt-2">
                      <span className="font-mono text-[11px] text-secondary">{shortHex(e.id, 8, 6)}</span>
                      <Button size="sm" variant="secondary" onClick={() => navigate(`/pay/${e.id}`)}>
                        OPEN CHECKOUT ROOM <ArrowRight className="size-3.5" />
                      </Button>
                    </div>
                  </article>
                </Reveal>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
