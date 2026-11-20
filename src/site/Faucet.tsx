import { ArrowUpRight, Droplets } from 'lucide-react'
import { Eyebrow, Reveal } from '@/components/ui'
import { ARC_NETWORK, LINKS } from '@/config/protocol'
import { getAppUrl } from '@/lib/route'

export function Faucet() {
  return (
    <section id="faucet" className="border-t border-white/[0.08] bg-[#090A0D] py-20 lg:py-24">
      <div className="mx-auto max-w-[1320px] px-6 lg:px-8">
        <Reveal>
          <div className="flex flex-col justify-between gap-8 rounded-xl border border-white/[0.08] bg-[#111318] p-8 lg:flex-row lg:items-center lg:p-10">
            <div className="max-w-2xl">
              <Eyebrow>NATIVE USDC GAS &amp; SETTLEMENT</Eyebrow>
              <h2 className="rwa-display mt-3 text-[24px] uppercase text-[#F4F2EC] sm:text-[32px]">
                FUND YOUR ARC TESTNET WALLET IN ONE CLICK.
              </h2>
              <p className="mt-3 text-[15px] text-secondary">
                On <span className="font-mono text-[#F4F2EC]">{ARC_NETWORK.short}</span>, USDC is both the native gas token
                and the escrow settlement currency. Claim free testnet USDC from Circle&apos;s faucet or the Diptos on-chain faucet.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <a
                href={getAppUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center gap-2 rounded-full border border-white/15 bg-transparent px-6 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-[#F4F2EC] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[1px] hover:border-white/30 hover:bg-white/[0.06]"
              >
                LAUNCH APP <ArrowUpRight className="size-4" />
              </a>
              <a
                href={LINKS.circleFaucet}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-[#F4F2EC] px-6 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-[#090A0D] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[1px] hover:bg-white"
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
