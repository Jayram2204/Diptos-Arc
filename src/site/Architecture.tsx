import { type ReactNode, useMemo, useRef, useState } from 'react'
import { Play, RotateCcw } from 'lucide-react'
import { parseUnits } from 'viem'
import { Button, Eyebrow } from '@/components/ui'
import { canonicalEscrowHash, computeTECD, fmtAmount, shortHex } from '@/lib/chain'

type Line = { kind: 'call' | 'ok' | 'emit' | 'err'; text: ReactNode }

const DEMO_PAYER = '0x5A0b54D5dc17e0AadC383d2db43B0a0D3E029c4c' as const
const DEMO_PAYEE = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' as const

const KIND_STYLE: Record<Line['kind'], string> = {
  call: 'text-secondary',
  ok: 'text-emerald',
  emit: 'text-gold',
  err: 'text-crimson',
}

const KIND_GLYPH: Record<Line['kind'], string> = {
  call: '→',
  ok: '✓',
  emit: '←',
  err: '✕',
}

function useTrace() {
  const [lines, setLines] = useState<Line[]>([])
  const [running, setRunning] = useState(false)
  const timers = useRef<number[]>([])

  const play = (next: Line[]) => {
    timers.current.forEach(clearTimeout)
    setLines([])
    setRunning(true)
    next.forEach((l, i) => {
      timers.current.push(
        window.setTimeout(() => {
          setLines((cur) => [...cur, l])
          if (i === next.length - 1) setRunning(false)
        }, 200 * (i + 1)),
      )
    })
  }

  const reset = () => {
    timers.current.forEach(clearTimeout)
    setLines([])
    setRunning(false)
  }

  return { lines, running, play, reset }
}

function SandboxCard({
  layer,
  title,
  fnName,
  contract,
  controls,
  trace,
  onRun,
  runLabel = 'Run Dry-Run',
}: {
  layer: string
  title: string
  fnName: string
  contract: string
  controls?: ReactNode
  trace: ReturnType<typeof useTrace>
  onRun: () => void
  runLabel?: string
}) {
  return (
    <article className="flex flex-col rounded-[10px] border border-white/[0.08] bg-surface">
      {/* Header */}
      <div className="border-b border-white/[0.08] px-5 py-4">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] font-semibold tracking-[0.12em] text-gold">{layer}</span>
          <span className="font-mono text-[11px] text-secondary">{contract}</span>
        </div>
        <h3 className="mt-2.5 text-[17px] font-semibold text-primary">{title}</h3>
        <p className="mt-1 font-mono text-[12px] text-secondary">{fnName}</p>
      </div>

      {/* Input Row */}
      {controls && <div className="border-b border-white/[0.08] px-5 py-3.5">{controls}</div>}

      {/* Output Trace */}
      <div className="flex flex-1 flex-col px-5 py-4">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-secondary">Execution Trace</span>
          {trace.lines.length > 0 && !trace.running && (
            <button
              type="button"
              onClick={trace.reset}
              className="inline-flex items-center gap-1 font-mono text-[11px] text-secondary hover:text-primary"
            >
              <RotateCcw className="size-3" /> Clear
            </button>
          )}
        </div>

        <ol className="mt-3 min-h-[168px] flex-1 space-y-1.5 font-mono text-[11.5px] leading-relaxed">
          {trace.lines.length === 0 && (
            <li className="text-secondary/50">Click "{runLabel}" to compute cryptographic output locally.</li>
          )}
          {trace.lines.map((l, i) => (
            <li key={i} className={`flex animate-fade-up gap-2 ${KIND_STYLE[l.kind]}`}>
              <span className="w-3 shrink-0 text-center">{KIND_GLYPH[l.kind]}</span>
              <span className="min-w-0 break-all">{l.text}</span>
            </li>
          ))}
        </ol>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/[0.08] pt-3.5">
          <span className="font-mono text-[10px] text-secondary">Arc ABI • Local Browser Verify</span>
          <Button size="sm" variant="secondary" onClick={onRun} loading={trace.running}>
            {!trace.running && <Play className="size-3 text-gold" />}
            {runLabel}
          </Button>
        </div>
      </div>
    </article>
  )
}

