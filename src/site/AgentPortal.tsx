import {
  PolicyGuard,
  type QuoteEvaluationResult,
} from '@diptos/agent-guard'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Cpu,
  FileCheck2,
  Fingerprint,
  Gauge,
  Layers,
  Lock,
  Play,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Terminal,
} from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { formatEther, parseUnits } from 'viem'
import { DiptosVerifiedBadge } from '@/components/DiptosVerifiedBadge'
import { PulseDot } from '@/components/ui'
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

const JSON_TOKEN_REGEX =
  /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g

function renderHighlightedJson(source: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let key = 0

  for (const match of source.matchAll(JSON_TOKEN_REGEX)) {
    const idx = match.index ?? 0
    if (idx > lastIndex) {
      nodes.push(
        <span key={key++} className="text-[#8A8A90]">
          {source.slice(lastIndex, idx)}
        </span>,
      )
    }

    const token = match[0]
    const isKey = Boolean(match[2])
    let cls = 'text-[#FBBF24]' // numbers
    if (isKey) {
      cls = 'text-[#E5E7EB]'
    } else if (token.startsWith('"')) {
      cls = 'text-emerald'
    } else if (token === 'true' || token === 'false' || token === 'null') {
      cls = 'text-[#60A5FA]'
    }

    nodes.push(
      <span key={key++} className={cls}>
        {token}
      </span>,
    )
    lastIndex = idx + token.length
  }

  if (lastIndex < source.length) {
    nodes.push(
      <span key={key++} className="text-[#8A8A90]">
        {source.slice(lastIndex)}
      </span>,
    )
  }

  return nodes
}

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
  const [pillarFilter, setPillarFilter] = useState<'all' | 'live' | 'roadmap'>('all')

  const agentEscrows = useMemo(
    () =>
      [...escrows]
        .filter((e) => e.mode === 'agent')
        .sort((a, b) => Date.parse(b.createdAt || '0') - Date.parse(a.createdAt || '0')),
    [escrows],
  )

  const highlightedJson = useMemo(() => renderHighlightedJson(policyText), [policyText])

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
          abi: [{ name: 'canonicalHashes', type: 'function', stateMutability: 'view', inputs: [{ type: 'bytes32' }], outputs: [{ type: 'bool' }] }] as const,
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

  // Auto-run initial dry-run on mount so the Verdict Card is immediately populated with live checks
  useEffect(() => {
    void runLiveDryRun()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-black text-paper">
      {/* Header */}
      <header className="sticky top-0 z-50 h-[72px] border-b border-paper/10 bg-black/90 backdrop-blur-xl">
        <div className="mx-auto flex h-full max-w-[1280px] items-center justify-between gap-4 px-5 lg:px-8">
          <div className="flex items-center gap-3">
            <a
              href={getApexUrl()}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-paper/15 bg-surface px-3 font-mono text-[11px] uppercase tracking-[0.12em] text-secondary transition-colors hover:border-lime hover:text-lime"
            >
              <ArrowLeft className="size-3.5" />
              diptos.xyz
            </a>
            <div className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap">
              <span className="rwa-display text-[19px] tracking-[-0.04em] text-white">
                DIPTOS<span className="ml-0.5 inline-block size-2 rounded-full bg-lime" />
              </span>
              <span className="text-white/25">/</span>
              <span className="font-mono text-[12px] font-medium text-[#E5E7EB]">Dipto</span>
            </div>
            <span className="hidden items-center gap-1.5 whitespace-nowrap rounded-full border border-lime/35 bg-lime/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-lime sm:inline-flex">
              <PulseDot color="bg-lime" />
              agent.diptos.xyz {pulse.blockNumber ? `· Arc #${pulse.blockNumber.toString()}` : ''}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            <a
              href={getSdkUrl()}
              className="hidden h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-paper/20 px-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-paper transition-colors hover:border-lime hover:text-lime sm:inline-flex"
            >
              SDK <ArrowUpRight className="size-3" />
            </a>
            <a
              href={getAppUrl()}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-lime px-4 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-ink transition-colors hover:bg-[#d8ff4d]"
            >
              Launch App <ArrowRight className="size-3.5" />
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-5 pt-14 pb-24 lg:px-8">
        {/* Hero */}
        <section className="max-w-3xl">
          <p className="rwa-hud text-[#A1A1AA]">@DIPTOS/AGENT-GUARD // CIRCLE AGENT STACK + X402</p>
          <h1 className="rwa-display mt-4 text-[clamp(2.1rem,4.6vw,3.8rem)] leading-[1.05] text-white">
            GIVE AI AGENTS A USDC BUDGET THAT ONLY UNLOCKS ON VERIFIED OUTPUT.
          </h1>
          <p className="mt-5 text-[16px] leading-relaxed text-[#E5E7EB]">
            Dipto upgrades blind HTTP 402 (<code className="font-mono text-emerald">x402</code>) agent payments into a
            4-step non-custodial pipeline on Arc &amp; Base: <strong>Quote → Lock USDC → Verify Schema/Proof → Release
            in &lt;1s or Auto-Rebate via TECD</strong>. Agents never see private keys.
          </p>
        </section>

        {/* Interactive Policy & x402 Sandbox */}
        <section className="mt-12 grid gap-6 lg:grid-cols-12">
          <div className="rwa-depth-card rounded-2xl p-6 lg:col-span-7">
            <div className="flex items-center justify-between gap-2 border-b border-paper/10 pb-3.5">
              <div className="flex items-center gap-2">
                <Terminal className="size-4 text-[#E5E7EB]" />
                <h2 className="font-mono text-[12px] font-semibold uppercase tracking-[0.12em] text-white">
                  Interactive Policy &amp; x402 Dry-Run Sandbox
                </h2>
              </div>
              <span className="font-mono text-[10px] text-[#A1A1AA]">DiptosEscrow.previewTECDPayout()</span>
            </div>

            {/* Lightweight syntax-highlighted JSON editor (zero external bundle) */}
            <div className="relative mt-4 overflow-hidden rounded-xl border border-paper/15 bg-black/80 focus-within:border-lime">
              <pre
                aria-hidden="true"
                className="pointer-events-none min-h-[250px] whitespace-pre-wrap break-words p-3.5 font-mono text-[12px] leading-relaxed"
              >
                {highlightedJson}
                {'\n'}
              </pre>
              <textarea
                value={policyText}
                onChange={(e) => setPolicyText(e.target.value)}
                spellCheck={false}
                aria-label="Agent policy JSON"
                className="absolute inset-0 h-full w-full resize-none bg-transparent p-3.5 font-mono text-[12px] leading-relaxed text-transparent caret-lime outline-none selection:bg-lime/20"
              />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="block font-mono text-[10.5px]">
                <span className="uppercase text-[#A1A1AA]">Quote Amount (USDC)</span>
                <input
                  type="number"
                  min={0.01}
                  step="1"
                  value={quoteAmount}
                  onChange={(e) => setQuoteAmount(Math.max(0.01, Number(e.target.value) || 0))}
                  className="mt-1 h-9 w-full rounded-lg border border-paper/15 bg-elevated px-3 text-paper outline-none focus:border-lime"
                />
              </label>
              <label className="block font-mono text-[10.5px]">
                <span className="uppercase text-[#A1A1AA]">Provider Host</span>
                <input
                  type="text"
                  value={quoteProvider}
                  onChange={(e) => setQuoteProvider(e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-paper/15 bg-elevated px-3 text-paper outline-none focus:border-lime"
                />
              </label>
              <label className="block font-mono text-[10.5px]">
                <span className="uppercase text-[#A1A1AA]">Simulated Delay (H)</span>
                <input
                  type="number"
                  min={0}
                  max={72}
                  value={simulatedDelayHours}
                  onChange={(e) => setSimulatedDelayHours(Math.max(0, Number(e.target.value) || 0))}
                  className="mt-1 h-9 w-full rounded-lg border border-paper/15 bg-elevated px-3 text-paper outline-none focus:border-lime"
                />
              </label>
            </div>

            {dryRunError && (
              <p className="mt-3 rounded-xl border border-crimson/35 bg-crimson/10 px-3.5 py-2 font-mono text-[11.5px] text-crimson">
                {dryRunError}
              </p>
            )}

            <button
              type="button"
              onClick={() => void runLiveDryRun()}
              disabled={running}
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-full bg-lime font-mono text-[11.5px] font-bold uppercase tracking-[0.12em] text-ink transition-colors hover:bg-[#d8ff4d] disabled:opacity-60"
            >
              <Play className="size-4" />
              {running ? 'Running Live Arc Read-Only Dry-Run…' : 'Run Live Policy + Arc TECD Dry-Run'}
            </button>
          </div>

          {/* Right: Dry-Run Output */}
          <div className="rwa-depth-card flex flex-col justify-between rounded-2xl p-6 lg:col-span-5">
            <div>
              <div className="flex items-center justify-between gap-2 border-b border-paper/10 pb-3.5">
                <div className="flex items-center gap-2">
                  <Cpu className="size-4 text-[#E5E7EB]" />
                  <h2 className="font-mono text-[12px] font-semibold uppercase tracking-[0.12em] text-white">
                    Dry-Run Verdict &amp; On-Chain Math
                  </h2>
                </div>
                <span className="font-mono text-[10px] text-emerald">READ-ONLY ARC RPC</span>
              </div>

              {!dryRun ? (
                <div className="mt-6 rounded-xl border border-paper/10 bg-black/50 p-5 font-mono text-[12px] text-[#A1A1AA]">
                  Evaluating default policy against live{' '}
                  <code className="text-paper">DiptosEscrow.previewTECDPayout()</code> and{' '}
                  <code className="text-paper">DiptosRegistry</code> on Arc Testnet…
                </div>
              ) : (
                <div className="mt-5 space-y-4 font-mono text-[11.5px]">
                  <div
                    className={`rounded-xl border p-4 ${
                      dryRun.policy.allowed
                        ? 'border-emerald/45 bg-emerald/10 text-emerald'
                        : dryRun.policy.decision === 'require_human_approval'
                          ? 'border-[#FBBF24]/45 bg-[#FBBF24]/10 text-[#FBBF24]'
                          : 'border-crimson/45 bg-crimson/10 text-crimson'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold uppercase">
                      {dryRun.policy.allowed ? (
                        <ShieldCheck className="size-4" />
                      ) : (
                        <ShieldAlert className="size-4" />
                      )}
                      <span>POLICY VERDICT: {dryRun.policy.decision.replace(/_/g, ' ')}</span>
                    </div>
                    <p className="mt-1.5 text-[11px] opacity-90">{dryRun.policy.reason}</p>
                  </div>

                  <dl className="space-y-2 rounded-xl border border-paper/10 bg-black/50 p-4">
                    <div className="flex justify-between">
                      <dt className="text-[#A1A1AA]">Payee Payout</dt>
                      <dd className="font-bold text-emerald">{fmtAmount(dryRun.onChainTecd.payeePayoutUsdc)} USDC</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-[#A1A1AA]">Auto Buyer Rebate</dt>
                      <dd
                        className={`font-bold ${
                          dryRun.onChainTecd.buyerRebateUsdc > 0 ? 'text-[#FBBF24]' : 'text-paper'
                        }`}
                      >
                        {fmtAmount(dryRun.onChainTecd.buyerRebateUsdc)} USDC
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-[#A1A1AA]">Protocol Fee (0.5%)</dt>
                      <dd className="text-paper">{fmtAmount(dryRun.onChainTecd.protocolFeeUsdc)} USDC</dd>
                    </div>
                    <div className="flex justify-between border-t border-paper/10 pt-2">
                      <dt className="text-[#A1A1AA]">TECD Source</dt>
                      <dd className="uppercase text-emerald">{dryRun.onChainTecd.source}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-[#A1A1AA]">Registry Commitment</dt>
                      <dd className="text-emerald">
                        {dryRun.registryCommitmentUnique ? 'Unique (No Double-Spend)' : 'Already Exists'}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-[#A1A1AA]">Canonical Hash</dt>
                      <dd className="text-paper">{shortHex(dryRun.canonicalHash, 10, 6)}</dd>
                    </div>
                  </dl>
                </div>
              )}
            </div>

            <div className="mt-5 border-t border-paper/10 pt-4 font-mono text-[10.5px] text-[#A1A1AA]">
              Contract:{' '}
              <a
                href={explorerUrl('address', ESCROW_CONTRACT_ADDRESS)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-paper hover:text-lime hover:underline"
              >
                {shortHex(ESCROW_CONTRACT_ADDRESS, 10, 8)} ↗
              </a>
            </div>
          </div>
        </section>

        {/* AstraOS-Style Live 6-Pillar Architecture Section */}
        <section className="mt-16 border-t border-paper/12 pt-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <p className="rwa-hud text-[#A1A1AA]">LIVE PROTOCOL ARCHITECTURE // ZERO OVER-CLAIMING</p>
              <h2 className="rwa-display mt-2 text-[26px] text-white sm:text-[32px]">
                HOW DIPTOS LOCKS AGENT SPEND SAFELY.
              </h2>
              <p className="mt-2.5 text-[14px] leading-relaxed text-[#A1A1AA]">
                Every safeguard below clearly distinguishes what executes on-chain today on Arc Testnet (
                <code className="font-mono text-[#E5E7EB]">5042002</code>) versus standards we are aligned to on the
                roadmap.
              </p>
            </div>

            <div className="flex items-center gap-1.5 rounded-full border border-paper/15 bg-surface p-1 font-mono text-[10.5px]">
              {(
                [
                  ['all', 'All (6)'],
                  ['live', 'Live Today'],
                  ['roadmap', 'Standard-Aligned'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPillarFilter(id)}
                  className={`whitespace-nowrap rounded-full px-3 py-1 transition-colors ${
                    pillarFilter === id
                      ? 'bg-lime font-bold text-ink'
                      : 'text-[#A1A1AA] hover:text-paper'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                id: '01',
                icon: Lock,
                title: 'Non-Custodial On-Chain Rules',
                badge: 'LIVE TODAY',
                badgeKind: 'live' as const,
                summary:
                  'Funds sit in DiptosEscrow.sol—never in a Diptos wallet. Buyers and agents retain full self-custody with a permissionless claimTimeoutRefund() exit.',
                before: 'Before: Blind prepaid API keys or custodial escrow accounts.',
                after: `After: Deterministic escrow at ${shortHex(ESCROW_CONTRACT_ADDRESS, 6, 4)} (block ${
                  pulse.blockNumber ? `#${pulse.blockNumber.toString()}` : 'syncing'
                }).`,
              },
              {
                id: '02',
                icon: Gauge,
                title: 'Sub-Second Stablecoin Finality',
                badge: 'USDC LIVE · EURC ALIGNED',
                badgeKind: 'roadmap' as const,
                summary:
                  'Native 18-decimal USDC settles in <1s on Arc Testnet with Base USDC + x402 support. EURC multi-currency rail is standard-aligned for Circle expansion.',
                before: 'Before: T+2 card settlement and chargeback holds.',
                after: 'After: Atomic USDC finality in 1 block (~1.0s on Arc).',
              },
              {
                id: '03',
                icon: Layers,
                title: 'Low-Cost EVM & Programmatic Triggers',
                badge: 'LIVE TODAY',
                badgeKind: 'live' as const,
                summary:
                  'Predictable USDC-denominated gas on Arc removes ETH gas friction. @diptos/sdk and @diptos/agent-guard hook directly into HTTP 402 agent workflows.',
                before: 'Before: Agents stall on volatile gas tokens or manual invoicing.',
                after: 'After: Single-currency USDC gas + programmatic PolicyGuard.',
              },
              {
                id: '04',
                icon: Scale,
                title: 'Continuous & Milestone Decay (TECD)',
                badge: 'LIVE TODAY',
                badgeKind: 'live' as const,
                summary:
                  'Late delivery triggers exact on-chain WAD math (e^(-λ·(t/T)^1.5)), splitting principal into Payee Payout + Auto Buyer Rebate with zero-dust rounding.',
                before: 'Before: Binary disputes or manual Slack negotiations over delays.',
                after: `After: ${
                  dryRun
                    ? `Live preview → ${fmtAmount(dryRun.onChainTecd.payeePayoutUsdc)} payee / ${fmtAmount(
                        dryRun.onChainTecd.buyerRebateUsdc,
                      )} rebate.`
                    : 'Automatic cent-exact rebate on every late proof.'
                }`,
              },
              {
                id: '05',
                icon: Fingerprint,
                title: 'Verifiable Credentials & Agent Identity',
                badge: 'PROOF GATE LIVE · ERC-8004/8183 ROADMAP',
                badgeKind: 'roadmap' as const,
                summary:
                  'Hardware-pinned EIP-712 proof verification and DiptosRegistry anti-double-spend commitments run live today; ERC-8004 agent identity & ERC-8183 commerce interfaces are roadmap-aligned.',
                before: 'Before: Unverified agent calls with no replay protection.',
                after: `After: Canonical hash uniqueness verified on ${shortHex(REGISTRY_CONTRACT_ADDRESS, 6, 4)}.`,
              },
              {
                id: '06',
                icon: FileCheck2,
                title: 'Honest Real-World Enforceability',
                badge: 'LIVE TODAY · TRANSPARENT',
                badgeKind: 'live' as const,
                summary:
                  'On-chain scope commitments pair with plain-English acceptance terms. Unaudited testnet status, revokeOracleSigner(), and 1-hour velocity circuit breaker are disclosed openly.',
                before: 'Before: Black-box AI settlement claims hiding admin keys.',
                after: 'After: 34/34 Foundry tests passing + public risk disclosures.',
              },
            ]
              .filter((p) => (pillarFilter === 'all' ? true : p.badgeKind === pillarFilter))
              .map((pillar) => {
                const Icon = pillar.icon
                return (
                  <article
                    key={pillar.id}
                    className="rwa-depth-card flex flex-col justify-between rounded-2xl p-5"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="inline-flex size-8 items-center justify-center rounded-lg border border-paper/15 bg-black text-[#E5E7EB]">
                            <Icon className="size-4" />
                          </span>
                          <span className="font-mono text-[10.5px] text-[#8A8A90]">{pillar.id}</span>
                        </div>
                        <span
                          className={`rounded-full border px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.06em] ${
                            pillar.badgeKind === 'live'
                              ? 'border-emerald/40 bg-emerald/10 text-emerald'
                              : 'border-[#FBBF24]/40 bg-[#FBBF24]/10 text-[#FBBF24]'
                          }`}
                        >
                          {pillar.badge}
                        </span>
                      </div>

                      <h3 className="mt-4 text-[16px] font-semibold tracking-tight text-white">{pillar.title}</h3>
                      <p className="mt-2 text-[13px] leading-relaxed text-[#A1A1AA]">{pillar.summary}</p>
                    </div>

                    <div className="mt-4 space-y-1.5 border-t border-paper/10 pt-3 font-mono text-[10.5px]">
                      <p className="text-[#8A8A90]">{pillar.before}</p>
                      <p className="text-emerald">{pillar.after}</p>
                    </div>
                  </article>
                )
              })}
          </div>
        </section>

        {/* Live Agent Settlement Feed */}
        <section className="mt-16 border-t border-paper/12 pt-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="rwa-hud text-[#A1A1AA]">LIVE ON-CHAIN AGENT FEED // ARC TESTNET (5042002)</p>
              <h2 className="rwa-display mt-2 text-[26px] text-white sm:text-[32px]">
                AUTONOMOUS AI AGENT ESCROWS.
              </h2>
            </div>
            <span className="font-mono text-[11px] text-[#A1A1AA]">
              {agentEscrows.length} on-chain AI agent escrow{agentEscrows.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="mt-6 space-y-3">
            {loading && agentEscrows.length === 0 ? (
              <div className="rounded-xl border border-paper/10 bg-surface px-4 py-4 font-mono text-[12px] text-[#A1A1AA]">
                Syncing live AI agent escrows from DiptosEscrow.sol…
              </div>
            ) : agentEscrows.length === 0 ? (
              <div className="rounded-xl border border-paper/10 bg-surface px-5 py-4 font-mono text-[12px] text-[#A1A1AA]">
                No AI agent escrows indexed yet on Arc Testnet.
              </div>
            ) : (
              agentEscrows.map((esc) => {
                const isSettled = esc.status.toLowerCase() === 'settled'
                return (
                  <div
                    key={esc.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-paper/12 bg-surface px-5 py-4"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded border border-paper/15 bg-black px-2 py-0.5 font-mono text-[10px] font-semibold text-[#E5E7EB]">
                          <Bot className="size-3" /> AI AGENT
                        </span>
                        <p className="font-semibold text-white">{esc.title || shortHex(esc.id, 10, 6)}</p>
                        {isSettled && <DiptosVerifiedBadge size="xs" />}
                      </div>
                      <p className="mt-1 font-mono text-[11px] text-[#A1A1AA]">
                        {fmtAmount(esc.amountUsdc)} USDC · <span className="normal-case">λ</span> ={' '}
                        {esc.tecdLambda.toFixed(2)} · {shortHex(esc.escrowIdBytes32, 10, 6)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 font-mono text-[11px]">
                      <a
                        href={explorerUrl('address', ESCROW_CONTRACT_ADDRESS)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-paper/20 px-3 text-paper hover:border-lime hover:text-lime"
                      >
                        ArcScan <ArrowUpRight className="size-3" />
                      </a>
                      <a
                        href={getPayUrl(esc.id)}
                        className="inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-lime px-3.5 font-bold text-ink hover:bg-[#d8ff4d]"
                      >
                        {isSettled ? (
                          <>
                            <CheckCircle2 className="size-3.5" /> Receipt
                          </>
                        ) : (
                          'Open →'
                        )}
                      </a>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
