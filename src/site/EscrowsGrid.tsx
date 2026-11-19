import { useState } from 'react'
import { ArrowRight, Bot, Plus, RefreshCw, User } from 'lucide-react'
import { Button, CopyButton, Eyebrow } from '@/components/ui'
import { createEscrow, type EscrowRecord } from '@/lib/api'
import { fmtAmount, shortHex } from '@/lib/chain'
import { useEscrows } from '@/lib/hooks'
import { navigate } from '@/lib/route'

const STATUS_BADGE: Record<EscrowRecord['status'], { label: string; cls: string; progress: number }> = {
  created: {
    label: 'AWAITING DEPOSIT',
    cls: 'border-gold/30 bg-gold/10 text-gold',
    progress: 25,
  },
  funded: {
    label: 'FUNDED ON ARC',
    cls: 'border-emerald/30 bg-emerald/10 text-emerald',
    progress: 60,
  },
  verified: {
    label: 'GROK VERIFIED',
    cls: 'border-emerald/40 bg-emerald/15 text-emerald',
    progress: 85,
  },
  settled: {
    label: 'SETTLED',
    cls: 'border-emerald/40 bg-emerald/15 text-emerald',
    progress: 100,
  },
  refunded: {
    label: 'REFUNDED',
    cls: 'border-crimson/35 bg-crimson/10 text-crimson',
    progress: 100,
  },
}

export function EscrowsGrid() {
  const { escrows, loading, refresh } = useEscrows(15_000)
  const [launching, setLaunching] = useState(false)

  const launchDemoEscrow = async () => {
    setLaunching(true)
    try {
      await createEscrow({
        title: 'Arc Testnet Smart Contract Security Review',
        scope: 'Deliver Foundry invariant test suite covering TECD decay bounds and ECDSA replay protection.',
        amountUsdc: 2500,
        deadlineHours: 24,
        mode: 'agent',
        tecdLambda: 0.24,
      })
      await refresh()
    } finally {
      setLaunching(false)
    }
  }

  return (
    <section id="active-escrows" className="mx-auto max-w-[1280px] px-4 py-20 sm:px-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Eyebrow>Live Active Escrows</Eyebrow>
          <h2 className="mt-3 text-[28px] font-semibold text-primary sm:text-[34px]">
            Programmable deals settled on Arc.
          </h2>
        </div>
        <div className="flex items-center gap-2.5">
          <Button variant="ghost" size="sm" onClick={() => void refresh()}>
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
          <Button variant="secondary" size="sm" loading={launching} onClick={launchDemoEscrow}>
            <Plus className="size-3.5 text-gold" />
            Launch Demo Escrow
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[248px] animate-pulse rounded-[10px] border border-white/[0.08] bg-surface" />
          ))}
        </div>
      ) : escrows.length === 0 ? (
        <div className="mt-8 flex flex-col items-start justify-between gap-6 rounded-[10px] border border-white/[0.08] bg-surface p-8 sm:flex-row sm:items-center">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-gold">Ready for Origination</p>
            <h3 className="mt-2 text-lg font-semibold text-primary">No live escrows originated yet.</h3>
            <p className="mt-1 max-w-xl text-[13px] text-secondary">
              Create your first programmable escrow link above or launch a live demo escrow to inspect the checkout
              room, Grok AI verifier, and Arc Testnet settlement flow.
            </p>
          </div>
          <Button variant="primary" loading={launching} onClick={launchDemoEscrow} className="shrink-0 font-bold">
            <Plus className="size-4" />
            Launch Demo Escrow
          </Button>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {escrows.slice(0, 6).map((escrow) => {
            const badge = STATUS_BADGE[escrow.status] ?? STATUS_BADGE.created
            return (
              <article
                key={escrow.id}
                className="flex flex-col justify-between rounded-[10px] border border-white/[0.08] bg-surface p-5 transition-colors hover:border-white/[0.18]"
              >
                <div>
                  {/* Top row: Mode badge + Status pill */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-elevated px-2 py-0.5 font-mono text-[10px] font-medium text-primary">
                      {escrow.mode === 'agent' ? (
                        <>
                          <Bot className="size-3 text-emerald" /> AI AGENT API
                        </>
                      ) : (
                        <>
                          <User className="size-3 text-gold" /> HUMAN ESCROW
                        </>
                      )}
                    </span>
                    <span className={`rounded-md border px-2 py-0.5 font-mono text-[10px] font-medium ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>

                  {/* Title + keccak256 ID */}
                  <h3 className="mt-4 line-clamp-1 text-[16px] font-semibold text-primary">{escrow.title}</h3>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-secondary">
                      ID: <span className="text-primary/85">{shortHex(escrow.escrowIdBytes32, 10, 6)}</span>
                    </span>
                    <CopyButton value={escrow.escrowIdBytes32} label="Copy escrow keccak256 ID" />
                  </div>

                  {/* Progress / SLA bar */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between font-mono text-[10px] text-secondary">
                      <span>SETTLEMENT PROGRESS</span>
                      <span className="text-primary">{badge.progress}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-elevated">
                      <div
                        className={`h-full transition-[width] duration-300 ${
                          escrow.status === 'settled' || escrow.status === 'verified' ? 'bg-emerald' : 'bg-gold'
                        }`}
                        style={{ width: `${badge.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Tabular Metrics */}
                  <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-white/[0.08] pt-3.5 font-mono">
                    <div>
                      <dt className="text-[10px] text-secondary">AMOUNT</dt>
                      <dd className="mt-0.5 text-[12px] font-medium text-primary">
                        {fmtAmount(escrow.amountUsdc)} USDC
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] text-secondary">TECD λ</dt>
                      <dd className="mt-0.5 text-[12px] font-medium text-gold">{escrow.tecdLambda.toFixed(2)}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] text-secondary">DEADLINE</dt>
                      <dd className="mt-0.5 text-[12px] font-medium text-primary">{escrow.deadlineHours}h</dd>
                    </div>
                  </dl>
                </div>

                {/* Footer action */}
                <button
                  type="button"
                  onClick={() => navigate(`/pay/${escrow.id}`)}
                  className="mt-5 flex h-9 w-full items-center justify-between rounded-lg border border-white/[0.08] bg-elevated px-3.5 text-[12px] font-medium text-primary transition-colors hover:border-gold/50 hover:text-gold"
                >
                  <span>Open Checkout &amp; Verify</span>
                  <ArrowRight className="size-3.5" />
                </button>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