function LayerOneHash() {
  const trace = useTrace()
  const [amount, setAmount] = useState('2500')
  const [seen, setSeen] = useState<Set<string>>(new Set())
  const deadline = useMemo(() => 1798761600n, [])
  const amountWei = useMemo(() => {
    try {
      return parseUnits(amount || '0', 18)
    } catch {
      return 0n
    }
  }, [amount])

  const hash = canonicalEscrowHash('esc_arc_demo_01', DEMO_PAYER, DEMO_PAYEE, amountWei, deadline)
  const duplicate = seen.has(hash)

  const run = () => {
    const base: Line[] = [
      { kind: 'call', text: `abi.encode(escrowId, ${shortHex(DEMO_PAYER)}, ${shortHex(DEMO_PAYEE)}, ${amount} USDC)` },
      { kind: 'ok', text: `keccak256 → ${shortHex(hash, 14, 10)}` },
    ]
    if (duplicate) {
      trace.play([
        ...base,
        { kind: 'call', text: 'require(!registry.canonicalHashes[hash])' },
        { kind: 'err', text: 'revert EscrowAlreadyExists(canonicalHash)' },
        { kind: 'err', text: 'Double-spend replay blocked — Arc state unchanged' },
      ])
      return
    }
    trace.play([
      ...base,
      { kind: 'call', text: 'require(!registry.canonicalHashes[hash])' },
      { kind: 'ok', text: 'Unique canonical hash — registered on Arc Testnet' },
      { kind: 'emit', text: `emit EscrowCreated(${shortHex(hash, 10, 6)}, ${amount} USDC)` },
    ])
    setSeen((s) => new Set(s).add(hash))
  }

  return (
    <SandboxCard
      layer="LAYER 01"
      title="Anti-Double-Spend Escrow Hash"
      fnName="createEscrowLink(escrowId, payee, deadline, lambdaBps, isAgent)"
      contract="DiptosRegistry.sol"
      trace={trace}
      onRun={run}
      runLabel={duplicate ? 'Replay Hash' : 'Compute Hash'}
      controls={
        <label className="flex items-center justify-between gap-3 text-[12px] text-secondary">
          <span>Escrow Principal</span>
          <span className="flex items-center gap-1.5">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
              inputMode="decimal"
              aria-label="Escrow principal in USDC"
              className="h-8 w-28 rounded-md border border-white/[0.08] bg-elevated px-2.5 text-right font-mono text-[12px] text-primary outline-none focus:border-gold/60"
            />
            <span className="font-mono text-[11px] text-secondary">USDC</span>
          </span>
        </label>
      }
    />
  )
}

function LayerTwoDvP() {
  const trace = useTrace()
  const [amount, setAmount] = useState('2500')
  const num = Number(amount) || 0
  const fee = num * 0.005
  const payout = num - fee

  const run = () => {
    trace.play([
      { kind: 'call', text: 'ecrecover(keccak256(5042002, escrow, id, deliverableHash), grokSig)' },
      { kind: 'ok', text: 'Signer matches Grok AI Oracle (confidence 0.97)' },
      { kind: 'ok', text: `Atomic Leg A · Payee receives ${fmtAmount(payout)} USDC (99.5%)` },
      { kind: 'ok', text: `Atomic Leg B · Protocol fee ${fmtAmount(fee)} USDC (0.5%)` },
      { kind: 'emit', text: 'emit EscrowSettled(escrowId, finality < 1.0s)' },
    ])
  }

  return (
    <SandboxCard
      layer="LAYER 02"
      title="Atomic Deliverable-vs-Payment"
      fnName="releaseMilestoneDvP(escrowId, grokSignature, deliverableHash)"
      contract="DiptosEscrow.sol"
      trace={trace}
      onRun={run}
      runLabel="Simulate DvP"
      controls={
        <div className="flex items-center justify-between gap-3 text-[12px] text-secondary">
          <span>Settlement Value</span>
          <span className="flex items-center gap-1.5">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
              inputMode="decimal"
              aria-label="Settlement value in USDC"
              className="h-8 w-28 rounded-md border border-white/[0.08] bg-elevated px-2.5 text-right font-mono text-[12px] text-primary outline-none focus:border-gold/60"
            />
            <span className="font-mono text-[11px] text-secondary">USDC</span>
          </span>
        </div>
      }
    />
  )
}

