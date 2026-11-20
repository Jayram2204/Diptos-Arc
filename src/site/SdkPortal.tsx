import { useState } from 'react'
import { ArrowLeft, ArrowUpRight, Play, Terminal } from 'lucide-react'
import { Button, CopyButton, PulseDot } from '@/components/ui'
import {
  ARC_CHAIN_ID,
  ARC_RPC_URL,
  ESCROW_CONTRACT_ADDRESS,
  REGISTRY_CONTRACT_ADDRESS,
} from '@/config/protocol'
import { getApexUrl, getAppUrl } from '@/lib/route'
import { diptos } from '@/lib/sdk'

type SectionId = 'quickstart' | 'agents' | 'tecd' | 'gemini' | 'grok' | 'abis'

const SECTIONS: {
  id: SectionId
  num: string
  label: string
  title: string
  summary: string
  filename: string
  paramsNote: string
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
    paramsNote: 'Config: rpcUrl, chainId (5042002), escrowAddress, registryAddress',
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
    paramsNote: 'Returns: { escrow, txIntent, checkoutPath, shareUrl }',
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
    paramsNote: 'Invariant: payeePayout + buyerRebate + protocolFee === principalUsdc',
    code: `const onChain = await diptos.previewTECDOnChain({
  principalUsdc: 2500,
  slaWindowSeconds: 24 * 3600,
  delaySeconds: 12 * 3600,
  lambda: 0.35,
})

console.log({
  source: onChain.source,
  payeePayoutUsdc: onChain.payeePayoutUsdc,
  buyerRebateUsdc: onChain.buyerRebateUsdc,
  protocolFeeUsdc: onChain.protocolFeeUsdc,
  decayPercent: onChain.decayPercent,
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
    paramsNote: 'Endpoint: GET /api/risk/gemini -> api.gemini.com',
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
      'Submit a GitHub PR or live URL for structured evidence verification and replay-protected EIP-712 signing.',
    filename: 'grok-verify.ts',
    paramsNote: 'Domain: DiptosEscrow v2 · Chain ID 5042002 · ReleaseMilestone',
    code: `const audit = await diptos.verifyDeliverableWithGrok({
  escrowId: escrow.escrowIdBytes32,
  scope: escrow.scope,
  deliverableUrl: 'https://github.com/Jayram2204/Diptos-Arc',
})

if (audit.approved && audit.eip712Signature) {
  const releaseTx = diptos.buildReleaseWithOracleTx({
    escrowId: escrow.escrowIdBytes32,
    milestoneIndex: audit.milestoneIndex ?? 0,
    deliverableHash: audit.deliverableHash,
    expectedNonce: audit.nonce ?? 0,
    grokSignature: audit.eip712Signature,
  })
  console.log('Ready to broadcast releaseWithOracle:', releaseTx)
}`,
  },
  {
    id: 'abis',
    num: '06',
    label: 'Contract ABIs',
    title: 'Direct Viem ABI Exports & Dual Decimals',
    summary:
      'Import typed ABIs and convert between 18-decimal native Arc USDC and 6-decimal ERC-20 USDC.',
    filename: 'abis.ts',
    paramsNote: 'Exports: DIPTOS_ESCROW_ABI, DIPTOS_REGISTRY_ABI, ARC_TESTNET',
    code: `import {
  ARC_TESTNET,
  DIPTOS_ESCROW_ABI,
  DIPTOS_REGISTRY_ABI,
  nativeUsdcTo6Decimals,
  usdc6ToNativeWei,
} from '@diptos/sdk'

const wei = usdc6ToNativeWei(250_000_000n) // 250 USDC -> 250e18 wei
console.log('Arc Chain ID:', ARC_TESTNET.id, 'Wei:', wei.toString())`,
  },
]

export function SdkPortal() {
  const [activeId, setActiveId] = useState<SectionId>('quickstart')
  const [running, setRunning] = useState(false)
  const [output, setOutput] = useState<string>(
    '// Click "Run Live" to query Arc Testnet (5042002), Gemini Prediction Markets, and the EIP-712 Oracle.',
  )

  const current = SECTIONS.find((s) => s.id === activeId) ?? SECTIONS[0]

  const runLiveSdk = async () => {
    setRunning(true)
    try {
      const [telemetry, geminiRisk, oracleStatus, escrows] = await Promise.allSettled([
        diptos.getArcTelemetry(),
        diptos.getLiveGeminiRisk(),
        diptos.getOracleStatus(),
        diptos.listEscrows(0, 5),
      ])

      const payload = {
        executedAt: new Date().toISOString(),
        package: '@diptos/sdk@1.0.0',
        section: current.id,
        arcTelemetry:
          telemetry.status === 'fulfilled'
            ? {
                chainId: telemetry.value.chainId,
                rpcUrl: telemetry.value.rpcUrl,
                blockNumber: telemetry.value.blockNumber.toString(),
                gasPriceWei: telemetry.value.gasPrice.toString(),
                latencyMs: telemetry.value.latencyMs,
              }
            : { error: (telemetry.reason as Error)?.message },
        onChainEscrowsCount: escrows.status === 'fulfilled' ? escrows.value.length : 0,
        oracleStatus:
          oracleStatus.status === 'fulfilled'
            ? {
                oracleSigner: oracleStatus.value.oracleSigner,
                verifyingContract: oracleStatus.value.eip712Domain.verifyingContract,
                latestArcBlock: oracleStatus.value.latestArcBlock,
              }
            : { error: (oracleStatus.reason as Error)?.message },
        geminiRisk:
          geminiRisk.status === 'fulfilled'
            ? {
                volatilityIndex: geminiRisk.value.volatilityIndex,
                recommendedLambda: geminiRisk.value.recommendedLambda,
                topContract: geminiRisk.value.contracts[0] ?? null,
              }
            : { error: (geminiRisk.reason as Error)?.message },
      }
      setOutput(JSON.stringify(payload, null, 2))
    } catch (e) {
      setOutput(JSON.stringify({ error: (e as Error).message }, null, 2))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#090A0D] text-[#F4F2EC]">
      {/* Header (68px) */}
      <header className="sticky top-0 z-50 h-[68px] border-b border-white/[0.08] bg-[#090A0D]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-full max-w-[1360px] items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-4">
            <a
              href={getApexUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/15 px-3 font-mono text-[11px] uppercase tracking-[0.12em] text-secondary transition-all duration-200 hover:bg-white/[0.06] hover:text-[#F4F2EC]"
            >
              <ArrowLeft className="size-3.5" />
              diptos.xyz
            </a>
            <span className="rwa-display inline-flex items-baseline text-[17px] text-[#F4F2EC]">
              SDK.DIPTOS<span className="ml-1 inline-block size-1.5 rounded-full bg-emerald" />
            </span>
            <span className="hidden rounded-full border border-white/[0.08] bg-[#111318] px-3 py-0.5 font-mono text-[10.5px] text-secondary sm:inline-block">
              @diptos/sdk@1.0.0 · npm
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <a
              href="https://www.npmjs.com/package/@diptos/sdk"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden h-9 items-center gap-1 rounded-full border border-white/15 px-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-secondary transition-colors hover:bg-white/[0.06] hover:text-[#F4F2EC] sm:inline-flex"
            >
              npmjs.com <ArrowUpRight className="size-3.5" />
            </a>
            <a
              href={getAppUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#F4F2EC] px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-[#090A0D] transition-all duration-200 hover:bg-white"
            >
              Launch App <ArrowUpRight className="size-3.5" />
            </a>
          </div>
        </div>
      </header>

      {/* Symmetrical 12-Column Equal-Height 3-Panel Grid */}
      <main className="mx-auto max-w-[1360px] px-6 py-8">
        <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
          {/* Left Rail (3 cols) */}
          <aside className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#111318] p-5 lg:col-span-3">
            <div>
              <p className="rwa-hud px-2 text-secondary">SDK MODULES</p>
              <ul className="mt-3 space-y-1">
                {SECTIONS.map((s) => {
                  const active = s.id === activeId
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setActiveId(s.id)}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left font-mono text-[11.5px] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                          active
                            ? 'bg-white/[0.08] font-medium text-[#F4F2EC]'
                            : 'text-secondary hover:bg-white/[0.03] hover:text-[#F4F2EC]'
                        }`}
                      >
                        <span className="text-[10.5px] text-secondary">{s.num}</span>
                        <span className="truncate">{s.label}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>

            <div className="mt-6 border-t border-white/[0.08] pt-4">
              <p className="rwa-hud text-secondary">INSTALL FROM NPM</p>
              <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-[#090A0D] px-3 py-2">
                <code className="truncate font-mono text-[11px] text-[#F4F2EC]">
                  npm i @diptos/sdk viem
                </code>
                <CopyButton value="npm install @diptos/sdk viem" label="Copy install command" />
              </div>
            </div>
          </aside>

          {/* Center Code Card (5 cols) */}
          <section className="flex min-h-[540px] flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#111318] lg:col-span-5">
            <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4">
              <div>
                <p className="font-mono text-[11px] text-secondary">
                  {current.num} // {current.filename}
                </p>
                <h1 className="mt-0.5 text-[16px] font-semibold text-[#F4F2EC]">{current.title}</h1>
              </div>
              <CopyButton value={current.code} label="Copy snippet" />
            </div>

            <div className="border-b border-white/[0.06] bg-[#090A0D]/40 px-6 py-3 text-[13px] text-secondary">
              {current.summary}
            </div>

            <pre className="flex-1 overflow-auto bg-[#090A0D] p-6 font-mono text-[12px] leading-relaxed text-[#F4F2EC]">
              <code>{current.code}</code>
            </pre>

            <div className="border-t border-white/[0.08] px-6 py-3 font-mono text-[11px] text-secondary">
              {current.paramsNote}
            </div>
          </section>

          {/* Right Execution Console (4 cols) */}
          <section className="flex min-h-[540px] flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#111318] lg:col-span-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4">
              <div className="flex items-center gap-2">
                <Terminal className="size-4 text-secondary" />
                <span className="rwa-hud text-[#F4F2EC]">LIVE SDK CONSOLE</span>
              </div>
              <Button size="sm" variant="primary" loading={running} onClick={() => void runLiveSdk()}>
                <Play className="size-3" /> Run Live
              </Button>
            </div>

            <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#090A0D]/40 px-6 py-2.5 font-mono text-[10.5px] text-secondary">
              <span className="inline-flex items-center gap-1.5">
                <PulseDot color="bg-emerald" />
                Arc RPC + Gemini + Oracle
              </span>
              <span>Chain 5042002</span>
            </div>

            <pre className="flex-1 overflow-auto bg-[#090A0D] p-6 font-mono text-[11.5px] leading-relaxed text-emerald">
              {output}
            </pre>

            <div className="border-t border-white/[0.08] px-6 py-3 font-mono text-[10.5px] text-secondary">
              Contracts: {ESCROW_CONTRACT_ADDRESS.slice(0, 10)}… · {REGISTRY_CONTRACT_ADDRESS.slice(0, 10)}…
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
