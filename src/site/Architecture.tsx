import { useState } from 'react'
import { Play } from 'lucide-react'
import { type Address, formatEther, formatGwei } from 'viem'
import { Button, CopyButton, Eyebrow, Reveal } from '@/components/ui'
import { ABIS } from '@/config/abis'
import { ESCROW_CONTRACT_ADDRESS, REGISTRY_CONTRACT_ADDRESS } from '@/config/protocol'
import { fmtAmount, shortHex } from '@/lib/chain'
import { useGeminiRisk } from '@/lib/hooks'
import { diptos } from '@/lib/sdk'

const SAMPLE_PAYER = '0x1111111111111111111111111111111111111111' as Address
const SAMPLE_PAYEE = '0x2222222222222222222222222222222222222222' as Address

type OutputLine = { kind: 'call' | 'ok' | 'info'; text: string }

export function Architecture() {
  const { data: gemini } = useGeminiRisk()
  const liveLambda = gemini?.recommendedLambda ?? 0.35

  // Layer 01 state
  const [l1Amount, setL1Amount] = useState('2500')
  const [l1Hash, setL1Hash] = useState<string | null>(null)
  const [l1Running, setL1Running] = useState(false)
  const [l1Logs, setL1Logs] = useState<OutputLine[]>([])

  // Layer 02 state
  const [l2Amount, setL2Amount] = useState('1500')
  const [l2Running, setL2Running] = useState(false)
  const [l2Logs, setL2Logs] = useState<OutputLine[]>([])

  // Layer 03 state
  const [l3Delay, setL3Delay] = useState(12)
  const [l3Running, setL3Running] = useState(false)
  const [l3Logs, setL3Logs] = useState<OutputLine[]>([])

  const runLayer1 = async () => {
    setL1Running(true)
    const deadline = Math.floor(Date.now() / 1000) + 86400
    const computed = diptos.computeEscrowHash({
      payer: SAMPLE_PAYER,
      payee: SAMPLE_PAYEE,
      amountUsdc: Number(l1Amount) > 0 ? Number(l1Amount) : 100,
      deadline,
      salt: `diptos:arc:${Date.now()}`,
    })
    setL1Hash(computed.canonicalHash)

    const lines: OutputLine[] = [
      {
        kind: 'call',
        text: `DiptosRegistry.computeCanonicalHash(${shortHex(computed.escrowIdBytes32, 8, 6)}, ${l1Amount} USDC)`,
      },
      { kind: 'ok', text: `keccak256 → ${shortHex(computed.canonicalHash, 14, 10)}` },
    ]

    try {
      const client = diptos.getPublicClient()
      const [onChainHash, exists] = await Promise.all([
        client.readContract({
          address: REGISTRY_CONTRACT_ADDRESS,
          abi: ABIS.DiptosRegistry,
          functionName: 'computeCanonicalHash',
          args: [computed.escrowIdBytes32, SAMPLE_PAYER, SAMPLE_PAYEE, computed.amountWei, computed.deadlineUnix],
        }),
        client.readContract({
          address: REGISTRY_CONTRACT_ADDRESS,
          abi: ABIS.DiptosRegistry,
          functionName: 'canonicalHashes',
          args: [computed.canonicalHash],
        }),
      ])
      lines.push({
        kind: 'ok',
        text: `Arc eth_call verified → match=${String(onChainHash) === computed.canonicalHash}, doubleSpend=${String(exists)}`,
      })
    } catch {
      lines.push({
        kind: 'info',
        text: `ABI-encoded commitment ready for DiptosRegistry.sol (${shortHex(REGISTRY_CONTRACT_ADDRESS)})`,
      })
    }
    setL1Logs(lines)
    setL1Running(false)
  }

  const runLayer2 = async () => {
    setL2Running(true)
    const amt = Math.max(1, Number(l2Amount) || 1500)
    const deadlineUnix = Math.floor(Date.now() / 1000) + 86400
    const tx = diptos.buildCreateEscrowTx({
      escrowId: `esc_arc_dvp_${Date.now()}`,
      payee: SAMPLE_PAYEE,
      amountUsdc: amt,
      deadlineUnix,
      lambdaBps: Math.round(liveLambda * 10_000),
      isAgentMode: true,
    })

    const lines: OutputLine[] = [
      { kind: 'call', text: `DiptosEscrow.createEscrowLink(${amt} USDC, λ=${liveLambda.toFixed(2)}, agent=true)` },
      { kind: 'ok', text: `calldata (${(tx.data.length - 2) / 2} bytes) → ${shortHex(tx.data, 16, 8)}` },
    ]

    try {
      const client = diptos.getPublicClient()
      const gasPrice = await client.getGasPrice()
      const estGas = 148_000n
      const estFeeUsdc = Number(formatEther(estGas * gasPrice)).toFixed(6)
      lines.push({
        kind: 'ok',
        text: `Arc live gasPrice=${Number(formatGwei(gasPrice)).toFixed(4)} gwei · est settlement fee ≈ ${estFeeUsdc} USDC`,
      })
    } catch {
      lines.push({ kind: 'info', text: '99.50% payee payout · 0.50% flat fee · 0% chargeback risk' })
    }
    setL2Logs(lines)
    setL2Running(false)
  }

  const runLayer3 = async () => {
    setL3Running(true)
    const lines: OutputLine[] = [
      {
        kind: 'call',
        text: `DiptosEscrow.previewTECDPayout(2500 USDC, delay=+${l3Delay}h, λ=${liveLambda.toFixed(2)})`,
      },
    ]
    try {
      const preview = await diptos.previewTECDOnChain({
        principalUsdc: 2500,
        slaWindowSeconds: 24 * 3600,
        delaySeconds: l3Delay * 3600,
        lambda: liveLambda,
      })
      lines.push({
        kind: 'ok',
        text: `eth_call [${preview.source}] → Payee $${fmtAmount(preview.payeePayoutUsdc)} · Rebate $${fmtAmount(preview.buyerRebateUsdc)} (-${preview.decayPercent.toFixed(1)}%)`,
      })
    } catch {
      const local = diptos.calculateTECD({
        principalUsdc: 2500,
        lambda: liveLambda,
        delaySeconds: l3Delay * 3600,
        totalDurationSeconds: 24 * 3600,
      })
      lines.push({
        kind: 'ok',
        text: `WAD fixed-point → Payee $${fmtAmount(local.payeePayoutUsdc)} · Rebate $${fmtAmount(local.buyerRebateUsdc)} (-${local.decayPercent.toFixed(1)}%)`,
      })
    }
    setL3Logs(lines)
    setL3Running(false)
  }

  return (
    <section id="architecture" className="border-t border-paper/10 bg-black py-28 lg:py-36">
      <div className="mx-auto max-w-[1380px] px-6 lg:px-10">
        <Reveal className="max-w-2xl">
          <Eyebrow>02 // PROTOCOL STACK</Eyebrow>
          <h2 className="rwa-display mt-4 text-[clamp(2rem,4vw,3.4rem)] uppercase text-paper">
            THREE DETERMINISTIC LAYERS ON ARC.
          </h2>
          <p className="mt-4 text-[16px] leading-relaxed text-secondary">
            Inspect and execute real <code className="font-mono text-paper">eth_call</code> and{' '}
            <code className="font-mono text-paper">keccak256</code> simulations directly against our Arc Testnet
            (5042002) protocol contracts.
          </p>
        </Reveal>

        <div className="mt-14 space-y-6">
          {/* LAYER 01 */}
          <Reveal>
            <div className="grid min-h-[260px] gap-8 rounded-2xl border border-paper/10 bg-surface p-8 lg:grid-cols-12 lg:items-center lg:p-10">
              <div className="lg:col-span-6">
                <p className="rwa-hud text-lime">LAYER 01 // ANTI-DOUBLE-SPEND COMMITMENT</p>
                <h3 className="rwa-display mt-3 text-[26px] uppercase text-paper">DiptosRegistry.sol</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-secondary">
                  Binds every escrow ID, payer, payee, principal, and deadline into a canonical{' '}
                  <code className="font-mono text-paper">keccak256</code> commitment. Any attempt to double-spend or
                  re-originate an escrow reverts atomically with{' '}
                  <code className="font-mono text-paper">CommitmentAlreadyExists()</code>.
                </p>
              </div>
              <div className="space-y-4 lg:col-span-6">
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    value={l1Amount}
                    onChange={(e) => setL1Amount(e.target.value)}
                    aria-label="Layer 1 USDC Amount"
                    className="h-11 w-36 rounded-full border border-paper/15 bg-black px-4 font-mono text-[13px] text-paper outline-none focus:border-lime"
                  />
                  <Button size="sm" loading={l1Running} onClick={() => void runLayer1()}>
                    <Play className="size-3.5" /> SIMULATE COMMITMENT
                  </Button>
                  {l1Hash && <CopyButton value={l1Hash} label="Copy canonical hash" />}
                </div>
                <div className="min-h-[84px] rounded-xl border border-paper/10 bg-black/80 p-4 font-mono text-[11.5px] leading-relaxed">
                  {l1Logs.length === 0 ? (
                    <span className="text-secondary">
                      // Ready: DiptosRegistry.computeCanonicalHash(escrowId, payer, payee, amount, deadline)
                    </span>
                  ) : (
                    l1Logs.map((line, i) => (
                      <p key={i} className={line.kind === 'ok' ? 'text-lime' : 'text-paper/80'}>
                        {line.kind === 'call' ? '→ ' : '✓ '}
                        {line.text}
                      </p>
                    ))
                  )}
                </div>
              </div>
            </div>
          </Reveal>

          {/* LAYER 02 */}
          <Reveal delayMs={90}>
            <div className="grid min-h-[260px] gap-8 rounded-2xl border border-paper/10 bg-surface p-8 lg:grid-cols-12 lg:items-center lg:p-10">
              <div className="lg:col-span-6">
                <p className="rwa-hud text-lime">LAYER 02 // ATOMIC USDC DVP ESCROW</p>
                <h3 className="rwa-display mt-3 text-[26px] uppercase text-paper">DiptosEscrow.sol</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-secondary">
                  Locks native Arc USDC (<code className="font-mono text-paper">msg.value</code>) across single-shot or
                  multi-milestone schedules. Grok AI signs a chain-bound, nonce-protected EIP-712 release digest
                  verified via <code className="font-mono text-paper">ecrecover</code>.
                </p>
              </div>
              <div className="space-y-4 lg:col-span-6">
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    value={l2Amount}
                    onChange={(e) => setL2Amount(e.target.value)}
                    aria-label="Layer 2 USDC Amount"
                    className="h-11 w-36 rounded-full border border-paper/15 bg-black px-4 font-mono text-[13px] text-paper outline-none focus:border-lime"
                  />
                  <Button size="sm" loading={l2Running} onClick={() => void runLayer2()}>
                    <Play className="size-3.5" /> ENCODE &amp; ESTIMATE GAS
                  </Button>
                </div>
                <div className="min-h-[84px] rounded-xl border border-paper/10 bg-black/80 p-4 font-mono text-[11.5px] leading-relaxed">
                  {l2Logs.length === 0 ? (
                    <span className="text-secondary">
                      // Ready: DiptosEscrow.createEscrowLink + live Arc eth_gasPrice ({shortHex(ESCROW_CONTRACT_ADDRESS)})
                    </span>
                  ) : (
                    l2Logs.map((line, i) => (
                      <p key={i} className={line.kind === 'ok' ? 'text-emerald' : 'text-paper/80'}>
                        {line.kind === 'call' ? '→ ' : '✓ '}
                        {line.text}
                      </p>
                    ))
                  )}
                </div>
              </div>
            </div>
          </Reveal>

          {/* LAYER 03 */}
          <Reveal delayMs={180}>
            <div className="grid min-h-[260px] gap-8 rounded-2xl border border-paper/10 bg-surface p-8 lg:grid-cols-12 lg:items-center lg:p-10">
              <div className="lg:col-span-6">
                <p className="rwa-hud text-lime">LAYER 03 // TIME-ENTROPIC COLLATERAL DECAY</p>
                <h3 className="rwa-display mt-3 text-[26px] uppercase text-paper">previewTECDPayout()</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-secondary">
                  Executes <code className="font-mono text-paper">V₀ · exp(−λ · (Δt/T)^1.5)</code> in Solidity 18-decimal
                  WAD math. Zero wei dust lost or created—verified across 256 Foundry fuzz runs.
                </p>
              </div>
              <div className="space-y-4 lg:col-span-6">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex flex-1 items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={48}
                      value={l3Delay}
                      onChange={(e) => setL3Delay(Number(e.target.value))}
                      aria-label="Simulated delay hours"
                      className="w-full cursor-pointer"
                    />
                    <span className="w-14 shrink-0 font-mono text-[12px] text-lime">+{l3Delay}h</span>
                  </div>
                  <Button size="sm" loading={l3Running} onClick={() => void runLayer3()}>
                    <Play className="size-3.5" /> CALL ON ARC
                  </Button>
                </div>
                <div className="min-h-[84px] rounded-xl border border-paper/10 bg-black/80 p-4 font-mono text-[11.5px] leading-relaxed">
                  {l3Logs.length === 0 ? (
                    <span className="text-secondary">
                      // Ready: DiptosEscrow.previewTECDPayout(2500e18, deadline, simulatedTs, {Math.round(liveLambda * 10_000)})
                    </span>
                  ) : (
                    l3Logs.map((line, i) => (
                      <p key={i} className={line.kind === 'ok' ? 'text-lime' : 'text-paper/80'}>
                        {line.kind === 'call' ? '→ ' : '✓ '}
                        {line.text}
                      </p>
                    ))
                  )}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
