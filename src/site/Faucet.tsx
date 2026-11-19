import { ArrowUpRight, Droplets } from 'lucide-react'
import { Eyebrow, Reveal } from '@/components/ui'
import { ARC_NETWORK, LINKS } from '@/config/protocol'

export function Faucet() {
  return (
    <section id="faucet" className="border-t border-paper/10 bg-black py-24 lg:py-32">
      <div className="mx-auto max-w-[1380px] px-6 lg:px-10">
        <Reveal>
          <div className="rwa-depth-card flex flex-col justify-between gap-8 rounded-2xl p-8 lg:flex-row lg:items-center lg:p-12">
            <div className="max-w-2xl">
              <Eyebrow>NATIVE USDC GAS &amp; SETTLEMENT</Eyebrow>
              <h2 className="rwa-display mt-3 text-[clamp(1.8rem,3.2vw,2.8rem)] uppercase text-paper">
                FUND YOUR ARC TESTNET WALLET IN ONE CLICK.
              </h2>
              <p className="mt-3 text-[15px] text-secondary">
                On <span className="font-mono text-paper">{ARC_NETWORK.short}</span>, USDC is both the native gas token
                and the escrow settlement currency. Claim free testnet USDC from Circle&apos;s faucet and settle live.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <a
                href={LINKS.circleFaucet}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-lime px-7 font-mono text-[11.5px] font-semibold uppercase tracking-[0.14em] text-ink transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-[1.03] hover:bg-[#d8ff4d]"
              >
                <Droplets className="size-4" /> CIRCLE ARC FAUCET <ArrowUpRight className="size-4" />
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
