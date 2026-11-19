import { useEffect, useState } from 'react'
import { Code2, Menu, Plus, X } from 'lucide-react'
import { Wordmark } from '@/components/Logo'
import { CopyButton, PulseDot } from '@/components/ui'
import { ARC_NETWORK } from '@/config/protocol'
import { useArcPulse } from '@/lib/hooks'
import { navigate } from '@/lib/route'

const NAV_LINKS = [
  { id: 'how-it-works', label: 'How It Works' },
  { id: 'architecture', label: 'Live Sandbox' },
  { id: 'tecd-risk', label: 'TECD & Risk' },
  { id: 'registry', label: 'Arc Contracts' },
] as const

const SDK_SNIPPET = `import { createDiptosClient } from '@diptos/sdk'

const diptos = createDiptosClient({
  apiBaseUrl: 'https://diptos.xyz',
  escrowContract: '${ARC_NETWORK.chainId === 5042002 ? '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' : ''}',
})

const risk = await diptos.getLiveGeminiRisk()
const { escrow, shareUrl } = await diptos.createEscrowLink({
  title: 'Audit Solidity TECD math',
  scope: 'Submit PR passing forge test with zero reverts',
  amountUsdc: 250,
  deadlineHours: 24,
  mode: 'agent',
  tecdLambda: risk.recommendedLambda,
})

const audit = await diptos.verifyDeliverableWithGrok({
  escrowId: escrow.id,
  deliverableUrl: 'https://github.com/org/repo/pull/12',
})
if (audit.approved) {
  await diptos.settleEscrowOnArc({
    escrowId: escrow.id,
    grokSignature: audit.signature,
    deliverableHash: audit.deliverableHash,
    walletClient,
  })
}`

export function Header() {
  const pulse = useArcPulse(6000)
  const [menuOpen, setMenuOpen] = useState(false)
  const [sdkOpen, setSdkOpen] = useState(false)

  useEffect(() => {
    if (!sdkOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSdkOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sdkOpen])

  const focusCreator = () => {
    setMenuOpen(false)
    navigate('/')
    requestAnimationFrame(() => {
      const el = document.getElementById('create-escrow-title')
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        ;(el as HTMLInputElement).focus()
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    })
  }

  return (
    <>
      <header className="sticky top-0 z-50 h-16 border-b border-white/[0.08] bg-[#090A0D]/90 backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-[1280px] items-center justify-between gap-4 px-4 sm:px-6">
          {/* Left: Logo + Verified Arc Testnet Badge */}
          <div className="flex items-center gap-3">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault()
                navigate('/')
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              aria-label="Diptos home"
            >
              <Wordmark />
            </a>
            <span
              className="hidden items-center gap-2 rounded-md border border-white/[0.08] bg-surface px-2.5 py-1 font-mono text-[11px] text-primary sm:inline-flex"
              title={
                pulse.blockNumber !== undefined
                  ? `Arc Testnet live block #${pulse.blockNumber.toLocaleString('en-US')}`
                  : 'Arc Testnet (Chain ID 5042002)'
              }
            >
              <PulseDot color="bg-emerald" />
              <span>Arc Testnet • 5042002</span>
            </span>
          </div>

          {/* Center: 4 Clean Anchor Links */}
          <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary">
            {NAV_LINKS.map((l) => (
              <a
                key={l.id}
                href={`#${l.id}`}
                className="text-[13px] font-medium text-secondary transition-colors hover:text-primary"
              >
                {l.label}
              </a>
            ))}
          </nav>

          {/* Right: SDK Docs + Create Escrow Link */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setSdkOpen(true)}
              className="hidden h-9 items-center gap-1.5 rounded-lg border border-white/[0.1] bg-transparent px-3.5 text-[13px] font-medium text-primary transition-colors hover:border-white/[0.22] sm:inline-flex"
            >
              <Code2 className="size-3.5 text-secondary" />
              SDK Docs
            </button>
            <button
              type="button"
              onClick={focusCreator}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gold px-3.5 text-[13px] font-bold text-canvas transition-colors hover:bg-[#edb955]"
            >
              <Plus className="size-3.5 stroke-[2.5]" />
              <span>Create Escrow Link</span>
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Toggle navigation"
              aria-expanded={menuOpen}
              className="grid size-9 place-items-center rounded-lg border border-white/[0.08] text-primary lg:hidden"
            >
              {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="border-b border-white/[0.08] bg-[#090A0D]/95 px-4 pb-4 pt-2 backdrop-blur-md lg:hidden">
            <ul className="grid gap-1">
              {NAV_LINKS.map((l) => (
                <li key={l.id}>
                  <a
                    href={`#${l.id}`}
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-lg px-3 py-2 text-sm text-primary hover:bg-surface"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    setSdkOpen(true)
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-secondary hover:bg-surface hover:text-primary"
                >
                  <Code2 className="size-4" />
                  SDK Docs (@diptos/sdk)
                </button>
              </li>
            </ul>
          </nav>
        )}
      </header>

      {sdkOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="sdk-modal-title"
          className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setSdkOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-[10px] border border-white/[0.12] bg-surface p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] pb-4">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-gold">@diptos/sdk • TypeScript</p>
                <h2 id="sdk-modal-title" className="mt-1 text-xl font-semibold text-primary">
                  Autonomous AI Agent Payment Guardrails
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSdkOpen(false)}
                aria-label="Close SDK Docs"
                className="grid size-8 place-items-center rounded-lg border border-white/[0.08] text-secondary hover:text-primary"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="mt-4 text-[13px] text-secondary">
              Programmatically originate Arc Testnet (`5042002`) escrows, calibrate TECD decay with Gemini Prediction
              Markets, verify deliverables via Grok AI, and execute atomic settlement in 10 lines.
            </p>
            <div className="mt-4 overflow-hidden rounded-lg border border-white/[0.08] bg-canvas">
              <div className="flex items-center justify-between border-b border-white/[0.08] px-3.5 py-2">
                <span className="font-mono text-[11px] text-secondary">agent-guardrail.ts</span>
                <CopyButton value={SDK_SNIPPET} label="Copy SDK snippet" />
              </div>
              <pre className="max-h-[360px] overflow-auto p-4 font-mono text-[11.5px] leading-relaxed text-primary">
                <code>{SDK_SNIPPET}</code>
              </pre>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
