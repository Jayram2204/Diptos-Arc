import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { trackFunnelEvent } from '@/lib/analytics'
import { getAppUrl, getSdkUrl } from '@/lib/route'

export function Hero() {
  return (
    <section
      id="top"
      className="mx-auto max-w-[1280px] px-5 pb-20 pt-20 sm:px-6 sm:pb-24 sm:pt-28 lg:px-8"
    >
      <div className="max-w-[1040px]">
        <p className="rwa-hud text-lime">NATIVE USDC PROTECTION // ZERO PLATFORM CUSTODY</p>

        <h1 className="rwa-display mt-5 break-normal text-[clamp(2.5rem,5.4vw,4.85rem)] leading-[1.02] tracking-[-0.025em] text-white">
          WORK VERIFIED.
          <br />
          PAID IN 1 SECOND.
          <br />
          ZERO ARGUMENTS.
        </h1>

        <p className="mt-6 max-w-[660px] text-[16px] leading-[1.65] text-[#A3A3A3] sm:text-[18px]">
          Lock USDC against objective proof—merged code, passing tests, or valid AI agent output. Release 99.5%
          automatically on time, or rebate the buyer mathematically if delivery is late.
        </p>

        {/* Concise Twin Pill CTAs */}
        <div className="mt-9 flex flex-wrap items-center gap-3.5">
          <a
            href={getAppUrl()}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackFunnelEvent('landing_cta_click', { location: 'hero_primary' })}
            className="inline-flex h-12 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-lime px-7 font-mono text-[13px] font-semibold tracking-[0.03em] text-ink transition-all duration-200 hover:bg-[#d8ff4d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <span>Create Link</span>
            <ArrowRight className="size-4" strokeWidth={1.75} />
          </a>
          <a
            href={getSdkUrl()}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackFunnelEvent('landing_cta_click', { location: 'hero_sdk' })}
            className="inline-flex h-12 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-white/25 px-7 font-mono text-[13px] font-medium tracking-[0.03em] text-white transition-colors hover:border-lime hover:text-lime focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
          >
            <span>Explore SDK</span>
            <ArrowUpRight className="size-4" strokeWidth={1.5} />
          </a>
        </div>
      </div>
    </section>
  )
}
