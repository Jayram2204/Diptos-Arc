import { useEffect, useState } from 'react'
import { ArrowRight, Bot, CheckCircle2, Clock, Cpu, Lock, RefreshCw, ShieldCheck, User } from 'lucide-react'
import { CopyButton, PulseDot } from '@/components/ui'
import { ESCROW_CONTRACT_ADDRESS } from '@/config/protocol'
import { fmtAmount, shortHex } from '@/lib/chain'
import { useArcPulse, useEscrows } from '@/lib/hooks'
import { getAppUrl, getPayUrl, getSdkUrl } from '@/lib/route'

function formatLiveRemaining(deadlineIso: string, nowMs: number) {
  const diffSec = Math.floor((new Date(deadlineIso).getTime() - nowMs) / 1000)
  const overdue = diffSec < 0
  const abs = Math.abs(diffSec)
  const h = Math.floor(abs / 3600)
  const m = Math.floor((abs % 3600) / 60)
  const s = abs % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return { overdue, text: `${overdue ? '+' : ''}${pad(h)}:${pad(m)}:${pad(s)}` }
}

export function EscrowsGrid() {
  const { escrows, loading, refresh } = useEscrows(4000)
  const pulse = useArcPulse(5000)
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const featured = escrows[0]

  return (
    <section id="escrows" className="mx-auto max-w-[1280px] border-t border-paper/12 px-6 py-20 lg:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="rwa-hud text-lime">02 // LIVE PROOF &amp; GUARANTEE RECEIPTS</p>
          <h2 className="rwa-display mt-3 text-[28px] text-paper sm:text-[38px]">
            VERIFIED OUTCOMES. ZERO CUSTODY.
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-paper/15 px-4 font-mono text-[11px] uppercase tracking-[0.12em] text-secondary transition-colors hover:border-lime hover:text-lime"
          >
            <RefreshCw className="size-3.5" />
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

      {/* AstraOS-Style Live Product-State Preview Cards (Dark + Lime) */}
      <div className="mt-10 grid items-stretch gap-6 lg:grid-cols-12">
        {/* Card A (7 cols): Live Guarantee Receipt + Deterministic Verification Checklist */}
        <div className="rwa-depth-card flex flex-col justify-between rounded-2xl p-7 lg:col-span-7">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-paper/10 pb-4">
              <div className="flex items-center gap-2">
                <Lock className="size-4 text-lime" />
                <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-paper">
                  LIVE GUARANTEE RECEIPT // /PAY/:ID
                </span>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald/35 bg-emerald/10 px-2.5 py-0.5 font-mono text-[10px] uppercase text-emerald">
                <ShieldCheck className="size-3" />
                ZERO PLATFORM CUSTODY
              </span>
            </div>

            <p className="mt-5 text-[15px] leading-relaxed text-paper">
              &ldquo;Lock exact <span className="font-mono font-semibold text-lime">250.00 USDC</span> — protected by
              automatic late-delivery rebate. Even Diptos cannot touch or freeze your funds.&rdquo;
            </p>

            {/* Live Deterministic Verification Checklist pulling real Arc RPC / DiptosEscrow state */}
            <ul className="mt-5 space-y-2.5 border-y border-paper/10 py-4 font-mono text-[12px]">
              <li className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-paper/90">
                  <CheckCircle2 className="size-3.5 text-emerald" />
                  DiptosEscrow.sol bytecode verified on Arc
                </span>
                <span className="text-secondary">{shortHex(ESCROW_CONTRACT_ADDRESS, 8, 4)}</span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-paper/90">
                  <CheckCircle2 className="size-3.5 text-emerald" />
                  Live Arc Testnet head block synced
                </span>
                <span className="text-lime">
                  {pulse.blockNumber !== undefined ? `#${pulse.blockNumber.toString()}` : 'Syncing…'}
                </span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-paper/90">
                  <CheckCircle2 className="size-3.5 text-emerald" />
                  Indexed on-chain escrows (eth_call)
                </span>
                <span className="text-paper">{loading ? 'Reading…' : `${escrows.length} Verified`}</span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-paper/90">
                  <CheckCircle2 className="size-3.5 text-emerald" />
                  Hardware-pinned proof &amp; permissionless timeout refund
                </span>
                <span className="text-emerald">ACTIVE</span>
              </li>
            </ul>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <span className="font-mono text-[11px] text-secondary">
              99.5% instant release on proof · 0.5% flat protocol fee
            </span>
            <a
              href={featured ? getPayUrl(featured.id) : getAppUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-lime hover:underline"
            >
              {featured ? 'INSPECT LIVE /PAY RECEIPT' : 'CREATE GUARANTEE LINK'}
              <ArrowRight className="size-3.5" />
            </a>
          </div>
        </div>

        {/* Card B (5 cols): For AI Agents (x402 + @diptos/agent-guard) */}
        <div className="rwa-depth-card flex flex-col justify-between rounded-2xl p-7 lg:col-span-5">
          <div>
            <div className="flex items-center justify-between gap-2 border-b border-paper/10 pb-4">
              <div className="flex items-center gap-2">
                <Cpu className="size-4 text-lime" />
                <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-paper">
                  FOR AI AGENTS
                </span>
              </div>
              <span className="rounded-full border border-lime/35 bg-lime/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-lime">
                x402 + @diptos/agent-guard
              </span>
            </div>

            <h3 className="mt-5 text-[18px] font-semibold text-paper">
              Conditional Payment Guardrails Over Standard HTTP 402.
            </h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-secondary">
              Give autonomous agents strict per-task USDC spend caps. Funds only unlock when deterministic proof of
              output passes—eliminating runaway API or agent-to-agent settlement risk.
            </p>

            <pre className="mt-4 overflow-x-auto rounded-xl border border-paper/10 bg-black/80 p-3.5 font-mono text-[11px] leading-relaxed text-paper/85">
              <code>{`HTTP/1.1 402 Payment Required
X-Diptos-Rail: arc-5042002 (USDC)
X-Agent-Budget-Cap: 50.00 USDC
X-Proof-Gate: deterministic-eip712`}</code>
            </pre>
          </div>

          <a
            href={getSdkUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center justify-between border-t border-paper/10 pt-4 font-mono text-[11px] uppercase tracking-[0.12em] text-paper transition-colors hover:text-lime"
          >
            <span>READ AGENT GUARDRAIL DOCS</span>
            <ArrowRight className="size-3.5" />
          </a>
        </div>
      </div>

      {/* Live On-Chain Arc Testnet Escrows Feed */}
      <div className="mt-12">
        <div className="flex items-center justify-between border-b border-paper/10 pb-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-secondary">
            LIVE ARC TESTNET ESCROWS ({escrows.length})
          </p>
          <span className="font-mono text-[10.5px] text-secondary">DiptosEscrow.getEscrowsPaginated()</span>
        </div>

        {loading ? (
          <div className="mt-6 flex items-center gap-3 py-4 font-mono text-[12px] uppercase tracking-[0.1em] text-secondary">
            <PulseDot color="bg-lime" />
            <span>Querying DiptosEscrow.getEscrowsPaginated(0, 6) on Arc Testnet (5042002)…</span>
          </div>
        ) : escrows.length === 0 ? (
          <div className="mt-6 flex flex-col items-start justify-between gap-5 py-6 sm:flex-row sm:items-center">
            <p className="max-w-xl text-[14px] text-secondary">
              No funded escrows returned from <span className="font-mono text-paper">DiptosEscrow.sol</span> yet.
              Originate an escrow on <span className="font-mono text-paper">app.diptos.xyz</span> to see it appear live.
            </p>
            <a
              href={getAppUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-lime px-5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ink transition-colors hover:bg-[#d8ff4d]"
            >
              START IN 1 CLICK <ArrowRight className="size-3.5" />
            </a>
          </div>
        ) : (
          <div className="mt-6 grid items-stretch gap-6 md:grid-cols-2 lg:grid-cols-3">
            {escrows.slice(0, 6).map((escrow) => {
              const rem = formatLiveRemaining(escrow.deadline, nowMs)
              return (
                <article
                  key={escrow.id}
                  className="rwa-depth-card flex h-full flex-col justify-between rounded-2xl p-6 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[1px] hover:border-lime/50"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 font-mono text-[10.5px] uppercase tracking-[0.12em]">
                      <span className="inline-flex items-center gap-1.5 text-lime">
                        {escrow.mode === 'agent' ? (
                          <>
                            <Bot className="size-3.5" /> AI AGENT
                          </>
                        ) : (
                          <>
                            <User className="size-3.5" /> CONTRACTOR
                          </>
                        )}
                      </span>
                      <span className="text-emerald">{escrow.status}</span>
                    </div>

                    <h3 className="mt-3 line-clamp-1 text-[17px] font-semibold text-paper">{escrow.title}</h3>

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] text-secondary">
                        {shortHex(escrow.escrowIdBytes32, 10, 6)}
                      </span>
                      <CopyButton value={escrow.escrowIdBytes32} label="Copy escrow ID" />
                    </div>

                    <dl className="mt-5 grid grid-cols-3 gap-3 border-y border-paper/10 py-3.5 font-mono">
                      <div>
                        <dt className="text-[10px] uppercase text-secondary">AMOUNT</dt>
                        <dd className="mt-1 text-[13px] font-semibold text-paper">
                          {fmtAmount(escrow.amountUsdc)} USDC
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] uppercase text-secondary">SLA λ</dt>
                        <dd className="mt-1 text-[13px] font-semibold text-lime">{escrow.tecdLambda.toFixed(2)}</dd>
                      </div>
                      <div>
                        <dt className="flex items-center gap-1 text-[10px] uppercase text-secondary">
                          <Clock className="size-2.5" /> DEADLINE
                        </dt>
                        <dd className={`mt-1 text-[13px] font-semibold ${rem.overdue ? 'text-crimson' : 'text-emerald'}`}>
                          {rem.text}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <a
                    href={getPayUrl(escrow.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.12em] text-paper transition-colors hover:text-lime"
                  >
                    <span>OPEN GUARANTEE RECEIPT</span>
                    <ArrowRight className="size-3.5" />
                  </a>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
