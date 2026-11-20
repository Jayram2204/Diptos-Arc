import { useState } from 'react'
import { ArrowLeft, ArrowUpRight, Check, Copy, LoaderCircle, Play, Terminal } from 'lucide-react'
import { CopyButton, PulseDot } from '@/components/ui'
import { ARC_NETWORK, ESCROW_CONTRACT_ADDRESS, LINKS, REGISTRY_CONTRACT_ADDRESS } from '@/config/protocol'
import { getApexUrl, getAppUrl } from '@/lib/route'
import { diptos } from '@/lib/sdk'

interface SdkModule {
  id: string
  num: string
  title: string
  subtitle: string
  file: string
  params: { name: string; type: string; desc: string }[]
  code: string
}

const MODULES: SdkModule[] = [
  {
    id: 'quickstart',
    num: '01',
    title: 'Quickstart',
    subtitle: 'Instantiate DiptosClient on Arc Testnet (5042002)',
    file: 'client.ts',
    params: [
      { name: 'rpcUrl', type: 'string', desc: 'Arc Testnet JSON-RPC endpoint (https://rpc.testnet.arc.network)' },
      { name: 'escrowContract', type: 'Address', desc: `Deployed DiptosEscrow (${ESCROW_CONTRACT_ADDRESS.slice(0, 10)}…)` },
    ],
    code: `import { DiptosClient } from '@diptos/sdk'

const diptos = new DiptosClient({
  rpcUrl: 'https://rpc.testnet.arc.network',
  apiBaseUrl: 'https://diptos.xyz',
  escrowContract: '${ESCROW_CONTRACT_ADDRESS}',
  registryContract: '${REGISTRY_CONTRACT_ADDRESS}',
})

// Fetch live Arc block height, USDC gas price, and Gemini risk λ
const [telemetry, risk] = await Promise.all([
  diptos.getArcTelemetry(),
  diptos.getLiveGeminiRisk(),
])

console.log('Arc Block:', telemetry.blockNumber)
console.log('Calibrated TECD λ:', risk.recommendedLambda)`,
  },
  {
    id: 'guardrails',
    num: '02',
    title: 'AI Agent Guardrails',
    subtitle: 'Build non-custodial USDC escrow transactions for autonomous agents',
    file: 'agent-escrow.ts',
    params: [
      { name: 'amountUsdc', type: 'number', desc: 'Native 18-decimal USDC principal locked in DiptosEscrow.sol' },
      { name: 'isAgentMode', type: 'boolean', desc: 'Enables autonomous EIP-712 Grok settlement guardrail' },
    ],
    code: `import { keccak256, toHex } from 'viem'

const escrowId = keccak256(toHex('diptos:arc:5042002:agent_task_01'))

// Build native 18-dec USDC deposit tx (msg.value == amountWei)
const fundTx = diptos.buildFundEscrowTx({
  escrowId,
  payee: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  amountUsdc: 1250,
  deadlineUnix: Math.floor(Date.now() / 1000) + 86400,
  lambdaBps: 3500, // λ = 0.35
  isAgentMode: true,
})

const txHash = await walletClient.sendTransaction(fundTx)`,
  },
  {
    id: 'tecd',
    num: '03',
    title: 'TECD Math',
    subtitle: 'Fixed-point WAD exponential latency decay V(t) = V₀ · e^(−λ·(Δt/T)^γ)',
    file: 'tecd-decay.ts',
    params: [
      { name: 'lambda', type: 'number', desc: 'Decay rate λ calibrated from Gemini Prediction Markets' },
      { name: 'delaySeconds', type: 'number', desc: 'Seconds elapsed past SLA deadline T (0 if on-time)' },
    ],
    code: `// Deterministic local WAD calculation + live Arc eth_call verification
const local = diptos.calculateTECD({
  principalUsdc: 5000,
  lambda: 0.38,
  delaySeconds: 6 * 3600,        // 6 hours overdue
  totalDurationSeconds: 24 * 3600,
  gamma: 1.5,
})

console.log('Payee Instant Payout:', local.payeePayoutUsdc, 'USDC')
console.log('Automatic Buyer Rebate:', local.buyerRebateUsdc, 'USDC')
console.log('Protocol Fee (0.5%):', local.protocolFeeUsdc, 'USDC')`,
  },
  {
    id: 'gemini',
    num: '04',
    title: 'Gemini Risk Oracle',
    subtitle: 'Calibrate TECD λ from live Gemini Prediction Markets event probabilities',
    file: 'gemini-oracle.ts',
    params: [
      { name: 'volatilityIndex', type: 'number', desc: 'Weighted macro uncertainty index ∈ [0, 1]' },
      { name: 'recommendedLambda', type: 'number', desc: 'Calibrated TECD decay parameter λ ∈ [0.18, 0.95]' },
    ],
    code: `// Pull live Gemini Prediction Markets contracts & calibrated λ
const gemini = await diptos.getLiveGeminiRisk()

for (const market of gemini.contracts) {
  console.log(
    market.instrumentSymbol,
    market.title,
    'YES:',
    Math.round(market.yesProbability * 100) + '%'
  )
}

console.log('Volatility Index:', gemini.volatilityIndex)
console.log('Recommended TECD λ:', gemini.recommendedLambda)`,
  },
  {
    id: 'grok',
    num: '05',
    title: 'Grok Verifier',
    subtitle: 'Audit GitHub PRs or URLs and obtain an EIP-712 MilestoneApproval signature',
    file: 'grok-verifier.ts',
    params: [
      { name: 'deliverableUrl', type: 'string', desc: 'GitHub PR or live deployment URL inspected by Grok AI' },
      { name: 'eip712Signature', type: 'Hex', desc: '65-byte ECDSA signature verified by DiptosEscrow.sol' },
    ],
    code: `// 1. Request Grok AI audit & EIP-712 MilestoneApproval signature
const receipt = await diptos.verifyDeliverableWithGrok({
  escrowId,
  title: 'Arc Native USDC Checkout & Foundry Suite',
  scope: 'All Foundry tests pass and contract verified on ArcScan',
  amountUsdc: 1250,
  deliverableUrl: 'https://github.com/Jayram2204/Diptos-Arc/pull/1',
})

// 2. Settle atomically on Arc Testnet with Grok signature
if (receipt.approved && receipt.eip712Signature) {
  const settleTx = diptos.buildReleaseWithOracleTx({
    escrowId,
    milestoneIndex: 0,
    deliverableHash: receipt.deliverableHash,
    nonce: receipt.nonce,
    grokSignature: receipt.eip712Signature,
  })
  await walletClient.sendTransaction(settleTx)
}`,
  },
  {
    id: 'abis',
    num: '06',
    title: 'Contract ABIs',
    subtitle: 'Typed Viem ABIs for DiptosEscrow.sol and DiptosRegistry.sol',
    file: 'contracts.ts',
    params: [
      { name: 'DIPTOS_ESCROW_ABI', type: 'Abi', desc: `DiptosEscrow on Arc (${ESCROW_CONTRACT_ADDRESS})` },
      { name: 'DIPTOS_REGISTRY_ABI', type: 'Abi', desc: `DiptosRegistry on Arc (${REGISTRY_CONTRACT_ADDRESS})` },
    ],
    code: `import {
  ARC_TESTNET_CHAIN_ID,
  DIPTOS_ESCROW_ABI,
  DIPTOS_REGISTRY_ABI,
} from '@diptos/sdk'

// Direct typed contract reads with Viem publicClient
const [feeBps, totalRegistered] = await Promise.all([
  publicClient.readContract({
    address: '${ESCROW_CONTRACT_ADDRESS}',
    abi: DIPTOS_ESCROW_ABI,
    functionName: 'protocolFeeBps',
  }),
  publicClient.readContract({
    address: '${REGISTRY_CONTRACT_ADDRESS}',
    abi: DIPTOS_REGISTRY_ABI,
    functionName: 'totalEscrows',
  }),
])`,
  },
]

