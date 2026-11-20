import { useEffect, useState } from 'react'
import { ArrowRight, ArrowUpRight, Bot, Clock, RefreshCw, User } from 'lucide-react'
import { CopyButton, PulseDot } from '@/components/ui'
import { fmtAmount, shortHex } from '@/lib/chain'
import { useEscrows } from '@/lib/hooks'
import { getAppUrl, getPayUrl } from '@/lib/route'

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
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <section id="escrows" className="mx-auto max-w-[1320px] border-t border-white/[0.08] px-6 py-20 lg:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="rwa-hud text-secondary">01 // ON-CHAIN DEAL FEED</p>
          <h2 className="rwa-display mt-3 text-[28px] text-[#F4F2EC] sm:text-[38px]">
            LIVE ARC TESTNET ESCROWS ({escrows.length}).
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/15 bg-transparent px-4 font-mono text-[11px] uppercase tracking-[0.12em] text-secondary transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[1px] hover:border-white/30 hover:bg-white/[0.06] hover:text-[#F4F2EC]"
          >
            <RefreshCw className="size-3.5" />
            SYNC
          </button>
          <a
            href={getAppUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#F4F2EC] px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-[#090A0D] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[1px] hover:bg-white"
          >
            CREATE LINK <ArrowRight className="size-3.5" />
          </a>
        </div>
      </div>

      {loading ? (
        <div className="mt-10 flex items-center gap-3 rounded-xl border border-white/[0.08] bg-[#111318] px-6 py-6 font-mono text-[12px] uppercase tracking-[0.1em] text-secondary">
          <PulseDot color="bg-emerald" />
          <span>Querying DiptosEscrow.getEscrowsPaginated(0, 6) on Arc Testnet (5042002)…</span>
        </div>
      ) : escrows.length === 0 ? (
        <div className="mt-10 flex flex-col items-start justify-between gap-5 rounded-xl border border-white/[0.08] bg-[#111318] p-8 sm:flex-row sm:items-center">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-secondary">
              ARC TESTNET // 0 ACTIVE ESCROWS INDEXED
            </p>
            <p className="mt-2 max-w-xl text-[14px] text-secondary">
              No funded escrows returned from <span className="font-mono text-[#F4F2EC]">DiptosEscrow.sol</span> yet.
              Originate and fund an escrow on <span className="font-mono text-[#F4F2EC]">app.diptos.xyz</span> to see it
              appear live here.
            </p>
          </div>
          <a
            href={getAppUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-[#F4F2EC] px-5 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-[#090A0D] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[1px] hover:bg-white"
          >
            LAUNCH ESCROW APP <ArrowRight className="size-3.5" />
          </a>
        </div>
      ) : (
        <div className="mt-10 grid items-stretch gap-6 md:grid-cols-2 lg:grid-cols-3">
          {escrows.slice(0, 6).map((escrow) => {
            const rem = formatLiveRemaining(escrow.deadline, nowMs)
            return (
              <article
                key={escrow.id}
                className="flex h-full flex-col justify-between rounded-xl border border-white/[0.08] bg-[#111318] p-6 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[1px] hover:border-white/[0.15] hover:bg-[#161922]"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 font-mono text-[10.5px] uppercase tracking-[0.12em]">
                    <span className="inline-flex items-center gap-1.5 text-secondary">
                      {escrow.mode === 'agent' ? (
                        <>
                          <Bot className="size-3.5 text-[#F4F2EC]" /> AI AGENT
                        </>
                      ) : (
                        <>
                          <User className="size-3.5 text-[#F4F2EC]" /> FREELANCER
                        </>
                      )}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-emerald">
                      <span className="size-1.5 rounded-full bg-emerald" />
                      {escrow.status}
                    </span>
                  </div>

                  <h3 className="mt-3 line-clamp-1 text-[17px] font-semibold text-[#F4F2EC]">{escrow.title}</h3>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-secondary">
                      {shortHex(escrow.escrowIdBytes32, 10, 6)}
                    </span>
                    <CopyButton value={escrow.escrowIdBytes32} label="Copy escrow ID" />
                  </div>

                  <dl className="mt-5 grid grid-cols-3 gap-3 border-y border-white/[0.08] py-3.5 font-mono">
                    <div>
                      <dt className="text-[10px] uppercase text-secondary">AMOUNT</dt>
                      <dd className="mt-1 text-[13px] font-semibold text-[#F4F2EC]">
                        {fmtAmount(escrow.amountUsdc)} USDC
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase text-secondary">TECD λ</dt>
                      <dd className="mt-1 text-[13px] font-semibold text-[#F4F2EC]">{escrow.tecdLambda.toFixed(2)}</dd>
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
                  className="mt-5 inline-flex items-center justify-between rounded-lg border border-white/[0.08] bg-[#161922] px-3.5 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-[#F4F2EC] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-white/25 hover:bg-white/[0.08]"
                >
                  <span>OPEN CHECKOUT</span>
                  <ArrowUpRight className="size-3.5" />
                </a>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
