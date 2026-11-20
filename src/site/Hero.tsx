import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { getAppUrl, getSdkUrl, navigate } from '@/lib/route'

export function Hero() {
  return (
    <section id="top" className="mx-auto max-w-[1280px] px-6 pb-20 pt-16 sm:pt-24 lg:px-8">
      <p className="rwa-hud text-lime">
        ARC TESTNET (5042002) // NATIVE USDC ESCROW &amp; AI SETTLEMENT
      </p>

      <h1 className="rwa-display mt-6 max-w-[1120px] break-normal text-[clamp(2.5rem,5.2vw,4.75rem)] leading-[1.03] text-paper">
        PROGRAMMABLE ESCROW. ATOMIC USDC SETTLEMENT.
      </h1>

      <p className="mt-6 max-w-[680px] text-[16px] leading-[1.6] text-secondary sm:text-[18px]">
        Replace 15% platform fees and 60-day chargebacks with non-custodial USDC escrow on Arc. Audited by Grok AI,
        calibrated by Gemini Prediction Markets, and enforced by Time-Entropic Collateral Decay.
      </p>

      {/* Twin Pill CTAs */}
      <div className="mt-9 flex flex-wrap items-center gap-3.5">
        <button
          type="button"
          onClick={() => navigate(getAppUrl())}
          className="inline-flex h-12 items-center gap-2 rounded-full bg-lime px-7 font-mono text-[12px] font-semibold uppercase tracking-[0.14em] text-ink transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-[1.02] hover:bg-[#d8ff4d]"
        >
          <span>LAUNCH ESCROW APP</span>
          <ArrowRight className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => navigate(getSdkUrl())}
          className="inline-flex h-12 items-center gap-2 rounded-full border border-paper/25 px-7 font-mono text-[12px] font-medium uppercase tracking-[0.14em] text-paper transition-colors hover:border-lime hover:text-lime"
        >
          <span>EXPLORE @DIPTOS/SDK</span>
          <ArrowUpRight className="size-4" />
        </button>
      </div>

      {/* Bottom 3-Column IBM Plex Mono KPI Strip with 1px vertical dividers */}
      <div className="mt-16 grid grid-cols-1 divide-y divide-paper/12 border-y border-paper/12 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="py-6 sm:pr-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-lime">01 / PROTOCOL FEE</p>
          <p className="mt-2 font-mono text-[22px] font-semibold tracking-[-0.02em] text-paper">0.5% FLAT FEE</p>
        </div>
        <div className="py-6 sm:px-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-lime">02 / DETERMINISTIC</p>
          <p className="mt-2 font-mono text-[22px] font-semibold tracking-[-0.02em] text-paper">&lt;1.0S ARC FINALITY</p>
        </div>
        <div className="py-6 sm:pl-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-lime">03 / ATOMIC DVP</p>
          <p className="mt-2 font-mono text-[22px] font-semibold tracking-[-0.02em] text-paper">ZERO CHARGEBACKS</p>
        </div>
      </div>
    </section>
  )
}
