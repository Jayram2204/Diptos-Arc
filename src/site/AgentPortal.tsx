import {
  PolicyGuard,
  type QuoteEvaluationResult,
} from '@diptos/agent-guard'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  FileCheck2,
  Gauge,
  KeyRound,
  Play,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Zap,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatEther, parseUnits } from 'viem'
import { DiptosCard } from '@/components/DiptosCard'
import { DiptosVerifiedBadge } from '@/components/DiptosVerifiedBadge'
import { ESCROW_CONTRACT_ADDRESS, REGISTRY_CONTRACT_ADDRESS } from '@/config/protocol'
import { canonicalEscrowHash, explorerUrl, fmtAmount, publicClient, shortHex } from '@/lib/chain'
import { useArcPulse, useEscrows } from '@/lib/hooks'
import { getApexUrl, getAppUrl, getPayUrl, getSdkUrl } from '@/lib/route'
import { diptos } from '@/lib/sdk'

const DEFAULT_POLICY_JSON = JSON.stringify(
  {
    maxPerTaskUsdc: 50,
    dailyBudgetUsdc: 250,
    approvalThresholdUsdc: 35,
    allowedProviders: ['api.diptos.xyz', 'compute.arc.io'],
    slaWindowHours: 24,
    lambda: 0.5,
    outputSchema: {
      requiredKeys: ['deliverableHash', 'status', 'metrics'],
    },
  },
  null,
  2,
)

interface DryRunOutcome {
  policy: QuoteEvaluationResult
  onChainTecd: {
    payeePayoutUsdc: number
    buyerRebateUsdc: number
    protocolFeeUsdc: number
    decayPercent: number
    source: 'arc-eth-call' | 'sdk-wad'
  }
  registryCommitmentUnique: boolean
  canonicalHash: string
}

const AGENT_CAPABILITIES = [
  {
    variant: 'graphite' as const,
    icon: Gauge,
    title: 'Spend Caps',
    subtitle: 'Set per-task & daily USDC limits on-chain.',
  },
  {
    variant: 'white' as const,
    icon: ShieldCheck,
    title: 'x402 Proof Gate',
    subtitle: 'Pay only after deterministic output passes.',
  },
  {
    variant: 'lime' as const,
    icon: KeyRound,
    title: 'Zero Key Exposure',
    subtitle: 'Agents never touch wallet private keys.',
  },
  {
    variant: 'white' as const,
    icon: Scale,
    title: 'Auto Late Rebates',
    subtitle: 'Missed SLAs refund the buyer automatically.',
  },
  {
    variant: 'lime' as const,
    icon: Zap,
    title: '1-Second USDC',
    subtitle: 'Native Arc & Base settlement without ETH gas friction.',
  },
  {
    variant: 'graphite' as const,
    icon: FileCheck2,
    title: 'Clear Off-Chain Scope',
    subtitle: 'Clean criteria + instant kill-switch control.',
  },
]

