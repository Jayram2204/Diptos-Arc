import { useMemo } from 'react'
import { ArrowRight, Bot, RefreshCw, ShieldCheck, Zap } from 'lucide-react'
import { DiptosCard, DiptosCardRow } from '@/components/DiptosCard'
import { DiptosVerifiedBadge } from '@/components/DiptosVerifiedBadge'
import { fmtAmount } from '@/lib/chain'
import { useArcPulse, useEscrows } from '@/lib/hooks'
import { getAgentUrl, getAppUrl, getPayUrl, getSdkUrl } from '@/lib/route'

export function EscrowsGrid() {
  const { escrows, loading, refresh } = useEscrows(5000)
  const pulse = useArcPulse(6000)

  const recentThree = useMemo(() => {
    const toEpoch = (iso?: string) => {
      const t = iso ? Date.parse(iso) : NaN
      return Number.isFinite(t) ? t : 0
    }
    return [...escrows]
      .sort((a, b) => {
        const diff = toEpoch(b.createdAt) - toEpoch(a.createdAt)
        return diff !== 0 ? diff : b.id.localeCompare(a.id)
      })
      .slice(0, 3)
  }, [escrows])

  const settledCount = useMemo(
    () => escrows.filter((e) => e.status.toLowerCase() === 'settled').length,
    [escrows],
  )

  return (
    <section id="escrows" className="mx-auto max-w-[1280px] px-5 py-24 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="rwa-hud text-lime">02 // LIVE PROOF &amp; GUARANTEE RECEIPTS</p>
          <h2 className="rwa-display mt-3 text-[28px] text-white sm:text-[38px]">
            PLAIN-ENGLISH PROTECTION. LIVE ON-CHAIN.
          </h2>
          <p className="mt-3 max-w-2xl text-[15.5px] leading-relaxed text-[#A3A3A3]">
            Funds release only when agreed proof passes. Late delivery triggers an automatic math-backed rebate. Even
            Diptos cannot touch your funds.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <button
            type="button"
            onClick={() => void refresh()}
            aria-label="Sync live escrows"
            className="inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-white/20 px-4 font-mono text-[12px] font-medium tracking-[0.03em] text-white transition-colors hover:border-lime hover:text-lime"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.5} />
            Sync
          </button>
          <a
            href={getAppUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-lime px-5 font-mono text-[12px] font-semibold tracking-[0.03em] text-ink transition-colors hover:bg-[#d8ff4d]"
          >
            Create Link <ArrowRight className="size-3.5" strokeWidth={1.75} />
          </a>
        </div>
      </div>

      {/* Compact Morpho-Style Linear 3-Card Proof Row (White -> Lime -> Graphite) */}
      <DiptosCardRow className="mt-10">
        <DiptosCard
          variant="white"
          icon={ShieldCheck}
          title="Outcome Protection"
          subtitle={`${settledCount} / ${escrows.length} settled · 0.5% flat fee`}
          href={getAppUrl()}
        />
        <DiptosCard
          variant="lime"
          icon={Bot}
          title="AI Agent x402 Guard"
          subtitle="Per-task USDC spend caps · Proof-gated"
          href={getAgentUrl()}
        />
        <DiptosCard
          variant="graphite"
          icon={Zap}
          title="Live Arc Settlement"
          subtitle={
            pulse.blockNumber !== undefined
              ? `Arc #${pulse.blockNumber.toString()} · <1s finality`
              : 'Arc 5042002 · <1s finality'
          }
          href={getSdkUrl()}
        />
      </DiptosCardRow>

      {/* Ultra-Clean Monochrome Latest 3 On-Chain Escrows */}
      <div className="mt-12">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4">
          <p className="font-mono text-[13px] font-medium uppercase tracking-[0.05em] text-[#A3A3A3]">
            Recent On-Chain Escrows (Latest 3)
          </p>
          <a
            href={getAppUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-mono text-[13px] text-white transition-colors hover:text-lime"
          >
            View all ({escrows.length}) <ArrowRight className="size-3.5" strokeWidth={1.5} />
          </a>
        </div>

        {loading && recentThree.length === 0 ? (
          <div className="rounded-[12px] border border-white/10 bg-[#111111] px-5 py-4 font-mono text-[13px] text-[#A3A3A3]">
            Syncing latest Arc Testnet escrows…
          </div>
        ) : recentThree.length === 0 ? (
          <div className="flex items-center justify-between rounded-[12px] border border-white/10 bg-[#111111] px-5 py-4 text-[14px] text-[#A3A3A3]">
            <span>No escrows indexed yet on Arc Testnet.</span>
            <a href={getAppUrl()} target="_blank" rel="noopener noreferrer" className="font-mono text-[13px] text-lime underline">
              Create first link
            </a>
          </div>
        ) : (
          <div className="divide-y divide-white/10 overflow-hidden rounded-[12px] border border-white/10 bg-[#0E0E0E]">
            {recentThree.map((escrow) => {
              const isSettled = escrow.status.toLowerCase() === 'settled'
              return (
                <a
                  key={escrow.id}
                  href={getPayUrl(escrow.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-[#141414]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {isSettled ? (
                      <DiptosVerifiedBadge size="xs" />
                    ) : (
                      <span className="inline-block size-2 shrink-0 rounded-full bg-white/40" />
                    )}
                    <p className="truncate text-[15px] font-medium text-white group-hover:text-lime">
                      {escrow.title || 'Protected Escrow'}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-5 font-mono text-[13.5px] tabular-nums">
                    <span className="font-semibold text-white">{fmtAmount(escrow.amountUsdc)} USDC</span>
                    <span className="hidden text-[12.5px] text-[#A3A3A3] sm:inline">
                      {isSettled ? 'Settled' : escrow.status}
                    </span>
                    <ArrowRight
                      className="size-4 text-[#A3A3A3] transition-transform group-hover:translate-x-0.5 group-hover:text-lime"
                      strokeWidth={1.5}
                    />
                  </div>
                </a>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