function LayerThreeTECD() {
  const trace = useTrace()
  const [delayHours, setDelayHours] = useState('12')

  const run = () => {
    const hrs = Math.max(0, Number(delayHours) || 0)
    const res = computeTECD({
      amountUsdc: 2500,
      delayHours: hrs,
      slaWindowHours: 24,
      lambda: 0.35,
      gamma: 1.5,
    })
    trace.play([
      { kind: 'call', text: `previewTECD(V0=2500 USDC, dt=${hrs}h, T=24h, λ=0.35, γ=1.5)` },
      { kind: 'ok', text: `Retention factor exp(-λ(dt/T)^γ) = ${(res.retentionRatio * 100).toFixed(2)}%` },
      { kind: 'ok', text: `Payee Instant Payout → ${fmtAmount(res.sellerPayout)} USDC` },
      { kind: res.buyerRebate > 0 ? 'err' : 'ok', text: `Automatic Buyer Rebate → ${fmtAmount(res.buyerRebate)} USDC` },
      { kind: 'emit', text: `emit TECDPenaltyApplied(decay=${res.decayPercent.toFixed(2)}%)` },
    ])
  }

  return (
    <SandboxCard
      layer="LAYER 03"
      title="TECD Latency Penalty Curve"
      fnName="applyEntropyDiscount(escrowId, delaySeconds, lambdaBps)"
      contract="DiptosEscrow.sol"
      trace={trace}
      onRun={run}
      runLabel="Evaluate Decay"
      controls={
        <label className="flex items-center justify-between gap-3 text-[12px] text-secondary">
          <span>Simulated Delay (dt)</span>
          <span className="flex items-center gap-1.5">
            <input
              value={delayHours}
              onChange={(e) => setDelayHours(e.target.value.replace(/[^\d.]/g, ''))}
              inputMode="decimal"
              aria-label="Simulated delay in hours"
              className="h-8 w-24 rounded-md border border-white/[0.08] bg-elevated px-2.5 text-right font-mono text-[12px] text-primary outline-none focus:border-gold/60"
            />
            <span className="font-mono text-[11px] text-secondary">hours</span>
          </span>
        </label>
      }
    />
  )
}

export function Architecture() {
  return (
    <section id="architecture" className="mx-auto max-w-[1280px] border-t border-white/[0.08] px-4 py-20 sm:px-6">
      <div className="max-w-2xl">
        <Eyebrow>Live Cryptographic Sandbox</Eyebrow>
        <h2 className="mt-3 text-[28px] font-semibold text-primary sm:text-[34px]">
          Three protocol layers. Verified locally in your browser.
        </h2>
        <p className="mt-3 text-[14px] text-secondary">
          Execute the exact <span className="font-mono text-primary">keccak256</span> encoding, atomic DvP split, and
          Time-Entropic Collateral Decay curves enforced by <span className="font-mono text-primary">DiptosEscrow.sol</span>{' '}
          on Arc Testnet.
        </p>
      </div>

      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        <LayerOneHash />
        <LayerTwoDvP />
        <LayerThreeTECD />
      </div>
    </section>
  )
}
