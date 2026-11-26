import { ArrowUpRight } from 'lucide-react'
import { Reveal } from '@/components/ui'
import { ARC_NETWORK, LINKS } from '@/config/protocol'

export function Faucet() {
  return (
    <section id="faucet" className="bg-black py-24">
      <div className="mx-auto max-w-[1280px] px-5 sm:px-6 lg:px-8">
        <Reveal>
          <div className="flex flex-col justify-between gap-8 rounded-[12px] border border-white/15 bg-[#111111] p-8 lg:flex-row lg:items-center lg:p-12">
            <div className="max-w-2xl">
              <p className="rwa-hud text-lime">NATIVE USDC GAS &amp; SETTLEMENT</p>
              <h2 className="rwa-display mt-3 text-[clamp(1.8rem,3.2vw,2.75rem)] uppercase text-white">
                FUND YOUR ARC WALLET IN ONE CLICK.
              </h2>
              <p className="mt-3 text-[16px] leading-relaxed text-[#A3A3A3]">
                On <span className="font-mono text-white">{ARC_NETWORK.short}</span>, USDC is both native gas and
                escrow settlement currency. Claim free testnet USDC from Circle&apos;s faucet.
              </p>
            </div>
            <div className="shrink-0">
              <a
                href={LINKS.circleFaucet}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-lime px-7 font-mono text-[13px] font-semibold tracking-[0.03em] text-ink transition-colors hover:bg-[#d8ff4d]"
              >
                Claim Testnet USDC <ArrowUpRight className="size-4" strokeWidth={1.75} />
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
