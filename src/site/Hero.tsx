import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { PulseDot } from '@/components/ui'
import { getAppUrl, getSdkUrl } from '@/lib/route'

export function Hero() {
  return (
    <section id="top" className="mx-auto max-w-[1320px] px-6 pb-20 pt-16 sm:pt-24 lg:px-8">
      <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-[#111318] px-3.5 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-secondary">
        <PulseDot color="bg-emerald" />
        <span>ARC TESTNET (5042002) // NATIVE USDC ESCROW &amp; AI SETTLEMENT</span>
      </div>

      <h1 className="rwa-display mt-6 max-w-[1120px] break-normal text-[clamp(2.5rem,5.2vw,4.75rem)] leading-[1.03] text-[#F4F2EC]">
        PROGRAMMABLE ESCROW. ATOMIC USDC SETTLEMENT.
      </h1>

      <p className="mt-6 max-w-[680px] text-[16px] leading-[1.6] text-secondary sm:text-[18px]">
        Replace 15% platform fees and 60-day chargebacks with non-custodial USDC escrow on Arc. Audited by Grok AI,
        calibrated by Gemini Prediction Markets, and enforced by Time-Entropic Collateral Decay.
      </p>

      {/* Twin Subdomain Pill CTAs (open in new tab) */}
      <div className="mt-9 flex flex-wrap items-center gap-3.5">
        <a
          href={getAppUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center gap-2 rounded-full bg-[#F4F2EC] px-6 font-mono text-[11.5px] font-semibold uppercase tracking-[0.12em] text-[#090A0D] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[1px] hover:bg-white"
        >
          <span>LAUNCH ESCROW APP</span>
          <ArrowRight className="size-4" />
        </a>
        <a
          href={getSdkUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center gap-2 rounded-full border border-white/15 bg-transparent px-6 font-mono text-[11.5px] font-medium uppercase tracking-[0.12em] text-[#F4F2EC] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[1px] hover:border-white/30 hover:bg-white/[0.06]"
        >
          <span>EXPLORE @DIPTOS/SDK</span>
          <ArrowUpRight className="size-4" />
        </a>
      </div>

      {/* Symmetrical Equal-Height 3-Column KPI Strip */}
      <div className="mt-16 grid grid-cols-1 items-stretch gap-5 sm:grid-cols-3">
        <div className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#111318] p-6 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[1px] hover:border-white/[0.14] hover:bg-[#161922]">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-secondary">01 / PROTOCOL FEE</p>
          <p className="mt-3 font-mono text-[22px] font-semibold tracking-[-0.02em] text-[#F4F2EC]">0.5% FLAT FEE</p>
        </div>
        <div className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#111318] p-6 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[1px] hover:border-white/[0.14] hover:bg-[#161922]">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-secondary">02 / DETERMINISTIC</p>
          <p className="mt-3 font-mono text-[22px] font-semibold tracking-[-0.02em] text-[#F4F2EC]">&lt;1.0S ARC FINALITY</p>
        </div>
        <div className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#111318] p-6 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[1px] hover:border-white/[0.14] hover:bg-[#161922]">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-secondary">03 / ATOMIC DVP</p>
          <p className="mt-3 font-mono text-[22px] font-semibold tracking-[-0.02em] text-[#F4F2EC]">ZERO CHARGEBACKS</p>
        </div>
      </div>
    </section>
  )
}
