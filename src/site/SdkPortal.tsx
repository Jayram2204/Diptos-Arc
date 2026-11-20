import { useState } from 'react'
import { ArrowLeft, ArrowUpRight, Play, Terminal } from 'lucide-react'
import { Button, CopyButton, PulseDot } from '@/components/ui'
import { ARC_CHAIN_ID, ARC_RPC_URL, ESCROW_CONTRACT_ADDRESS, REGISTRY_CONTRACT_ADDRESS } from '@/config/protocol'
import { getApexUrl, getAppUrl, navigate } from '@/lib/route'
import { diptos } from '@/lib/sdk'

type SectionId = 'quickstart' | 'agents' | 'tecd' | 'gemini' | 'grok' | 'abis'

const SECTIONS: {
  id: SectionId
  num: string
  label: string
  title: string
  summary: string
  filename: string
  code: string
}[] = [
  {
    id: 'quickstart',
    num: '01',
    label: 'Quickstart',
    title: 'Initialize DiptosClient on Arc Testnet',
    summary:
      'Install @diptos/sdk and point DiptosClient at Arc Testnet (Chain ID 5042002) with primary + fallback RPCs.',
    filename: 'client.ts',
    code: `import { DiptosClient } from '@diptos/sdk'

export const diptos = new DiptosClient({
  rpcUrl: '${ARC_RPC_URL}',
  chainId: ${ARC_CHAIN_ID},
  escrowAddress: '${ESCROW_CONTRACT_ADDRESS}',
  registryAddress: '${REGISTRY_CONTRACT_ADDRESS}',
  apiBaseUrl: 'https://diptos.xyz',
})

const telemetry = await diptos.getArcTelemetry()
console.log('Arc block:', telemetry.blockNumber, 'latency:', telemetry.latencyMs, 'ms')`,
  },
  {
    id: 'agents',
    num: '02',
    label: 'AI Agent Guardrails',
    title: 'Autonomous Escrow Creation & Settlement',
    summary:
      'Headless AI agents can originate escrows, build native 18-decimal USDC calldata, verify deliverables via Grok, and settle on-chain.',
    filename: 'agent-guardrail.ts',
    code: `const risk = await diptos.getLiveGeminiRisk()
const { escrow, shareUrl } = await diptos.createEscrowLink({
  title: 'Audit Solidity TECD invariant bounds',
  scope: 'Submit merged GitHub PR passing forge test -vvv',
  amountUsdc: 0.05,
  deadlineHours: 24,
  mode: 'agent',
  tecdLambda: risk.recommendedLambda,
})

const fundTx = diptos.buildFundEscrowTx({
  escrowId: escrow.escrowIdBytes32,
  payee: escrow.payee,
  amountUsdc: escrow.amountUsdc,
  deadlineUnix: escrow.deadlineUnix,
  lambdaBps: escrow.tecdLambdaBps,
  isAgentMode: true,
})
console.log('Share checkout:', shareUrl, 'calldata:', fundTx.data)`,
  },
  {
    id: 'tecd',
    num: '03',
    label: 'TECD Math',
    title: 'Time-Entropic Collateral Decay (WAD)',
    summary:
      'Evaluate V(t) = V₀ · exp(-λ · (Δt / T)^1.5) locally or directly via DiptosEscrow.previewTECDPayout on Arc Testnet.',
    filename: 'tecd.ts',
    code: `const local = diptos.calculateTECD({
  principalUsdc: 2500,
  lambda: 0.35,
  delaySeconds: 12 * 3600,
  totalDurationSeconds: 24 * 3600,
  gamma: 1.5,
})

console.log({
  payeePayoutUsdc: local.payeePayoutUsdc,
  buyerRebateUsdc: local.buyerRebateUsdc,
  protocolFeeUsdc: local.protocolFeeUsdc,
  decayPercent: local.decayPercent,
})`,
  },
  {
    id: 'gemini',
    num: '04',
    label: 'Gemini Risk Oracle',
    title: 'Live Prediction Markets Volatility Feed',
    summary:
      'Pull active contracts from Gemini Prediction Markets to dynamically calibrate TECD decay intensity λ.',
    filename: 'gemini-risk.ts',
    code: `const risk = await diptos.getLiveGeminiRisk()

console.log('Volatility index:', risk.volatilityIndex)
console.log('Recommended lambda:', risk.recommendedLambda)
for (const c of risk.contracts) {
  console.log(c.instrumentSymbol, 'YES:', Math.round(c.yesProbability * 100) + '%')
}`,
  },
  {
    id: 'grok',
    num: '05',
    label: 'Grok Verifier',
    title: 'Deliverable Audit & EIP-712 Attestation',
    summary:
      'Submit a GitHub PR or live URL to Grok AI for structured verification and replay-protected EIP-712 signing.',
    filename: 'grok-verify.ts',
    code: `const audit = await diptos.verifyDeliverableWithGrok({
  escrowId: escrow.escrowIdBytes32,
  scope: escrow.scope,
  deliverableUrl: 'https://github.com/Jayram2204/Diptos-Arc/pull/1',
})

if (audit.approved && audit.eip712Signature) {
  const releaseTx = diptos.buildReleaseWithOracleTx({
    escrowId: escrow.escrowIdBytes32,
    milestoneIndex: audit.milestoneIndex ?? 0,
    deliverableHash: audit.deliverableHash,
    nonce: audit.nonce ?? 0,
    grokSignature: audit.eip712Signature,
  })
  console.log('Ready to broadcast releaseWithOracle:', releaseTx.data)
}`,
  },
  {
    id: 'abis',
    num: '06',
    label: 'Contract ABIs',
    title: 'DiptosEscrow & DiptosRegistry ABIs',
    summary:
      'Import canonical viem ABIs and Arc Testnet chain definitions directly from @diptos/sdk.',
    filename: 'abis.ts',
    code: `import {
  ARC_TESTNET,
  DIPTOS_ESCROW_ABI,
  DIPTOS_REGISTRY_ABI,
} from '@diptos/sdk'

// Chain ID: 5042002 | Native USDC (18 decimals)
console.log(ARC_TESTNET.id, DIPTOS_ESCROW_ABI.length, DIPTOS_REGISTRY_ABI.length)`,
  },
]

