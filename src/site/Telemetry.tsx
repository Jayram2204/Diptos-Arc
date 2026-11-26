import { useEffect, useState } from 'react'
import { ArrowUpRight, Radio } from 'lucide-react'
import { formatUnits } from 'viem'
import { Eyebrow, PulseDot, Reveal } from '@/components/ui'
import { ARC_RPC_URL } from '@/config/protocol'
import { explorerUrl, shortHex } from '@/lib/chain'
import { useArcPulse, useOracleStatus, useProtocolEvents } from '@/lib/hooks'

export function Telemetry() {
  const pulse = useArcPulse(4000)
  const { data: oracle } = useOracleStatus(15_000)
  const { events, connected } = useProtocolEvents(5000)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const finalityAge = pulse.timestamp ? Math.max(0, Math.round(now / 1000 - Number(pulse.timestamp))) : null
  const baseGasUsdc =
    pulse.baseFee !== undefined ? `${Number(formatUnits(pulse.baseFee, 18)).toFixed(8)} USDC` : 'Syncing…'

  return (
    <section id="telemetry" className="border-t border-paper/10 bg-black py-28 lg:py-36">
      <div className="mx-auto max-w-[1380px] px-6 lg:px-10">
        <div className="flex flex-col justify-between gap-6 border-b border-paper/10 pb-10 lg:flex-row lg:items-end">
          <Reveal>
            <Eyebrow>LIVE ARC JSON-RPC &amp; ON-CHAIN SETTLEMENT FEED</Eyebrow>
            <h2 className="rwa-display mt-4 text-[clamp(2rem,3.8vw,3.2rem)] uppercase text-paper">
              REAL-TIME NETWORK TELEMETRY.
            </h2>
          </Reveal>
          <Reveal delayMs={80}>
            <span className="inline-flex items-center gap-2.5 rounded-full border border-paper/15 bg-surface px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-paper/85">
              <PulseDot color={pulse.error ? 'bg-white/10' : 'bg-lime'} />
              {ARC_RPC_URL}
            </span>
          </Reveal>
        </div>

        {/* 4-Column Editorial Telemetry Bar */}
        <Reveal delayMs={100}>
          <dl className="mt-10 grid grid-cols-1 divide-y divide-paper/10 rounded-2xl border border-paper/10 bg-surface sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
            <div className="p-7">
              <dt className="rwa-hud text-secondary">LATEST BLOCK</dt>
              <dd className="mt-3 font-mono text-[26px] font-semibold tabular-nums text-paper">
                {pulse.blockNumber !== undefined ? `#${pulse.blockNumber.toString()}` : 'Syncing…'}
              </dd>
              <dd className="mt-1 font-mono text-[10.5px] uppercase text-secondary">ARC TESTNET 5042002</dd>
            </div>
            <div className="p-7">
              <dt className="rwa-hud text-secondary">BLOCK AGE / FINALITY</dt>
              <dd className="mt-3 font-mono text-[26px] font-semibold tabular-nums text-lime">
                {finalityAge !== null ? `${finalityAge}s` : 'Syncing…'}
              </dd>
              <dd className="mt-1 font-mono text-[10.5px] uppercase text-secondary">SUB-SECOND FINALITY</dd>
            </div>
            <div className="p-7">
              <dt className="rwa-hud text-secondary">NATIVE USDC GAS</dt>
              <dd className="mt-3 font-mono text-[20px] font-semibold tabular-nums text-paper">{baseGasUsdc}</dd>
              <dd className="mt-1 font-mono text-[10.5px] uppercase text-secondary">ETH_GASPRICE LIVE</dd>
            </div>
            <div className="p-7">
              <dt className="rwa-hud text-secondary">RPC ROUND-TRIP</dt>
              <dd className="mt-3 font-mono text-[26px] font-semibold tabular-nums text-lime">
                {pulse.latency !== undefined ? `${pulse.latency}ms` : 'Syncing…'}
              </dd>
              <dd className="mt-1 font-mono text-[10.5px] uppercase text-secondary">
                {oracle?.oracleSigner ? `VERIFIER ${shortHex(oracle.oracleSigner)}` : 'PROOF VERIFIER READY'}
              </dd>
            </div>
          </dl>
        </Reveal>

        {/* Backfilled Arc Testnet Event Ticker */}
        <Reveal delayMs={160} className="mt-8 rounded-2xl border border-paper/10 bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-paper/10 px-7 py-4">
            <div className="flex items-center gap-2.5">
              <Radio className={`size-4 ${connected ? 'text-lime' : 'text-secondary'}`} />
              <span className="rwa-hud text-paper">ON-CHAIN SETTLEMENT TICKER // ARC 5042002</span>
            </div>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-secondary">
              GET /API/EVENTS · BACKFILLED + LIVE LOGS
            </span>
          </div>

          {events.length === 0 ? (
            <p className="px-7 py-8 font-mono text-[12px] text-secondary">
              Syncing historical <code className="text-paper">EscrowCreated</code>,{' '}
              <code className="text-paper">MilestoneSettled</code>, and{' '}
              <code className="text-paper">TECDPenaltyApplied</code> logs from Arc Testnet (5042002)…
            </p>
          ) : (
            <ul className="divide-y divide-paper/10">
              {events.slice(0, 6).map((evt) => (
                <li
                  key={evt.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-7 py-4 font-mono text-[12px]"
                >
                  <div className="flex items-center gap-3">
                    <span className="rounded-full border border-lime/35 bg-lime/10 px-3 py-0.5 text-[10px] uppercase tracking-[0.12em] text-lime">
                      {evt.eventName}
                    </span>
                    <span className="text-paper/90">{evt.summary}</span>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] text-secondary">
                    <span>BLOCK #{evt.blockNumber}</span>
                    {evt.txHash && (
                      <a
                        href={explorerUrl('tx', evt.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-paper hover:text-lime"
                      >
                        {shortHex(evt.txHash)} <ArrowUpRight className="size-3.5" />
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Reveal>
      </div>
    </section>
  )
}
