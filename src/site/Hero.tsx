import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { trackFunnelEvent } from '@/lib/analytics'
import { getAppUrl, getSdkUrl } from '@/lib/route'

export function Hero() {
  return (
    <section
      id="top"
      className="mx-auto flex min-h-[calc(100svh-76px)] max-w-[1280px] flex-col justify-between px-5 pb-16 pt-20 sm:px-6 sm:pt-28 lg:px-8"
    >
      <div>
        <p className="rwa-hud text-lime">NATIVE USDC PROTECTION // ZERO PLATFORM CUSTODY</p>

        <h1 className="rwa-display mt-6 max-w-[1120px] break-normal text-[clamp(2.35rem,5.2vw,4.75rem)] leading-[1.03] text-white">
          WORK VERIFIED.
          <br />
          PAID IN 1 SECOND.
          <br />
          ZERO ARGUMENTS.
        </h1>

        <p className="mt-6 max-w-[680px] text-[16px] leading-[1.65] text-[#E5E7EB] sm:text-[18px]">
          Lock USDC against objective proof—merged code, passing tests, or valid AI agent output. Release 99.5%
          automatically on time, or rebate the buyer mathematically if delivery is late.
        </p>

        {/* Twin Pill CTAs */}
        <div className="mt-10 flex flex-wrap items-center gap-3.5">
          <a
            href={getAppUrl()}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackFunnelEvent('landing_cta_click', { location: 'hero_primary' })}
            className="inline-flex h-12 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-lime px-7 font-mono text-[12px] font-semibold uppercase tracking-[0.14em] text-ink transition-all duration-200 hover:scale-[1.02] hover:bg-[#d8ff4d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <span>CREATE LINK IN 1 CLICK</span>
            <ArrowRight className="size-4" />
          </a>
          <a
            href={getSdkUrl()}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackFunnelEvent('landing_cta_click', { location: 'hero_sdk' })}
            className="inline-flex h-12 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-paper/30 px-7 font-mono text-[12px] font-medium uppercase tracking-[0.14em] text-white transition-colors hover:border-lime focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
          >
            <span>EXPLORE @DIPTOS/SDK</span>
            <ArrowUpRight className="size-4" />
          </a>
        </div>
      </div>

      {/* Minimal 3-Column Hairline KPI Strip anchoring the full-viewport hero */}
      <div className="mt-20 grid grid-cols-1 divide-y divide-paper/12 border-y border-paper/12 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="py-6 sm:pr-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-lime">01 / PROTOCOL FEE</p>
          <p className="mt-2 font-mono text-[22px] font-semibold tracking-[-0.02em] text-white">0.5% FLAT FEE</p>
        </div>
        <div className="py-6 sm:px-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-lime">02 / DETERMINISTIC</p>
          <p className="mt-2 font-mono text-[22px] font-semibold tracking-[-0.02em] text-white">&lt;1.0S ARC FINALITY</p>
        </div>
        <div className="py-6 sm:pl-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-lime">03 / SELF-CUSTODIAL</p>
          <p className="mt-2 font-mono text-[22px] font-semibold tracking-[-0.02em] text-white">ZERO CUSTODY</p>
        </div>
      </div>
    </section>
  )
}