export function AgentPortal() {
  const { escrows, loading } = useEscrows(5000)
  const pulse = useArcPulse(6000)

  const [policyText, setPolicyText] = useState(DEFAULT_POLICY_JSON)
  const [quoteAmount, setQuoteAmount] = useState(25)
  const [quoteProvider, setQuoteProvider] = useState('api.diptos.xyz')
  const [simulatedDelayHours, setSimulatedDelayHours] = useState(0)
  const [running, setRunning] = useState(false)
  const [dryRunError, setDryRunError] = useState<string | null>(null)
  const [dryRun, setDryRun] = useState<DryRunOutcome | null>(null)

  const agentEscrows = useMemo(
    () =>
      [...escrows]
        .filter((e) => e.mode === 'agent')
        .sort((a, b) => Date.parse(b.createdAt || '0') - Date.parse(a.createdAt || '0')),
    [escrows],
  )

  const runLiveDryRun = useCallback(async () => {
    setDryRunError(null)
    setRunning(true)
    try {
      const parsed = JSON.parse(policyText) as {
        maxPerTaskUsdc?: number
        dailyBudgetUsdc?: number
        approvalThresholdUsdc?: number
        allowedProviders?: string[]
        maxLatencySeconds?: number
        slaWindowHours?: number
        lambda?: number
      }

      const slaHours = Math.max(1, Number(parsed.slaWindowHours ?? 24))
      const lambda = Math.max(0, Math.min(5, Number(parsed.lambda ?? 0.5)))
      const derivedMaxLatency = Number(parsed.maxLatencySeconds ?? slaHours * 3600)

      const guard = new PolicyGuard({
        maxPerTaskUsdc: Number(parsed.maxPerTaskUsdc ?? 50),
        dailyBudgetUsdc: Number(parsed.dailyBudgetUsdc ?? 250),
        approvalThresholdUsdc: Number(parsed.approvalThresholdUsdc ?? 35),
        allowedProviders: Array.isArray(parsed.allowedProviders) ? parsed.allowedProviders : [],
        maxLatencySeconds: derivedMaxLatency,
      })

      const policyEval = guard.evaluateQuote({
        agentId: 'dipto-sandbox-agent',
        provider: quoteProvider.trim(),
        amountUsdc: quoteAmount,
        estimatedLatencySeconds: slaHours * 3600,
      })

      const nowSec = Math.floor(Date.now() / 1000)
      const deadlineUnix = BigInt(nowSec + slaHours * 3600)
      const simulatedTs = deadlineUnix + BigInt(Math.max(0, Math.round(simulatedDelayHours * 3600)))

      const commitment = canonicalEscrowHash(
        `dipto-dryrun-${nowSec}`,
        '0x1111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222',
        parseUnits(String(Math.max(0.01, quoteAmount)), 18),
        deadlineUnix,
      )

      let registryExists = false
      try {
        registryExists = (await publicClient().readContract({
          address: REGISTRY_CONTRACT_ADDRESS,
          abi: [
            {
              name: 'canonicalHashes',
              type: 'function',
              stateMutability: 'view',
              inputs: [{ type: 'bytes32' }],
              outputs: [{ type: 'bool' }],
            },
          ] as const,
          functionName: 'canonicalHashes',
          args: [commitment],
        })) as boolean
      } catch {
        registryExists = false
      }

      let tecdOutcome: DryRunOutcome['onChainTecd']
      try {
        const onChain = await diptos.previewTECDPayoutOnChain({
          amountWei: parseUnits(String(Math.max(0.01, quoteAmount)), 18),
          deadlineUnix,
          simulatedTimestamp: simulatedTs,
          lambdaBps: BigInt(Math.round(lambda * 10_000)),
        })
        tecdOutcome = {
          payeePayoutUsdc: Number(formatEther(onChain.payeePayout)),
          buyerRebateUsdc: Number(formatEther(onChain.payerRebate)),
          protocolFeeUsdc: Number(formatEther(onChain.protocolFee)),
          decayPercent: Number(onChain.decayBps) / 100,
          source: 'arc-eth-call',
        }
      } catch {
        const local = diptos.calculateTECD({
          principalUsdc: quoteAmount,
          lambda,
          delaySeconds: simulatedDelayHours * 3600,
          totalDurationSeconds: slaHours * 3600,
          gamma: 1.5,
        })
        tecdOutcome = {
          payeePayoutUsdc: local.payeePayoutUsdc,
          buyerRebateUsdc: local.buyerRebateUsdc,
          protocolFeeUsdc: local.protocolFeeUsdc,
          decayPercent: local.decayPercent,
          source: 'sdk-wad',
        }
      }

      setDryRun({
        policy: policyEval,
        onChainTecd: tecdOutcome,
        registryCommitmentUnique: !registryExists,
        canonicalHash: commitment,
      })
    } catch (err) {
      setDryRunError((err as Error).message || 'Invalid JSON policy')
    } finally {
      setRunning(false)
    }
  }, [policyText, quoteAmount, quoteProvider, simulatedDelayHours])

  useEffect(() => {
    void runLiveDryRun()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 h-[72px] border-b border-white/10 bg-black/92 backdrop-blur-xl">
        <div className="mx-auto flex h-full max-w-[1280px] items-center justify-between gap-4 px-5 lg:px-8">
          <div className="flex items-center gap-3">
            <a
              href={getApexUrl()}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-white/15 bg-[#111111] px-3 font-mono text-[12px] text-[#A3A3A3] transition-colors hover:border-lime hover:text-lime"
            >
              <ArrowLeft className="size-3.5" strokeWidth={1.5} />
              diptos.xyz
            </a>
            <div className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap">
              <span className="rwa-display text-[20px] tracking-[-0.03em] text-white">
                DIPTOS<span className="ml-0.5 inline-block size-2 rounded-full bg-lime" />
              </span>
              <span className="text-white/25">/</span>
              <span className="font-mono text-[13px] font-medium text-[#A3A3A3]">Agents</span>
            </div>
            {pulse.blockNumber && (
              <span className="hidden whitespace-nowrap font-mono text-[12px] text-[#A3A3A3] sm:inline">
                Arc #{pulse.blockNumber.toString()}
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            <a
              href={getSdkUrl()}
              className="hidden h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-white/20 px-4 font-mono text-[12px] text-white transition-colors hover:border-lime hover:text-lime sm:inline-flex"
            >
              SDK <ArrowUpRight className="size-3.5" strokeWidth={1.5} />
            </a>
            <a
              href={getAppUrl()}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-lime px-4.5 font-mono text-[12px] font-semibold text-ink transition-colors hover:bg-[#d8ff4d]"
            >
              Launch App <ArrowRight className="size-3.5" strokeWidth={1.75} />
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-5 pt-16 pb-24 lg:px-8">
        {/* Hero */}
        <section className="max-w-3xl">
          <p className="rwa-hud text-lime">@DIPTOS/AGENT-GUARD // X402</p>
          <h1 className="rwa-display mt-4 text-[clamp(2.2rem,4.6vw,3.9rem)] leading-[1.04] text-white">
            GIVE AI AGENTS A USDC BUDGET THAT ONLY UNLOCKS ON VERIFIED OUTPUT.
          </h1>
          <p className="mt-5 text-[16px] leading-relaxed text-[#A3A3A3]">
            Upgrade blind HTTP 402 (<code className="font-mono text-white">x402</code>) agent payments into a 4-step
            non-custodial pipeline on Arc &amp; Base: <strong className="text-white">Quote → Lock USDC → Verify
            Proof → Release in &lt;1s or Auto-Rebate</strong>. Agents never touch private keys.
          </p>
        </section>

        {/* Top 6 Compact Morpho-Style Cards (Alternating Graphite / White / Lime) */}
        <section className="mt-12" aria-label="How agent.diptos.xyz works">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {AGENT_CAPABILITIES.map((card) => (
              <DiptosCard
                key={card.title}
                variant={card.variant}
                icon={card.icon}
                title={card.title}
                subtitle={card.subtitle}
              />
            ))}
          </div>
        </section>

        {/* Interactive Policy & x402 Sandbox (Strict Black / White / Lime) */}
        <section className="mt-20 grid gap-6 lg:grid-cols-12">
          <div className="rounded-[12px] border border-white/10 bg-[#111111] p-6 lg:col-span-7">
            <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3.5">
              <h2 className="font-mono text-[13px] font-semibold uppercase tracking-[0.04em] text-white">
                Policy &amp; x402 Dry-Run Sandbox
              </h2>
              <span className="font-mono text-[12px] text-[#A3A3A3]">previewTECDPayout()</span>
            </div>

            <textarea
              rows={11}
              value={policyText}
              onChange={(e) => setPolicyText(e.target.value)}
              spellCheck={false}
              aria-label="Agent policy JSON"
              className="mt-4 w-full rounded-[10px] border border-white/15 bg-black p-4 font-mono text-[13px] leading-relaxed text-white outline-none focus:border-lime"
            />

            <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
              <label className="block font-mono text-[12px]">
                <span className="uppercase text-[#A3A3A3]">Quote (USDC)</span>
                <input
                  type="number"
                  min={0.01}
                  step="1"
                  value={quoteAmount}
                  onChange={(e) => setQuoteAmount(Math.max(0.01, Number(e.target.value) || 0))}
                  className="mt-1.5 h-10 w-full rounded-lg border border-white/15 bg-black px-3 text-[13.5px] text-white outline-none focus:border-lime"
                />
              </label>
              <label className="block font-mono text-[12px]">
                <span className="uppercase text-[#A3A3A3]">Provider Host</span>
                <input
                  type="text"
                  value={quoteProvider}
                  onChange={(e) => setQuoteProvider(e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-lg border border-white/15 bg-black px-3 text-[13.5px] text-white outline-none focus:border-lime"
                />
              </label>
              <label className="block font-mono text-[12px]">
                <span className="uppercase text-[#A3A3A3]">Delay (Hours)</span>
                <input
                  type="number"
                  min={0}
                  max={72}
                  value={simulatedDelayHours}
                  onChange={(e) => setSimulatedDelayHours(Math.max(0, Number(e.target.value) || 0))}
                  className="mt-1.5 h-10 w-full rounded-lg border border-white/15 bg-black px-3 text-[13.5px] text-white outline-none focus:border-lime"
                />
              </label>
            </div>

            {dryRunError && (
              <p className="mt-3 rounded-lg border border-white/25 bg-black px-3.5 py-2.5 font-mono text-[12.5px] text-white">
                {dryRunError}
              </p>
            )}

            <button
              type="button"
              onClick={() => void runLiveDryRun()}
              disabled={running}
              className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-full bg-lime font-mono text-[13px] font-bold tracking-[0.03em] text-ink transition-colors hover:bg-[#d8ff4d] disabled:opacity-60"
            >
              <Play className="size-4" strokeWidth={1.75} />
              {running ? 'Running Dry-Run…' : 'Run Dry-Run'}
            </button>
          </div>

          {/* Right: Dry-Run Verdict Card */}
          <div className="flex flex-col justify-between rounded-[12px] border border-white/10 bg-[#111111] p-6 lg:col-span-5">
            <div>
              <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3.5">
                <h2 className="font-mono text-[13px] font-semibold uppercase tracking-[0.04em] text-white">
                  Dry-Run Verdict
                </h2>
                <span className="font-mono text-[11.5px] text-[#A3A3A3]">READ-ONLY ARC RPC</span>
              </div>

              {!dryRun ? (
                <div className="mt-6 rounded-[10px] border border-white/10 bg-black p-5 font-mono text-[13px] text-[#A3A3A3]">
                  Evaluating policy against <code className="text-white">DiptosEscrow.previewTECDPayout()</code> and{' '}
                  <code className="text-white">DiptosRegistry</code>…
                </div>
              ) : (
                <div className="mt-5 space-y-4 font-mono text-[13px]">
                  <div
                    className={`rounded-[10px] border p-4 ${
                      dryRun.policy.allowed
                        ? 'border-lime bg-lime text-ink'
                        : 'border-white/25 bg-black text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold uppercase tracking-[0.03em]">
                      {dryRun.policy.allowed ? (
                        <ShieldCheck className="size-4" strokeWidth={2} />
                      ) : (
                        <ShieldAlert className="size-4" strokeWidth={1.75} />
                      )}
                      <span>Verdict: {dryRun.policy.decision.replace(/_/g, ' ')}</span>
                    </div>
                    <p
                      className={`mt-1.5 text-[12.5px] ${
                        dryRun.policy.allowed ? 'text-black/80' : 'text-[#A3A3A3]'
                      }`}
                    >
                      {dryRun.policy.reason}
                    </p>
                  </div>

                  <dl className="space-y-2.5 rounded-[10px] border border-white/10 bg-black p-4 tabular-nums">
                    <div className="flex justify-between">
                      <dt className="text-[#A3A3A3]">Payee Payout</dt>
                      <dd className="font-semibold text-white">{fmtAmount(dryRun.onChainTecd.payeePayoutUsdc)} USDC</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-[#A3A3A3]">Auto Buyer Rebate</dt>
                      <dd
                        className={`font-semibold ${
                          dryRun.onChainTecd.buyerRebateUsdc > 0 ? 'text-lime' : 'text-white'
                        }`}
                      >
                        {fmtAmount(dryRun.onChainTecd.buyerRebateUsdc)} USDC
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-[#A3A3A3]">Protocol Fee (0.5%)</dt>
                      <dd className="text-white">{fmtAmount(dryRun.onChainTecd.protocolFeeUsdc)} USDC</dd>
                    </div>
                    <div className="flex justify-between border-t border-white/10 pt-2.5">
                      <dt className="text-[#A3A3A3]">TECD Source</dt>
                      <dd className="uppercase text-white">{dryRun.onChainTecd.source}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-[#A3A3A3]">Registry Commitment</dt>
                      <dd className="text-lime">
                        {dryRun.registryCommitmentUnique ? 'Unique' : 'Already Exists'}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-[#A3A3A3]">Canonical Hash</dt>
                      <dd className="text-white">{shortHex(dryRun.canonicalHash, 10, 6)}</dd>
                    </div>
                  </dl>
                </div>
              )}
            </div>

            <div className="mt-5 border-t border-white/10 pt-4 font-mono text-[12px] text-[#A3A3A3]">
              Contract:{' '}
              <a
                href={explorerUrl('address', ESCROW_CONTRACT_ADDRESS)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white hover:text-lime hover:underline"
              >
                {shortHex(ESCROW_CONTRACT_ADDRESS, 10, 8)} ↗
              </a>
            </div>
          </div>
        </section>

        {/* Live Agent Settlement Feed */}
        <section className="mt-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="rwa-hud text-lime">LIVE ON-CHAIN AGENT FEED</p>
              <h2 className="rwa-display mt-2 text-[26px] text-white sm:text-[32px]">
                AUTONOMOUS AI AGENT ESCROWS.
              </h2>
            </div>
            <span className="font-mono text-[13px] text-[#A3A3A3]">
              {agentEscrows.length} on-chain escrow{agentEscrows.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="mt-6">
            {loading && agentEscrows.length === 0 ? (
              <div className="rounded-[12px] border border-white/10 bg-[#111111] px-5 py-4 font-mono text-[13px] text-[#A3A3A3]">
                Syncing live AI agent escrows from DiptosEscrow.sol…
              </div>
            ) : agentEscrows.length === 0 ? (
              <div className="rounded-[12px] border border-white/10 bg-[#111111] px-5 py-4 font-mono text-[13px] text-[#A3A3A3]">
                No AI agent escrows indexed yet on Arc Testnet.
              </div>
            ) : (
              <div className="divide-y divide-white/10 overflow-hidden rounded-[12px] border border-white/10 bg-[#0E0E0E]">
                {agentEscrows.map((esc) => {
                  const isSettled = esc.status.toLowerCase() === 'settled'
                  return (
                    <div
                      key={esc.id}
                      className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-[#141414]"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2.5">
                          {isSettled && <DiptosVerifiedBadge size="xs" />}
                          <p className="truncate text-[15px] font-semibold text-white">
                            {esc.title || shortHex(esc.id, 10, 6)}
                          </p>
                        </div>
                        <p className="mt-1 font-mono text-[12.5px] text-[#A3A3A3]">
                          {fmtAmount(esc.amountUsdc)} USDC · <span className="normal-case">λ</span> ={' '}
                          {esc.tecdLambda.toFixed(2)} · {shortHex(esc.escrowIdBytes32, 10, 6)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2.5 font-mono text-[12px]">
                        <a
                          href={explorerUrl('address', ESCROW_CONTRACT_ADDRESS)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-white/20 px-3.5 text-white transition-colors hover:border-lime hover:text-lime"
                        >
                          ArcScan <ArrowUpRight className="size-3.5" strokeWidth={1.5} />
                        </a>
                        <a
                          href={getPayUrl(esc.id)}
                          className="inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-lime px-4 font-semibold text-ink transition-colors hover:bg-[#d8ff4d]"
                        >
                          {isSettled ? 'Receipt' : 'Open'}
                        </a>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
