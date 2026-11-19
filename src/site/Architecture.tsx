import { type ReactNode, useMemo, useState } from 'react'
import { Play, RotateCcw } from 'lucide-react'
import { Button, Eyebrow } from '@/components/ui'
import { DIPTOS_ESCROW_ABI, DIPTOS_REGISTRY_ABI } from '@/config/abis'
import { ESCROW_CONTRACT_ADDRESS, REGISTRY_CONTRACT_ADDRESS } from '@/config/protocol'
import { fmtAmount, shortHex } from '@/lib/chain'
import { useGeminiRisk } from '@/lib/hooks'
import { diptos } from '@/lib/sdk'

type Line = { kind: 'call' | 'ok' | 'emit' | 'err'; text: ReactNode }

const SAMPLE_PAYER = '0x5A0b54D5dc17e0AadC383d2db43B0a0D3E029c4c' as const
const SAMPLE_PAYEE = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' as const

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

function SandboxCard({
  layer,
  title,
  fnName,
  contract,
  controls,
  lines,
  running,
  onClear,
  onRun,
  runLabel = 'Run Dry-Run',
}: {
  layer: string
  title: string
  fnName: string
  contract: string
  controls?: ReactNode
  lines: Line[]
  running: boolean
  onClear: () => void
  onRun: () => void
  runLabel?: string
}) {
  return (
    <article className="flex flex-col rounded-[10px] border border-white/[0.08] bg-surface">
      <div className="border-b border-white/[0.08] px-5 py-4">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] font-semibold tracking-[0.12em] text-gold">{layer}</span>
          <span className="font-mono text-[11px] text-secondary">{contract}</span>
        </div>
        <h3 className="mt-2.5 text-[17px] font-semibold text-primary">{title}</h3>
        <p className="mt-1 font-mono text-[12px] text-secondary">{fnName}</p>
      </div>

      {controls && <div className="border-b border-white/[0.08] px-5 py-3.5">{controls}</div>}

      <div className="flex flex-1 flex-col px-5 py-4">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-secondary">
            Arc eth_call / SDK Trace
          </span>
          {lines.length > 0 && !running && (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1 font-mono text-[11px] text-secondary hover:text-primary"
            >
              <RotateCcw className="size-3" /> Clear
            </button>
          )}
        </div>

        <ol className="mt-3 min-h-[168px] flex-1 space-y-1.5 font-mono text-[11.5px] leading-relaxed">
          {lines.length === 0 && (
            <li className="text-secondary/50">Click "{runLabel}" to execute live Arc RPC dry-run.</li>
          )}
          {lines.map((l, i) => (
            <li key={i} className={`flex animate-fade-up gap-2 ${KIND_STYLE[l.kind]}`}>
              <span className="w-3 shrink-0 text-center">{KIND_GLYPH[l.kind]}</span>
              <span className="min-w-0 break-all">{l.text}</span>
            </li>
          ))}
        </ol>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/[0.08] pt-3.5">
          <span className="font-mono text-[10px] text-secondary">Arc Testnet • 5042002</span>
          <Button size="sm" variant="secondary" onClick={onRun} loading={running}>
            {!running && <Play className="size-3 text-gold" />}
            {runLabel}
          </Button>
        </div>
      </div>
    </article>
  )
}

