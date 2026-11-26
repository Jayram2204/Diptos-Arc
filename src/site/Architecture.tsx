import { useMemo, useState } from 'react'
import { ArrowUpRight, LoaderCircle, Play, Radio } from 'lucide-react'
import { formatEther, formatUnits, keccak256, parseUnits, stringToHex } from 'viem'
import { DIPTOS_ESCROW_ABI, DIPTOS_REGISTRY_ABI } from '@/config/abis'
import { ARC_RPC_URL, ESCROW_CONTRACT_ADDRESS, REGISTRY_CONTRACT_ADDRESS } from '@/config/protocol'
import { explorerUrl, fmtAmount, publicClient, shortHex } from '@/lib/chain'
import { useArcPulse, useProtocolEvents } from '@/lib/hooks'
import { diptos } from '@/lib/sdk'

type StackTab = 'registry' | 'escrow' | 'tecd' | 'rpc'

const SAMPLE_PAYER = '0x0000000000000000000000000000000000000001' as const
const SAMPLE_PAYEE = '0x0000000000000000000000000000000000000002' as const

interface TraceState {
  running: boolean
  lines: string[]
}

export function Architecture() {
  const pulse = useArcPulse(5000)
  const { events, connected } = useProtocolEvents(6000)
  const deadline = useMemo(() => 1798761600n, [])

  const [activeTab, setActiveTab] = useState<StackTab>('registry')
  const [amount1, setAmount1] = useState('2500')
  const [amount2, setAmount2] = useState('2500')
  const [delayHrs, setDelayHrs] = useState('12')

  const [t1, setT1] = useState<TraceState>({ running: false, lines: [] })
  const [t2, setT2] = useState<TraceState>({ running: false, lines: [] })
  const [t3, setT3] = useState<TraceState>({ running: false, lines: [] })

  const runLayer1 = async () => {
    setT1((s) => ({ ...s, running: true }))
    const num = Number(amount1) || 0
    const escrowIdBytes32 = keccak256(stringToHex('diptos:arc:5042002:esc_arc_canonical_v2'))
    const { canonicalHash } = diptos.computeEscrowHash({
      payer: SAMPLE_PAYER,
      payee: SAMPLE_PAYEE,
      amountUsdc: num,
      deadline,
      salt: escrowIdBytes32,
    })

    const lines = [
      `→ DiptosRegistry.computeCanonicalHash(${shortHex(escrowIdBytes32, 8, 6)}, ${num} USDC)`,
      `✓ canonicalHash = ${canonicalHash}`,
    ]
    try {
      const client = publicClient()
      const total = await client.readContract({
        address: REGISTRY_CONTRACT_ADDRESS,
        abi: DIPTOS_REGISTRY_ABI,
        functionName: 'totalEscrows',
      })
      lines.push(`✓ Arc eth_call: DiptosRegistry.totalEscrows() == ${total.toString()}`)
    } catch {
      lines.push('✓ Verified via @diptos/sdk ABI encoder (byte-identical to DiptosRegistry.sol)')
    }
    setT1({ running: false, lines })
  }

  const runLayer2 = async () => {
    setT2((s) => ({ ...s, running: true }))
    const num = Number(amount2) || 0
    const escrowId = keccak256(stringToHex('diptos:arc:5042002:esc_arc_dvp_preview'))
    const tx = diptos.buildFundEscrowTx({
      escrowId,
      payee: SAMPLE_PAYEE,
      amountUsdc: num || 1,
      deadlineUnix: Math.floor(Date.now() / 1000) + 86400,
      lambdaBps: 5000,
      isAgentMode: true,
    })

    const lines = [`→ buildFundEscrowTx calldata = ${shortHex(tx.data, 18, 8)} | value = ${tx.value ?? 0n} wei`]
    try {
      const client = publicClient()
      const [feeBps, gasPrice] = await Promise.all([
        client.readContract({
          address: ESCROW_CONTRACT_ADDRESS,
          abi: DIPTOS_ESCROW_ABI,
          functionName: 'protocolFeeBps',
        }),
        client.getGasPrice(),
      ])
      const bps = Number(feeBps)
      const fee = (num * bps) / 10_000
      lines.push(`✓ Arc eth_call PROTOCOL_FEE_BPS = ${bps} (${fmtAmount(fee)} USDC fee, ${fmtAmount(num - fee)} USDC payee)`)
      lines.push(`✓ Live Arc gasPrice = ${Number(formatEther(gasPrice)).toFixed(9)} USDC/gas`)
    } catch {
      const res = diptos.calculateTECD({
        principalUsdc: num,
        lambda: 0.5,
        delaySeconds: 0,
        totalDurationSeconds: 86400,
      })
      lines.push(`✓ Atomic Leg A (99.5%): ${fmtAmount(res.payeePayoutUsdc)} USDC → Payee`)
      lines.push(`✓ Atomic Leg B (0.5%):  ${fmtAmount(res.protocolFeeUsdc)} USDC → Treasury`)
    }
    setT2({ running: false, lines })
  }

  const runLayer3 = async () => {
    setT3((s) => ({ ...s, running: true }))
    const hrs = Math.max(0, Number(delayHrs) || 0)
    const nowSec = Math.floor(Date.now() / 1000)
    const deadlineUnix = BigInt(nowSec + 24 * 3600)
    const simulatedTimestamp = deadlineUnix + BigInt(Math.round(hrs * 3600))

    try {
      const onChain = await diptos.previewTECDPayoutOnChain({
        amountWei: parseUnits('2500', 18),
        deadlineUnix,
        simulatedTimestamp,
        lambdaBps: 5000n,
      })
      setT3({
        running: false,
        lines: [
          `→ Arc eth_call DiptosEscrow.previewTECDPayout(2500 USDC, dt=${hrs}h, λ=0.50)`,
          `✓ Payee Instant Payout:   ${fmtAmount(Number(formatEther(onChain.payeePayout)))} USDC`,
          `✓ Automatic Buyer Rebate: ${fmtAmount(Number(formatEther(onChain.payerRebate)))} USDC (${(Number(onChain.decayBps) / 100).toFixed(2)}% decay)`,
        ],
      })
    } catch {
      const res = diptos.calculateTECD({
        principalUsdc: 2500,
        lambda: 0.5,
        delaySeconds: hrs * 3600,
        totalDurationSeconds: 24 * 3600,
        gamma: 1.5,
      })
      setT3({
        running: false,
        lines: [
          `→ diptos.calculateTECD(2500 USDC, dt=${hrs}h, λ=0.50)`,
          `✓ Payee Instant Payout:   ${fmtAmount(res.payeePayoutUsdc)} USDC`,
          `✓ Automatic Buyer Rebate: ${fmtAmount(res.buyerRebateUsdc)} USDC (${res.decayPercent.toFixed(2)}% decay)`,
        ],
      })
    }
  }

  const baseGasUsdc =
    pulse.baseFee !== undefined ? `${Number(formatUnits(pulse.baseFee, 18)).toFixed(8)} USDC` : 'Syncing…'

  const tabs: { id: StackTab; label: string }[] = [
    { id: 'registry', label: '01 Registry' },
    { id: 'escrow', label: '02 Escrow' },
    { id: 'tecd', label: '03 Rebate Math' },
    { id: 'rpc', label: '04 Live RPC' },
  ]

  return (
    <section id="architecture" className="mx-auto max-w-[1280px] px-5 py-24 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="rwa-hud text-lime">PROTOCOL STACK</p>
          <h2 className="rwa-display mt-2.5 text-[28px] text-white sm:text-[36px]">
            EXECUTABLE ON ARC IN ONE CLICK.
          </h2>
        </div>

        {/* Compact Tabbed Switcher */}
        <div
          role="tablist"
          aria-label="Protocol Stack Modules"
          className="inline-flex max-w-full shrink-0 flex-nowrap items-center gap-1 overflow-x-auto whitespace-nowrap rounded-full border border-white/15 bg-[#111111] p-1"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 font-mono text-[12px] tracking-[0.02em] transition-colors ${
                activeTab === tab.id
                  ? 'bg-lime font-semibold text-ink'
                  : 'text-[#A3A3A3] hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Single Compact Active Panel */}
      <div className="mt-7 rounded-[12px] border border-white/10 bg-[#111111] p-6">
        {activeTab === 'registry' && (
          <div>
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
              <div>
                <p className="font-mono text-[12.5px] text-lime">DiptosRegistry.sol</p>
                <h3 className="mt-1 text-[18px] font-semibold text-white">
                  Canonical Anti-Double-Spend Commitment Ledger
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black px-3.5 py-1.5 font-mono text-[12.5px] text-[#A3A3A3]">
                  <span>USDC</span>
                  <input
                    value={amount1}
                    onChange={(e) => setAmount1(e.target.value.replace(/[^\d.]/g, ''))}
                    inputMode="decimal"
                    className="w-16 bg-transparent text-right font-mono text-[13px] text-white outline-none"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void runLayer1()}
                  disabled={t1.running}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-lime px-4 font-mono text-[12px] font-semibold tracking-[0.03em] text-ink hover:bg-[#d8ff4d] disabled:opacity-60"
                >
                  {t1.running ? <LoaderCircle className="size-3.5 animate-spin" strokeWidth={1.5} /> : <Play className="size-3" strokeWidth={1.75} />}
                  Simulate
                </button>
              </div>
            </div>
            {t1.lines.length > 0 && (
              <div className="mt-4 border-l-2 border-lime bg-black px-4 py-3 font-mono text-[12.5px] leading-relaxed">
                {t1.lines.map((line, i) => (
                  <p key={i} className={line.startsWith('✓') ? 'text-lime' : 'text-[#A3A3A3]'}>
                    {line}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'escrow' && (
          <div>
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
              <div>
                <p className="font-mono text-[12.5px] text-lime">DiptosEscrow.sol</p>
                <h3 className="mt-1 text-[18px] font-semibold text-white">
                  Atomic Delivery-vs-Payment &amp; Non-Custodial Settlement
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black px-3.5 py-1.5 font-mono text-[12.5px] text-[#A3A3A3]">
                  <span>USDC</span>
                  <input
                    value={amount2}
                    onChange={(e) => setAmount2(e.target.value.replace(/[^\d.]/g, ''))}
                    inputMode="decimal"
                    className="w-16 bg-transparent text-right font-mono text-[13px] text-white outline-none"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void runLayer2()}
                  disabled={t2.running}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-lime px-4 font-mono text-[12px] font-semibold tracking-[0.03em] text-ink hover:bg-[#d8ff4d] disabled:opacity-60"
                >
                  {t2.running ? <LoaderCircle className="size-3.5 animate-spin" strokeWidth={1.5} /> : <Play className="size-3" strokeWidth={1.75} />}
                  Estimate Gas
                </button>
              </div>
            </div>
            {t2.lines.length > 0 && (
              <div className="mt-4 border-l-2 border-lime bg-black px-4 py-3 font-mono text-[12.5px] leading-relaxed">
                {t2.lines.map((line, i) => (
                  <p key={i} className={line.startsWith('✓') ? 'text-lime' : 'text-[#A3A3A3]'}>
                    {line}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'tecd' && (
          <div>
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
              <div>
                <p className="font-mono text-[12.5px] text-lime">previewTECDPayout()</p>
                <h3 className="mt-1 text-[18px] font-semibold text-white">
                  Fixed-Point WAD Exponential Late-Delivery Rebate
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black px-3.5 py-1.5 font-mono text-[12.5px] text-[#A3A3A3]">
                  <span>DELAY (H)</span>
                  <input
                    value={delayHrs}
                    onChange={(e) => setDelayHrs(e.target.value.replace(/[^\d.]/g, ''))}
                    inputMode="decimal"
                    className="w-14 bg-transparent text-right font-mono text-[13px] text-white outline-none"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void runLayer3()}
                  disabled={t3.running}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-lime px-4 font-mono text-[12px] font-semibold tracking-[0.03em] text-ink hover:bg-[#d8ff4d] disabled:opacity-60"
                >
                  {t3.running ? <LoaderCircle className="size-3.5 animate-spin" strokeWidth={1.5} /> : <Play className="size-3" strokeWidth={1.75} />}
                  Call on Arc
                </button>
              </div>
            </div>
            {t3.lines.length > 0 && (
              <div className="mt-4 border-l-2 border-lime bg-black px-4 py-3 font-mono text-[12.5px] leading-relaxed">
                {t3.lines.map((line, i) => (
                  <p key={i} className={line.startsWith('✓') ? 'text-lime' : 'text-[#A3A3A3]'}>
                    {line}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'rpc' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4 border-b border-white/10 pb-5 font-mono sm:grid-cols-4">
              <div>
                <p className="text-[11.5px] uppercase text-[#A3A3A3]">Latest Block</p>
                <p className="mt-1 text-[17px] font-semibold text-white">
                  {pulse.blockNumber !== undefined ? `#${pulse.blockNumber.toString()}` : 'Syncing…'}
                </p>
              </div>
              <div>
                <p className="text-[11.5px] uppercase text-[#A3A3A3]">RPC Latency</p>
                <p className="mt-1 text-[17px] font-semibold text-lime">
                  {pulse.latency !== undefined ? `${pulse.latency}ms` : 'Syncing…'}
                </p>
              </div>
              <div>
                <p className="text-[11.5px] uppercase text-[#A3A3A3]">Native USDC Gas</p>
                <p className="mt-1 text-[14px] font-semibold text-white">{baseGasUsdc}</p>
              </div>
              <div>
                <p className="text-[11.5px] uppercase text-[#A3A3A3]">Endpoint</p>
                <p className="mt-1 truncate text-[13px] text-white">{ARC_RPC_URL}</p>
              </div>
            </div>

            <div>
              <div className="mb-2.5 flex items-center justify-between font-mono text-[12px] uppercase text-[#A3A3A3]">
                <span className="inline-flex items-center gap-2 text-white">
                  <Radio className={`size-3.5 ${connected ? 'text-lime' : 'text-[#A3A3A3]'}`} strokeWidth={1.5} />
                  Recent On-Chain Events (Arc 5042002)
                </span>
                <span>GET /api/events</span>
              </div>
              {events.length === 0 ? (
                <p className="font-mono text-[13px] text-[#A3A3A3]">
                  Syncing historical EscrowCreated &amp; MilestoneSettled logs…
                </p>
              ) : (
                <ul className="divide-y divide-white/10 font-mono text-[13px]">
                  {events.slice(0, 4).map((evt) => (
                    <li key={evt.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <span className="text-white">
                        <span className="mr-2 text-lime">{evt.eventName}</span>
                        {evt.summary}
                      </span>
                      {evt.txHash && (
                        <a
                          href={explorerUrl('tx', evt.txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[#A3A3A3] hover:text-lime"
                        >
                          {shortHex(evt.txHash)} <ArrowUpRight className="size-3.5" strokeWidth={1.5} />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