export function SdkPortal() {
  const [activeId, setActiveId] = useState<SectionId>('quickstart')
  const [running, setRunning] = useState(false)
  const [output, setOutput] = useState<string | null>(null)
  const [runError, setRunError] = useState<string | null>(null)

  const current = SECTIONS.find((s) => s.id === activeId) ?? SECTIONS[0]

  const runLiveConsole = async () => {
    setRunning(true)
    setRunError(null)
    try {
      const [telemetry, geminiRisk, oracle] = await Promise.allSettled([
        diptos.getArcTelemetry(),
        diptos.getLiveGeminiRisk(),
        diptos.getOracleStatus(),
      ])

      const payload = {
        executedAt: new Date().toISOString(),
        package: '@diptos/sdk',
        arcTelemetry:
          telemetry.status === 'fulfilled'
            ? {
                chainId: telemetry.value.chainId,
                rpcUrl: ARC_RPC_URL,
                blockNumber: telemetry.value.blockNumber.toString(),
                gasPriceWei: telemetry.value.gasPrice.toString(),
                latencyMs: telemetry.value.latencyMs,
              }
            : { error: (telemetry.reason as Error)?.message ?? 'RPC unreachable' },
        geminiRisk:
          geminiRisk.status === 'fulfilled'
            ? geminiRisk.value
            : { error: (geminiRisk.reason as Error)?.message ?? 'Gemini API unreachable' },
        oracleStatus:
          oracle.status === 'fulfilled'
            ? {
                oracleSigner: oracle.value.oracleSigner,
                totalAttestationsSigned: oracle.value.totalAttestationsSigned,
                latestArcBlock: oracle.value.latestArcBlock,
              }
            : { error: (oracle.reason as Error)?.message ?? 'Oracle status unavailable' },
      }
      setOutput(JSON.stringify(payload, null, 2))
    } catch (e) {
      setRunError((e as Error).message)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-paper">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 h-[72px] border-b border-paper/10 bg-black/90 backdrop-blur-xl">
        <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between gap-4 px-5 sm:px-8">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate(getApexUrl())}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-paper/15 px-3 font-mono text-[11px] uppercase tracking-[0.12em] text-secondary transition-colors hover:border-lime hover:text-lime"
            >
              <ArrowLeft className="size-3.5" />
              diptos.xyz
            </button>
            <span className="rwa-display hidden items-baseline text-[18px] text-paper sm:inline-flex">
              SDK.DIPTOS<span className="ml-0.5 inline-block size-1.5 rounded-full bg-lime" />
            </span>
            <span className="hidden items-center gap-2 rounded-full border border-paper/12 bg-surface px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-secondary md:inline-flex">
              <PulseDot color="bg-lime" /> @DIPTOS/SDK v1.0.0
            </span>
          </div>

          <button
            type="button"
            onClick={() => navigate(getAppUrl())}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-lime px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ink transition-colors hover:bg-[#d8ff4d]"
          >
            LAUNCH APP <ArrowUpRight className="size-3.5" />
          </button>
        </div>
      </header>

      {/* Full-Viewport Developer Portal */}
      <div className="mx-auto grid max-w-[1440px] lg:grid-cols-[240px_1fr_420px]">
        {/* Left Rail Navigation */}
        <aside className="border-b border-paper/10 p-6 lg:min-h-[calc(100vh-72px)] lg:border-b-0 lg:border-r">
          <p className="rwa-hud text-lime">DOCUMENTATION</p>
          <ul className="mt-4 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-1">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(s.id)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left font-mono text-[11.5px] transition-colors ${
                    activeId === s.id
                      ? 'bg-lime/12 font-semibold text-lime'
                      : 'text-secondary hover:bg-surface hover:text-paper'
                  }`}
                >
                  <span className="text-[10px] opacity-70">{s.num}</span>
                  <span>{s.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Center Code Documentation */}
        <main className="border-b border-paper/10 p-6 sm:p-10 lg:border-b-0 lg:border-r">
          <p className="rwa-hud text-lime">
            {current.num} // {current.label}
          </p>
          <h1 className="rwa-display mt-3 text-[28px] text-paper sm:text-[34px]">{current.title}</h1>
          <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-secondary">{current.summary}</p>

          <div className="mt-8 overflow-hidden rounded-lg border border-paper/12 bg-surface">
            <div className="flex items-center justify-between border-b border-paper/10 px-4 py-2.5">
              <span className="font-mono text-[11px] text-secondary">{current.filename}</span>
              <CopyButton value={current.code} label={`Copy ${current.filename}`} />
            </div>
            <pre className="overflow-x-auto p-5 font-mono text-[12px] leading-relaxed text-paper">
              <code>{current.code}</code>
            </pre>
          </div>
        </main>

        {/* Right Live @diptos/sdk Execution Console */}
        <aside className="flex flex-col p-6">
          <div className="flex items-center justify-between gap-3 border-b border-paper/10 pb-4">
            <div className="flex items-center gap-2">
              <Terminal className="size-4 text-lime" />
              <div>
                <p className="font-mono text-[12px] font-semibold uppercase tracking-[0.1em] text-paper">
                  Live SDK Console
                </p>
                <p className="font-mono text-[10px] text-secondary">Arc RPC + /api/risk/gemini</p>
              </div>
            </div>
            <Button size="sm" variant="primary" loading={running} onClick={runLiveConsole}>
              {!running && <Play className="size-3.5" />}
              Run Live
            </Button>
          </div>

          {runError && (
            <p className="mt-4 rounded-lg border border-crimson/40 bg-crimson/10 px-3 py-2 font-mono text-[11px] text-crimson">
              {runError}
            </p>
          )}

          <div className="mt-4 flex-1 overflow-hidden rounded-lg border border-paper/12 bg-surface">
            <div className="flex items-center justify-between border-b border-paper/10 px-3.5 py-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-lime">
                {output ? 'Live JSON Response' : 'Awaiting Execution'}
              </span>
              {output && <CopyButton value={output} label="Copy JSON response" />}
            </div>
            <pre className="max-h-[540px] overflow-auto p-4 font-mono text-[11px] leading-relaxed text-paper">
              <code>
                {output ??
                  '// Click "Run Live" to execute:\n// 1. diptos.getArcTelemetry()\n// 2. diptos.getLiveGeminiRisk()\n// 3. diptos.getOracleStatus()'}
              </code>
            </pre>
          </div>
        </aside>
      </div>
    </div>
  )
}
