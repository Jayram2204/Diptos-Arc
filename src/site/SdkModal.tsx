import { useEffect, useState } from 'react'
import { Play, Terminal, X } from 'lucide-react'
import { Button, CopyButton } from '@/components/ui'
import { ARC_CHAIN_ID, ARC_RPC_URL, ESCROW_CONTRACT_ADDRESS, REGISTRY_CONTRACT_ADDRESS } from '@/config/protocol'
import { diptos } from '@/lib/sdk'

const SDK_SNIPPET = `import { DiptosClient } from '@diptos/sdk'

const diptos = new DiptosClient({
  rpcUrl: '${ARC_RPC_URL}',
  chainId: ${ARC_CHAIN_ID},
  escrowAddress: '${ESCROW_CONTRACT_ADDRESS}',
  registryAddress: '${REGISTRY_CONTRACT_ADDRESS}',
  apiBaseUrl: 'https://diptos.xyz',
})

// 1. Fetch live Arc telemetry & Gemini Prediction Markets TECD risk
const [telemetry, risk] = await Promise.all([
  diptos.getArcTelemetry(),
  diptos.getLiveGeminiRisk(),
])

// 2. Originate programmable escrow link & build Arc tx payload
const { escrow, shareUrl } = await diptos.createEscrowLink({
  title: 'Audit Solidity TECD math',
  scope: 'Submit PR passing forge test with zero reverts',
  amountUsdc: 250,
  deadlineHours: 24,
  mode: 'agent',
  tecdLambda: risk.recommendedLambda,
})
const fundTx = diptos.buildFundEscrowTx({
  escrowId: escrow.id,
  payee: escrow.payee,
  amountUsdc: escrow.amountUsdc,
  deadlineUnix: escrow.deadlineUnix,
  lambdaBps: escrow.tecdLambdaBps,
  isAgentMode: true,
})

// 3. Verify deliverable via Grok AI & settle atomically on Arc
const audit = await diptos.verifyDeliverableWithGrok({
  escrowId: escrow.id,
  deliverableUrl: 'https://github.com/org/repo/pull/12',
})`

export function SdkModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [running, setRunning] = useState(false)
  const [output, setOutput] = useState<string | null>(null)
  const [runError, setRunError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const runLiveSdk = async () => {
    setRunning(true)
    setRunError(null)
    try {
      const [telemetry, geminiRisk] = await Promise.allSettled([
        diptos.getArcTelemetry(),
        diptos.getLiveGeminiRisk(),
      ])

      const payload = {
        executedAt: new Date().toISOString(),
        sdk: '@diptos/sdk',
        arcTelemetry:
          telemetry.status === 'fulfilled'
            ? {
                chainId: telemetry.value.chainId,
                rpcUrl: ARC_RPC_URL,
                blockNumber: telemetry.value.blockNumber.toString(),
                blockTimestamp: telemetry.value.blockTimestamp.toString(),
                gasPriceWei: telemetry.value.gasPrice.toString(),
                latencyMs: telemetry.value.latencyMs,
              }
            : { error: (telemetry.reason as Error)?.message ?? 'Arc RPC unreachable' },
        geminiRisk:
          geminiRisk.status === 'fulfilled'
            ? geminiRisk.value
            : { error: (geminiRisk.reason as Error)?.message ?? 'Gemini API unreachable' },
      }
      setOutput(JSON.stringify(payload, null, 2))
    } catch (e) {
      setRunError((e as Error).message)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sdk-drawer-title"
      className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-2xl flex-col border-l border-white/[0.1] bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] px-6 py-5">
          <div>
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-gold">
              @diptos/sdk • Live Playground &amp; Docs
            </p>
            <h2 id="sdk-drawer-title" className="mt-1 text-[20px] font-semibold text-primary">
              Autonomous AI Agent &amp; Escrow SDK
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close SDK drawer"
            className="grid size-8 place-items-center rounded-lg border border-white/[0.08] text-secondary hover:text-primary"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          <p className="text-[13px] leading-relaxed text-secondary">
            The same <span className="font-mono text-primary">@diptos/sdk</span> workspace package powering this
            interface can be imported by headless AI agents, backend workers, or browser wallets to originate Arc
            Testnet (<span className="font-mono text-primary">5042002</span>) escrows, calibrate TECD risk, and settle
            via Grok EIP-712 attestations.
          </p>

          {/* Code Block */}
          <div className="overflow-hidden rounded-[10px] border border-white/[0.08] bg-canvas">
            <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-2.5">
              <span className="font-mono text-[11px] text-secondary">agent-settlement.ts</span>
              <CopyButton value={SDK_SNIPPET} label="Copy @diptos/sdk example" />
            </div>
            <pre className="max-h-[300px] overflow-auto p-4 font-mono text-[11.5px] leading-relaxed text-primary">
              <code>{SDK_SNIPPET}</code>
            </pre>
          </div>

          {/* Live SDK Runner */}
          <div className="rounded-[10px] border border-white/[0.08] bg-elevated p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Terminal className="size-4 text-gold" />
                <div>
                  <p className="text-[13px] font-semibold text-primary">Live SDK Execution</p>
                  <p className="font-mono text-[11px] text-secondary">
                    diptos.getArcTelemetry() + diptos.getLiveGeminiRisk()
                  </p>
                </div>
              </div>
              <Button size="sm" variant="primary" loading={running} onClick={runLiveSdk} className="font-bold">
                {!running && <Play className="size-3.5" />}
                Run Live SDK Call
              </Button>
            </div>

            {runError && (
              <p className="mt-3 rounded-lg border border-crimson/35 bg-crimson/10 px-3 py-2 font-mono text-[11.5px] text-crimson">
                {runError}
              </p>
            )}

            {output && (
              <div className="mt-4 overflow-hidden rounded-lg border border-white/[0.08] bg-canvas">
                <div className="flex items-center justify-between border-b border-white/[0.08] px-3.5 py-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-emerald">
                    Live JSON Response
                  </span>
                  <CopyButton value={output} label="Copy live JSON output" />
                </div>
                <pre className="max-h-[260px] overflow-auto p-3.5 font-mono text-[11px] leading-relaxed text-primary">
                  <code>{output}</code>
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
