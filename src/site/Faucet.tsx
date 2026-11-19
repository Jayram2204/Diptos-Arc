import { useState } from 'react'
import { ArrowRight, ArrowUpRight, Droplets, Zap } from 'lucide-react'
import { Button, Eyebrow } from '@/components/ui'
import { LINKS } from '@/config/protocol'
import { useGeminiRisk } from '@/lib/hooks'
import { navigate } from '@/lib/route'
import { diptos } from '@/lib/sdk'

export function Faucet() {
  const { data: gemini } = useGeminiRisk()
  const [creating, setCreating] = useState(false)

  const handleQuickFund = async () => {
    setCreating(true)
    try {
      const res = await diptos.createEscrowLink({
        title: 'Quick Testnet Escrow Settlement (0.10 USDC)',
        scope: 'Verify Arc Testnet native USDC funding, Grok AI audit, and atomic EIP-712 release.',
        amountUsdc: 0.1,
        deadlineHours: 24,
        mode: 'human',
        tecdLambda: gemini?.recommendedLambda,
      })
      navigate(res.checkoutPath)
    } finally {
      setCreating(false)
    }
  }

  return (
    <section id="faucet" className="mx-auto max-w-[1280px] border-t border-white/[0.08] px-4 py-20 sm:px-6">
      <div className="max-w-2xl">
        <Eyebrow>Arc Testnet Faucet &amp; Sandbox Funding</Eyebrow>
        <h2 className="mt-3 text-[28px] font-semibold text-primary sm:text-[34px]">
          Claim native USDC and fund a live escrow in 60 seconds.
        </h2>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <div className="flex flex-col justify-between rounded-[10px] border border-white/[0.08] bg-surface p-6">
          <div>
            <span className="grid size-10 place-items-center rounded-lg border border-white/[0.08] bg-elevated text-emerald">
              <Droplets className="size-4" />
            </span>
            <h3 className="mt-4 text-[17px] font-semibold text-primary">Circle Arc Testnet Faucet</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-secondary">
              On Arc Testnet (<span className="font-mono text-primary">5042002</span>), native USDC powers both gas
              and atomic escrow settlement. Claim testnet USDC directly from Circle.
            </p>
          </div>
          <a
            href={LINKS.circleFaucet}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex h-10 items-center gap-1.5 self-start rounded-lg border border-white/[0.1] bg-elevated px-4 text-[13px] font-medium text-primary transition-colors hover:border-gold/50 hover:text-gold"
          >
            Open Circle Faucet <ArrowUpRight className="size-4" />
          </a>
        </div>

        <div className="flex flex-col justify-between rounded-[10px] border border-white/[0.08] bg-surface p-6">
          <div>
            <span className="grid size-10 place-items-center rounded-lg border border-white/[0.08] bg-elevated text-gold">
              <Zap className="size-4" />
            </span>
            <h3 className="mt-4 text-[17px] font-semibold text-primary">1-Click Test Escrow Funding</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-secondary">
              Spin up a live <span className="font-mono text-primary">0.10 USDC</span> checkout room via{' '}
              <span className="font-mono text-primary">diptos.createEscrowLink()</span> to test wallet funding,
              ElevenLabs audio briefs, and Grok AI verification end-to-end.
            </p>
          </div>
          <Button
            variant="primary"
            loading={creating}
            onClick={handleQuickFund}
            className="mt-6 self-start font-bold"
          >
            <span>Launch &amp; Fund Test Escrow</span>
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </section>
  )
}