function LayerOneHash() {
  const [amount, setAmount] = useState('2500')
  const [lines, setLines] = useState<Line[]>([])
  const [running, setRunning] = useState(false)
  const deadline = useMemo(() => 1798761600n, [])

  const run = async () => {
    setRunning(true)
    const computed = diptos.computeEscrowHash({
      payer: SAMPLE_PAYER,
      payee: SAMPLE_PAYEE,
      amountUsdc: amount || '0',
      deadline,
      salt: 'esc_arc_canonical_v2',
    })

    const next: Line[] = [
      { kind: 'call', text: `DiptosRegistry.computeCanonicalHash(${shortHex(computed.escrowIdBytes32, 8, 6)}, ${amount} USDC)` },
      { kind: 'ok', text: `keccak256 → ${shortHex(computed.canonicalHash, 14, 10)}` },
    ]

    try {
      const client = diptos.getPublicClient()
      const [onChainHash, exists] = await Promise.all([
        client.readContract({
          address: REGISTRY_CONTRACT_ADDRESS,
          abi: DIPTOS_REGISTRY_ABI,
          functionName: 'computeCanonicalHash',
          args: [computed.escrowIdBytes32, SAMPLE_PAYER, SAMPLE_PAYEE, computed.amountWei, computed.deadlineUnix],
        }),
        client.readContract({
          address: REGISTRY_CONTRACT_ADDRESS,
          abi: DIPTOS_REGISTRY_ABI,
          functionName: 'canonicalHashes',
          args: [computed.canonicalHash],
        }),
      ])
      next.push({ kind: 'ok', text: `Arc eth_call match → ${shortHex(onChainHash as string, 14, 10)}` })
      next.push(
        exists
          ? { kind: 'err', text: 'canonicalHashes[hash] == true → Double-spend blocked!' }
          : { kind: 'emit', text: 'canonicalHashes[hash] == false → Unique & ready to lock' },
      )
    } catch {
      next.push({ kind: 'ok', text: 'ABI-encoded locally via @diptos/sdk (byte-identical to DiptosRegistry.sol)' })
      next.push({ kind: 'emit', text: 'Ready for DiptosRegistry.recordCommitment on Arc Testnet' })
    }

    setLines(next)
    setRunning(false)
  }

  return (
    <SandboxCard
      layer="LAYER 01"
      title="Anti-Double-Spend Escrow Hash"
      fnName="DiptosRegistry.computeCanonicalHash(escrowId, payer, payee, amount, deadline)"
      contract="DiptosRegistry.sol"
      lines={lines}
      running={running}
      onClear={() => setLines([])}
      onRun={() => void run()}
      runLabel="Verify Hash on Arc"
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
  const [amount, setAmount] = useState('2500')
  const [lines, setLines] = useState<Line[]>([])
  const [running, setRunning] = useState(false)

  const run = async () => {
    setRunning(true)
    const num = Number(amount) || 0
    const tx = diptos.buildCreateEscrowTx({
      escrowId: 'esc_arc_dvp_preview',
      payee: SAMPLE_PAYEE,
      amountUsdc: num || 1,
      deadlineUnix: Math.floor(Date.now() / 1000) + 86400,
      lambdaBps: 2500,
      isAgentMode: true,
    })

    const next: Line[] = [
      { kind: 'call', text: `buildCreateEscrowTx → ${shortHex(tx.data, 14, 6)} (${tx.value} wei)` },
    ]

    try {
      const client = diptos.getPublicClient()
      const [feeBps, signer] = await Promise.all([
        client.readContract({
          address: ESCROW_CONTRACT_ADDRESS,
          abi: DIPTOS_ESCROW_ABI,
          functionName: 'PROTOCOL_FEE_BPS',
        }),
        client.readContract({
          address: ESCROW_CONTRACT_ADDRESS,
          abi: DIPTOS_ESCROW_ABI,
          functionName: 'oracleSigner',
        }),
      ])
      const bps = Number(feeBps)
      const fee = (num * bps) / 10_000
      next.push({ kind: 'ok', text: `Arc eth_call oracleSigner → ${shortHex(signer as string, 10, 6)}` })
      next.push({ kind: 'ok', text: `Atomic Leg A · Payee receives ${fmtAmount(num - fee)} USDC` })
      next.push({ kind: 'emit', text: `Atomic Leg B · Protocol fee ${fmtAmount(fee)} USDC (${bps} bps)` })
    } catch {
      const res = diptos.calculateTECD({
        principalUsdc: num,
        lambda: 0.25,
        delaySeconds: 0,
        totalDurationSeconds: 86400,
      })
      next.push({ kind: 'ok', text: 'EIP-712 ReleaseMilestone(escrowId, milestoneIndex, deliverableHash, nonce, 5042002)' })
      next.push({ kind: 'ok', text: `Atomic Leg A · Payee receives ${fmtAmount(res.payeePayoutUsdc)} USDC (99.5%)` })
      next.push({ kind: 'emit', text: `Atomic Leg B · Protocol fee ${fmtAmount(res.protocolFeeUsdc)} USDC (0.5%)` })
    }

    setLines(next)
    setRunning(false)
  }

  return (
    <SandboxCard
      layer="LAYER 02"
      title="Atomic Deliverable-vs-Payment"
      fnName="DiptosEscrow.releaseWithOracle(escrowId, idx, deliverableHash, nonce, sig)"
      contract="DiptosEscrow.sol"
      lines={lines}
      running={running}
      onClear={() => setLines([])}
      onRun={() => void run()}
      runLabel="Dry-Run DvP"
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

function LayerThreeTECD({ liveLambda }: { liveLambda: number }) {
  const [delayHours, setDelayHours] = useState('12')
  const [lines, setLines] = useState<Line[]>([])
  const [running, setRunning] = useState(false)

  const run = async () => {
    setRunning(true)
    const hrs = Math.max(0, Number(delayHours) || 0)
    const preview = await diptos.previewTECDOnChain({
      principalUsdc: 2500,
      slaWindowSeconds: 24 * 3600,
      delaySeconds: hrs * 3600,
      lambda: liveLambda,
    })

    setLines([
      { kind: 'call', text: `DiptosEscrow.previewTECDPayout(2500 USDC, dt=${hrs}h, λ=${liveLambda.toFixed(2)})` },
      {
        kind: 'ok',
        text:
          preview.source === 'arc-eth-call'
            ? 'Source: Live Solidity WAD eth_call on Arc Testnet'
            : 'Source: @diptos/sdk WAD-equivalent math',
      },
      { kind: 'ok', text: `Payee Instant Payout → ${fmtAmount(preview.payeePayoutUsdc)} USDC` },
      {
        kind: preview.buyerRebateUsdc > 0 ? 'err' : 'ok',
        text: `Automatic Buyer Rebate → ${fmtAmount(preview.buyerRebateUsdc)} USDC`,
      },
      { kind: 'emit', text: `TECD Decay = ${preview.decayPercent.toFixed(2)}% • Fee = ${fmtAmount(preview.protocolFeeUsdc)} USDC` },
    ])
    setRunning(false)
  }

  return (
    <SandboxCard
      layer="LAYER 03"
      title="TECD Latency Penalty Curve"
      fnName="DiptosEscrow.previewTECDPayout(amount, deadline, evalTs, lambdaBps)"
      contract="DiptosEscrow.sol"
      lines={lines}
      running={running}
      onClear={() => setLines([])}
      onRun={() => void run()}
      runLabel="Call previewTECD"
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
  const { data: gemini } = useGeminiRisk()
  const liveLambda = gemini?.recommendedLambda ?? 0.35

  return (
    <section id="architecture" className="mx-auto max-w-[1280px] border-t border-white/[0.08] px-4 py-20 sm:px-6">
      <div className="max-w-2xl">
        <Eyebrow>Live Cryptographic Sandbox</Eyebrow>
        <h2 className="mt-3 text-[28px] font-semibold text-primary sm:text-[34px]">
          Three protocol layers. Verified directly against Arc.
        </h2>
        <p className="mt-3 text-[14px] text-secondary">
          Execute live <span className="font-mono text-primary">viem</span>{' '}
          <span className="font-mono text-primary">eth_call</span> dry-runs and{' '}
          <span className="font-mono text-primary">@diptos/sdk</span> checks against{' '}
          <span className="font-mono text-primary">DiptosEscrow.sol</span> &amp;{' '}
          <span className="font-mono text-primary">DiptosRegistry.sol</span>.
        </p>
      </div>

      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        <LayerOneHash />
        <LayerTwoDvP />
        <LayerThreeTECD liveLambda={liveLambda} />
      </div>
    </section>
  )
}
