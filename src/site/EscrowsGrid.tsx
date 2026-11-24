import { useMemo, useState } from 'react'
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Cpu,
  Folder,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { PulseDot } from '@/components/ui'
import { fmtAmount } from '@/lib/chain'
import { useArcPulse, useEscrows } from '@/lib/hooks'
import { getAppUrl, getPayUrl, getSdkUrl } from '@/lib/route'

export function EscrowsGrid() {
  const { escrows, loading, refresh } = useEscrows(5000)
  const pulse = useArcPulse(6000)
  const [showX402Headers, setShowX402Headers] = useState(false)

  // Dynamically sort newest-first and keep ONLY the 3 most recent escrows for the compact folder row
  const recentThree = useMemo(() => {
    return [...escrows]
      .sort((a, b) => new Date(b.createdAt ?? b.deadline).getTime() - new Date(a.createdAt ?? a.deadline).getTime())
      .slice(0, 3)
  }, [escrows])

  const settledCount = useMemo(
    () => escrows.filter((e) => e.status.toLowerCase() === 'settled').length,
    [escrows],
  )

  return (
    <section id="escrows" className="mx-auto max-w-[1280px] border-t border-paper/12 px-5 py-16 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="rwa-hud text-lime">02 // LIVE PROOF &amp; GUARANTEE RECEIPTS</p>
          <h2 className="rwa-display mt-3 text-[26px] text-paper sm:text-[36px]">
            PLAIN-ENGLISH PROTECTION. LIVE ON-CHAIN.
          </h2>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => void refresh()}
            aria-label="Sync live escrows"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-paper/15 px-3.5 font-mono text-[11px] uppercase tracking-[0.12em] text-[#E5E7EB] transition-colors hover:border-lime hover:text-lime"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            SYNC
          </button>
          <a
            href={getAppUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-lime px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ink transition-colors hover:bg-[#d8ff4d]"
          >
            CREATE LINK <ArrowRight className="size-3.5" />
          </a>
        </div>
      </div>

      {/* Light, Natural & Jargon-Free Outcome Protection + Compact AI Agents Card */}
      <div className="mt-8 grid items-stretch gap-5 lg:grid-cols-12">
        {/* Left Card (7 cols): Plain-English Outcome Protection */}
        <div className="rwa-depth-card flex flex-col justify-between rounded-2xl p-6 lg:col-span-7">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-paper/10 pb-3.5">
              <span className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-white">
                <ShieldCheck className="size-4 text-lime" />
                Outcome Protection
              </span>
              <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase text-emerald">
                <PulseDot color="bg-emerald" />
                {pulse.blockNumber !== undefined ? `Arc #${pulse.blockNumber.toString()}` : 'Arc Live'}
              </span>
            </div>

            <p className="mt-4 text-[15.5px] leading-relaxed text-white">
              Funds release only when agreed proof passes. Late delivery triggers an automatic math-backed rebate.
              Even Diptos cannot touch your funds.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-paper/10 pt-4 font-mono text-[11.5px]">
            <div className="flex flex-wrap items-center gap-5">
              <span className="text-[#E5E7EB]">
                Contract: <strong className="text-emerald">Verified Live</strong>
              </span>
              <span className="text-[#E5E7EB]">
                Settlements: <strong className="text-white">{settledCount}</strong> / {escrows.length}
              </span>
              <span className="text-[#E5E7EB]">
                Fee: <strong className="text-lime">0.5%</strong>
              </span>
            </div>
            <a
              href={getAppUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-lime hover:underline"
            >
              Launch App <ArrowRight className="size-3.5" />
            </a>
          </div>
        </div>

        {/* Right Card (5 cols): Compact For AI Agents (x402) with expandable headers toggle */}
        <div className="rwa-depth-card flex flex-col justify-between rounded-2xl p-6 lg:col-span-5">
          <div>
            <div className="flex items-center justify-between gap-2 border-b border-paper/10 pb-3.5">
              <span className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-white">
                <Cpu className="size-4 text-lime" />
                For AI Agents (x402)
              </span>
              <span className="rounded-full border border-lime/35 bg-lime/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-lime">
                @diptos/agent-guard
              </span>
            </div>

            <p className="mt-4 text-[14px] leading-relaxed text-[#E5E7EB]">
              Set strict per-task USDC spend caps for autonomous agents. Payments unlock only when verified output
              passes—preventing runaway agent spend.
            </p>

            {showX402Headers && (
              <pre className="mt-3 overflow-x-auto rounded-lg border border-paper/10 bg-black/80 p-3 font-mono text-[11px] leading-relaxed text-[#E5E7EB]">
                <code>{`HTTP/1.1 402 Payment Required
X-Diptos-Rail: arc-5042002 / base-8453
X-Agent-Budget-Cap: 50.00 USDC
X-Proof-Gate: deterministic-eip712`}</code>
              </pre>
            )}
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-paper/10 pt-3.5 font-mono text-[11px]">
            <button
              type="button"
              onClick={() => setShowX402Headers((v) => !v)}
              className="inline-flex items-center gap-1 text-[#E5E7EB] transition-colors hover:text-lime"
            >
              {showX402Headers ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              {showX402Headers ? 'Hide x402 Headers' : 'View x402 Headers'}
            </button>
            <a
              href={getSdkUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-lime hover:underline"
            >
              SDK Docs <ArrowRight className="size-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Compact Folder-Style Recent 3 Escrows Row */}
      <div className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#E5E7EB]">
            RECENT ON-CHAIN ESCROWS (LATEST 3)
          </p>
          <a
            href={getAppUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-mono text-[11px] text-lime hover:underline"
          >
            View all ({escrows.length}) in App <ArrowRight className="size-3.5" />
          </a>
        </div>

        {loading && recentThree.length === 0 ? (
          <div className="flex items-center gap-2.5 rounded-xl border border-paper/10 bg-surface px-4 py-4 font-mono text-[11.5px] text-[#E5E7EB]">
            <PulseDot color="bg-lime" />
            <span>Loading latest Arc Testnet escrows…</span>
          </div>
        ) : recentThree.length === 0 ? (
          <div className="flex items-center justify-between rounded-xl border border-paper/10 bg-surface px-5 py-4 text-[13px] text-[#E5E7EB]">
            <span>No escrows indexed yet on Arc Testnet.</span>
            <a href={getAppUrl()} target="_blank" rel="noopener noreferrer" className="font-mono text-[11px] text-lime underline">
              Create first link →
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
            {recentThree.map((escrow) => {
              const isSettled = escrow.status.toLowerCase() === 'settled'
              return (
                <a
                  key={escrow.id}
                  href={getPayUrl(escrow.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between gap-3 rounded-xl border border-paper/12 bg-surface px-4 py-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-lime/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-paper/15 bg-black/60 text-lime">
                      <Folder className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-semibold text-white group-hover:text-lime">
                        {escrow.title || 'Protected Escrow'}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2 font-mono text-[11px] text-[#E5E7EB]/80">
                        <span
                          className={`inline-block size-1.5 rounded-full ${
                            isSettled ? 'bg-emerald' : 'bg-lime'
                          }`}
                        />
                        <span>{fmtAmount(escrow.amountUsdc)} USDC</span>
                        <span>·</span>
                        <span>{escrow.status}</span>
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-[#E5E7EB]/60 transition-transform group-hover:translate-x-0.5 group-hover:text-lime" />
                </a>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