export function SdkPortal() {
  const [activeId, setActiveId] = useState<string>(MODULES[0].id)
  const [installCopied, setInstallCopied] = useState(false)
  const [running, setRunning] = useState(false)
  const [consoleOutput, setConsoleOutput] = useState<string>(() =>
    JSON.stringify(
      {
        package: '@diptos/sdk@1.0.0',
        chainId: ARC_NETWORK.chainId,
        network: ARC_NETWORK.label,
        contracts: {
          DiptosEscrow: ESCROW_CONTRACT_ADDRESS,
          DiptosRegistry: REGISTRY_CONTRACT_ADDRESS,
        },
        status: 'Ready — click "Run Live" to query Arc Testnet RPC & Oracles',
      },
      null,
      2,
    ),
  )

  const activeModule = MODULES.find((m) => m.id === activeId) ?? MODULES[0]

  const runLiveSdk = async () => {
    setRunning(true)
    try {
      const [telemetry, gemini, oracle, escrows] = await Promise.all([
        diptos.getArcTelemetry(),
        diptos.getLiveGeminiRisk(),
        diptos.getOracleStatus().catch(() => null),
        diptos.listEscrows().catch(() => []),
      ])
      const tecd = diptos.calculateTECD({
        principalUsdc: 2500,
        lambda: gemini.recommendedLambda,
        delaySeconds: 4 * 3600,
        totalDurationSeconds: 24 * 3600,
        gamma: 1.5,
      })
      setConsoleOutput(
        JSON.stringify(
          {
            timestamp: new Date().toISOString(),
            module: activeModule.id,
            arcTelemetry: {
              chainId: telemetry.chainId,
              blockNumber: telemetry.blockNumber.toString(),
              gasPriceWei: telemetry.gasPrice.toString(),
              rpcLatencyMs: telemetry.latencyMs,
            },
            geminiRiskOracle: {
              source: gemini.source,
              volatilityIndex: gemini.volatilityIndex,
              recommendedLambda: gemini.recommendedLambda,
              activeMarkets: gemini.contracts.length,
            },
            grokOracleSigner: oracle?.oracleSigner ?? '0x344d7adf93542C6c27a11bb53A2d7C9d909D9f34',
            onChainEscrowsCount: escrows.length,
            tecdSimulation2500Usdc4hLate: {
              payeePayoutUsdc: tecd.payeePayoutUsdc,
              buyerRebateUsdc: tecd.buyerRebateUsdc,
              protocolFeeUsdc: tecd.protocolFeeUsdc,
              decayPercent: tecd.decayPercent,
            },
          },
          null,
          2,
        ),
      )
    } catch (e) {
      setConsoleOutput(
        JSON.stringify(
          {
            error: (e as Error).message,
            hint: 'Verify Arc Testnet RPC connectivity (https://rpc.testnet.arc.network)',
          },
          null,
          2,
        ),
      )
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-paper">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 h-[68px] border-b border-paper/10 bg-black/90 backdrop-blur-xl">
        <div className="mx-auto flex h-full max-w-[1360px] items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-3.5">
            <a
              href={getApexUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-paper/15 bg-surface px-3 font-mono text-[11px] uppercase tracking-[0.12em] text-secondary transition-colors hover:border-lime hover:text-lime"
            >
              <ArrowLeft className="size-3.5" />
              <span className="hidden sm:inline">diptos.xyz</span>
            </a>

            <span className="rwa-display inline-flex items-baseline text-[18px] tracking-[-0.04em] text-paper">
              SDK.DIPTOS<span className="ml-0.5 inline-block size-2 rounded-full bg-lime" />
            </span>

            <span className="hidden items-center gap-2 rounded-full border border-paper/12 bg-surface px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-secondary md:inline-flex">
              <PulseDot color="bg-lime" />
              @diptos/sdk v1.0.0 • Arc 5042002
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <a
              href="https://www.npmjs.com/package/@diptos/sdk"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden h-9 items-center gap-1.5 rounded-full border border-paper/20 bg-transparent px-4 font-mono text-[11px] uppercase tracking-[0.12em] text-paper transition-colors hover:border-lime hover:text-lime sm:inline-flex"
            >
              NPM REGISTRY <ArrowUpRight className="size-3.5" />
            </a>
            <a
              href={getAppUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-lime px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ink transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-[1.02] hover:bg-[#d8ff4d]"
            >
              Launch App <ArrowUpRight className="size-3.5" />
            </a>
          </div>
        </div>
      </header>

      {/* Symmetrical 12-Column Equal-Height 3-Panel Grid */}
      <main className="mx-auto max-w-[1360px] px-6 py-8">
        <div className="mb-6 flex flex-col justify-between gap-4 border-b border-paper/10 pb-5 sm:flex-row sm:items-end">
          <div>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-lime">
              TYPESCRIPT SDK // VIEM + EIP-712 + FIXED-POINT WAD TECD
            </p>
            <h1 className="rwa-display mt-1 text-[24px] uppercase text-paper sm:text-[30px]">
              @DIPTOS/SDK INTERACTIVE ARCHITECTURE LAB
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-secondary">
            <span>DiptosEscrow: {ESCROW_CONTRACT_ADDRESS.slice(0, 10)}…</span>
            <span>•</span>
            <a
              href={LINKS.explorer}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-lime hover:underline"
            >
              ArcScan <ArrowUpRight className="size-3" />
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
          {/* Left Rail (lg:col-span-3): Equal-Height Vertical Module Index */}
          <aside className="rwa-depth-card flex flex-col justify-between rounded-2xl p-5 lg:col-span-3">
            <div>
              <p className="px-2 font-mono text-[10px] uppercase tracking-[0.14em] text-lime">
                SDK MODULES (01–06)
              </p>
              <nav className="mt-3 space-y-1.5" aria-label="SDK Modules">
                {MODULES.map((m) => {
                  const active = m.id === activeModule.id
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setActiveId(m.id)}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-all duration-200 ${
                        active
                          ? 'border border-lime/40 bg-lime/12 text-paper'
                          : 'border border-transparent text-secondary hover:bg-white/[0.04] hover:text-paper'
                      }`}
                    >
                      <span className="font-mono text-[12px] font-medium">
                        <span className="mr-2 text-lime">{m.num}</span>
                        {m.title}
                      </span>
                      <span className="font-mono text-[10px] text-secondary">{m.file}</span>
                    </button>
                  )
                })}
              </nav>
            </div>

            {/* Bottom npm install copy box */}
            <div className="mt-6 border-t border-paper/10 pt-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-secondary">
                INSTALL FROM NPM
              </p>
              <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-paper/12 bg-black/60 px-3 py-2.5 font-mono text-[11.5px] text-paper">
                <span className="truncate">npm i @diptos/sdk viem</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText('npm install @diptos/sdk viem')
                    setInstallCopied(true)
                    setTimeout(() => setInstallCopied(false), 1600)
                  }}
                  aria-label="Copy npm install command"
                  className="text-secondary transition-colors hover:text-lime"
                >
                  {installCopied ? <Check className="size-3.5 text-lime" /> : <Copy className="size-3.5" />}
                </button>
              </div>
            </div>
          </aside>

          {/* Center Code Card (lg:col-span-5): Equal-Height Code + Parameter Footer */}
          <section className="rwa-depth-card flex h-full min-h-[540px] flex-col overflow-hidden rounded-2xl lg:col-span-5">
            <div className="flex items-center justify-between gap-2 border-b border-paper/10 px-5 py-3.5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-semibold text-lime">
                    {activeModule.num} / {activeModule.file}
                  </span>
                </div>
                <p className="mt-0.5 text-[12px] text-secondary">{activeModule.subtitle}</p>
              </div>
              <CopyButton value={activeModule.code} label="Copy snippet" />
            </div>

            <pre className="flex-1 overflow-auto p-6 font-mono text-[12px] leading-relaxed text-paper/95">
              <code>{activeModule.code}</code>
            </pre>

            {/* Bottom Parameter Reference Footer */}
            <div className="border-t border-paper/10 bg-black/60 px-5 py-3.5">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-lime">
                KEY PARAMETERS &amp; TYPES
              </p>
              <dl className="mt-2 space-y-1.5 font-mono text-[11px]">
                {activeModule.params.map((p) => (
                  <div key={p.name} className="flex flex-wrap items-baseline justify-between gap-2">
                    <dt className="text-paper">
                      {p.name} <span className="text-lime">({p.type})</span>
                    </dt>
                    <dd className="text-right text-[10.5px] text-secondary">{p.desc}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          {/* Right Execution Console (lg:col-span-4): Equal-Height Live JSON Telemetry Pane */}
          <section className="rwa-depth-card flex h-full min-h-[540px] flex-col overflow-hidden rounded-2xl lg:col-span-4">
            <div className="flex items-center justify-between gap-2 border-b border-paper/10 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <Terminal className="size-3.5 text-lime" />
                <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-paper">
                  LIVE SDK CONSOLE
                </span>
              </div>
              <button
                type="button"
                onClick={() => void runLiveSdk()}
                disabled={running}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-lime px-3.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink transition-all duration-200 hover:bg-[#d8ff4d] disabled:opacity-50"
              >
                {running ? <LoaderCircle className="size-3 animate-spin" /> : <Play className="size-3" />}
                Run Live
              </button>
            </div>

            <pre className="flex-1 overflow-auto p-6 font-mono text-xs leading-relaxed text-paper/90">
              <code>{consoleOutput}</code>
            </pre>

            <div className="flex items-center justify-between border-t border-paper/10 bg-black/60 px-5 py-3 font-mono text-[10.5px] text-secondary">
              <span>RPC: rpc.testnet.arc.network</span>
              <span className="inline-flex items-center gap-1.5 text-lime">
                <span className="size-1.5 rounded-full bg-lime" />
                LIVE 5042002
              </span>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
