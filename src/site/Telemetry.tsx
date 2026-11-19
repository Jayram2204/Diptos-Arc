import { useEffect, useState } from 'react'
import { Activity, Radio } from 'lucide-react'
import { formatUnits } from 'viem'
import { Eyebrow, PulseDot } from '@/components/ui'
import { ARC_RPC_URL } from '@/config/protocol'
import { explorerUrl, shortHex } from '@/lib/chain'
import { useArcPulse, useEscrows, useOracleStatus, useProtocolEvents } from '@/lib/hooks'

export function Telemetry() {
  const pulse = useArcPulse(4000)
  const { escrows } = useEscrows(8000)
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

  const cells = [
    {
      label: 'Latest Block',
      value:
        pulse.blockNumber !== undefined ? (
          <a
            href={explorerUrl('block', pulse.blockNumber)}
            target="_blank"
            rel="noreferrer"
            className="hover:text-gold"
          >
            #{pulse.blockNumber.toLocaleString('en-US')}
          </a>
        ) : oracle?.latestArcBlock ? (
          `#${oracle.latestArcBlock.toLocaleString('en-US')}`
        ) : (
          'Syncing…'
        ),
      sub: 'diptos.getArcTelemetry() • 5042002',
    },
    {
      label: 'Finality Age',
      value: finalityAge !== null ? `${finalityAge}s` : 'Syncing…',
      sub: 'Arc deterministic finality',
    },
    {
      label: 'Base Gas (USDC)',
      value: baseGasUsdc,
      sub: 'Native 18-dec USDC gas token',
    },
    {
      label: 'RPC Round-Trip',
      value: pulse.latency !== undefined ? `${pulse.latency} ms` : 'Syncing…',
      sub: ARC_RPC_URL.replace('https://', ''),
    },
    {
      label: 'Active Escrows',
      value: escrows.length.toLocaleString('en-US'),
      sub: 'On-chain via getEscrowsPaginated()',
    },
    {
      label: 'Verified Oracle Signer',
      value: oracle?.oracleSigner ? (
        <a
          href={explorerUrl('address', oracle.oracleSigner)}
          target="_blank"
          rel="noreferrer"
          className="text-emerald hover:underline"
        >
          {shortHex(oracle.oracleSigner, 8, 6)}
        </a>
      ) : (
        <span className="text-secondary">Awaiting signer key</span>
      ),
      sub: oracle ? `EIP-712 v2 • ${oracle.totalAttestationsSigned} signed` : 'GET /api/oracle/status',
    },
  ]

  return (
    <section id="telemetry" className="mx-auto max-w-[1280px] border-t border-white/[0.08] px-4 py-20 sm:px-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Eyebrow>Live Arc Telemetry &amp; QuickNode Streams</Eyebrow>
          <h2 className="mt-3 text-[28px] font-semibold text-primary sm:text-[34px]">
            Direct JSON-RPC &amp; block-ordered event ingestion.
          </h2>
        </div>
        <span className="inline-flex h-8 items-center gap-2 self-start rounded-md border border-white/[0.08] bg-surface px-3 font-mono text-[11px] text-primary sm:self-auto">
          <PulseDot color={pulse.error && pulse.blockNumber === undefined ? 'bg-crimson' : 'bg-emerald'} />
          <span>{pulse.error && pulse.blockNumber === undefined ? 'RPC Reconnecting' : 'Arc RPC Live • 4s poll'}</span>
        </span>
      </div>

      {/* 6 Dynamic Tabular Metric Cells */}
      <div className="mt-8 grid gap-px overflow-hidden rounded-[10px] border border-white/[0.08] bg-white/[0.08] sm:grid-cols-2 lg:grid-cols-3">
        {cells.map((c) => (
          <div key={c.label} className="bg-surface p-5">
            <p className="text-[12px] text-secondary">{c.label}</p>
            <p className="mt-2.5 font-mono text-[20px] font-semibold text-primary">{c.value}</p>
            <p className="mt-1 font-mono text-[10px] text-secondary/75">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* QuickNode Streams + Arc Logs Stateless Feed */}
      <div className="mt-5 rounded-[10px] border border-white/[0.08] bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-3">
          <div className="flex items-center gap-2.5">
            <Radio className="size-4 text-gold" />
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
              QuickNode Streams &amp; Arc Event Feed
            </span>
            <span className="font-mono text-[11px] text-secondary">GET /api/events • ordered by blockNumber</span>
          </div>
          <span className="inline-flex items-center gap-2 font-mono text-[11px] text-secondary">
            <span className={`size-1.5 rounded-full ${connected ? 'bg-emerald' : 'bg-gold'}`} />
            {connected ? 'Live Feed Active' : 'Polling…'}
          </span>
        </div>

        <div className="divide-y divide-white/[0.06] px-5 py-2">
          {events.length === 0 ? (
            <div className="flex items-center gap-2.5 py-3 font-mono text-[12px] text-secondary">
              <Activity className="size-3.5 text-emerald" />
              <span>
                Monitoring verified QuickNode webhooks &amp; Arc Testnet logs (
                <span className="text-primary">EscrowCreated</span>,{' '}
                <span className="text-primary">MilestoneSettled</span>,{' '}
                <span className="text-primary">TECDPenaltyApplied</span>,{' '}
                <span className="text-primary">TimeoutRefunded</span>)…
              </span>
            </div>
          ) : (
            events.slice(0, 6).map((evt) => (
              <div key={evt.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 font-mono text-[12px]">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      evt.eventName === 'TECDPenaltyApplied' || evt.eventName === 'TimeoutRefunded'
                        ? 'bg-crimson/15 text-crimson'
                        : evt.eventName === 'MilestoneSettled' || evt.eventName === 'EscrowSettled'
                          ? 'bg-emerald/15 text-emerald'
                          : 'bg-gold/15 text-gold'
                    }`}
                  >
                    {evt.eventName}
                  </span>
                  <span className="text-primary">{evt.summary}</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-secondary">
                  <span className="text-[10px] uppercase text-secondary/70">
                    blk #{evt.blockNumber} · idx {evt.logIndex}
                  </span>
                  {evt.txHash && (
                    <a
                      href={explorerUrl('tx', evt.txHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-gold hover:underline"
                    >
                      {shortHex(evt.txHash, 8, 6)}
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  )
}
