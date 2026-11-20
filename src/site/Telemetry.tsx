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
  const { events, connected } = useProtocolEvents(4000)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const finalityAge = pulse.timestamp ? Math.max(0, Math.round(now / 1000 - Number(pulse.timestamp))) : null
  const baseGasUsdc =
    pulse.baseFee !== undefined ? `${Number(formatUnits(pulse.baseFee, 18)).toFixed(8)} USDC` : 'Syncing…'

  return (
    <section id="telemetry" className="border-t border-white/[0.08] bg-[#090A0D] py-20 lg:py-24">
      <div className="mx-auto max-w-[1320px] px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-6 border-b border-white/[0.08] pb-8 lg:flex-row lg:items-end">
          <Reveal>
            <Eyebrow>LIVE ARC JSON-RPC &amp; QUICKNODE STREAMS</Eyebrow>
            <h2 className="rwa-display mt-3 text-[28px] uppercase text-[#F4F2EC] sm:text-[38px]">
              REAL-TIME NETWORK TELEMETRY.
            </h2>
          </Reveal>
          <Reveal delayMs={80}>
            <span className="inline-flex items-center gap-2.5 rounded-full border border-white/[0.08] bg-[#111318] px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-[#F4F2EC]/85">
              <PulseDot color={pulse.error ? 'bg-crimson' : 'bg-emerald'} />
              {ARC_RPC_URL}
            </span>
          </Reveal>
        </div>

        {/* Symmetrical Equal-Height 4-Column Telemetry Grid */}
        <Reveal delayMs={100}>
          <dl className="mt-10 grid grid-cols-1 items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#111318] p-6">
              <dt className="rwa-hud text-secondary">LATEST BLOCK</dt>
              <div>
                <dd className="mt-3 font-mono text-[24px] font-semibold tabular-nums text-[#F4F2EC]">
                  {pulse.blockNumber !== undefined ? `#${pulse.blockNumber.toString()}` : 'Syncing…'}
                </dd>
                <dd className="mt-1 font-mono text-[10.5px] uppercase text-secondary">ARC TESTNET 5042002</dd>
              </div>
            </div>
            <div className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#111318] p-6">
              <dt className="rwa-hud text-secondary">BLOCK AGE / FINALITY</dt>
              <div>
                <dd className="mt-3 font-mono text-[24px] font-semibold tabular-nums text-emerald">
                  {finalityAge !== null ? `${finalityAge}s` : 'Syncing…'}
                </dd>
                <dd className="mt-1 font-mono text-[10.5px] uppercase text-secondary">SUB-SECOND FINALITY</dd>
              </div>
            </div>
            <div className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#111318] p-6">
              <dt className="rwa-hud text-secondary">NATIVE USDC GAS</dt>
              <div>
                <dd className="mt-3 font-mono text-[19px] font-semibold tabular-nums text-[#F4F2EC]">{baseGasUsdc}</dd>
                <dd className="mt-1 font-mono text-[10.5px] uppercase text-secondary">ETH_GASPRICE LIVE</dd>
              </div>
            </div>
            <div className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#111318] p-6">
              <dt className="rwa-hud text-secondary">RPC ROUND-TRIP</dt>
              <div>
                <dd className="mt-3 font-mono text-[24px] font-semibold tabular-nums text-[#F4F2EC]">
                  {pulse.latency !== undefined ? `${pulse.latency}ms` : 'Syncing…'}
                </dd>
                <dd className="mt-1 font-mono text-[10.5px] uppercase text-secondary">
                  {oracle?.oracleSigner ? `ORACLE ${shortHex(oracle.oracleSigner)}` : 'EIP-712 ORACLE READY'}
                </dd>
              </div>
            </div>
          </dl>
        </Reveal>

        {/* QuickNode Streams + Arc Logs Event Ticker */}
        <Reveal delayMs={160} className="mt-6 rounded-xl border border-white/[0.08] bg-[#111318]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-6 py-4">
            <div className="flex items-center gap-2.5">
              <Radio className={`size-4 ${connected ? 'text-emerald' : 'text-secondary'}`} />
              <span className="rwa-hud text-[#F4F2EC]">QUICKNODE STREAMS // LIVE EVENT TICKER</span>
            </div>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-secondary">
              GET /API/EVENTS · ORDERED BY BLOCKNUMBER
            </span>
          </div>

          {events.length === 0 ? (
            <p className="px-6 py-7 font-mono text-[12px] text-secondary">
              Listening to <code className="text-[#F4F2EC]">POST /api/webhooks/quicknode</code> and live Arc Testnet
              contract logs (<code className="text-[#F4F2EC]">EscrowCreated</code>,{' '}
              <code className="text-[#F4F2EC]">MilestoneSettled</code>,{' '}
              <code className="text-[#F4F2EC]">TECDPenaltyApplied</code>).
            </p>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {events.slice(0, 5).map((evt) => (
                <li
                  key={evt.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 font-mono text-[12px]"
                >
                  <div className="flex items-center gap-3">
                    <span className="rounded-md border border-white/[0.1] bg-[#161922] px-2.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[#F4F2EC]">
                      {evt.eventName}
                    </span>
                    <span className="text-[#F4F2EC]/90">{evt.summary}</span>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] text-secondary">
                    <span>BLOCK #{evt.blockNumber}</span>
                    {evt.txHash && (
                      <a
                        href={explorerUrl('tx', evt.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[#F4F2EC] hover:underline"
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
