import { ArrowUpRight } from 'lucide-react'
import { OPEN_COOKIE_CONTROLS_EVENT } from '@/components/CookieConsentPill'
import { ARC_NETWORK, LINKS } from '@/config/protocol'
import { getAgentUrl, getAppUrl, getSdkUrl } from '@/lib/route'

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-black pb-24 pt-16">
      <div className="mx-auto max-w-[1280px] px-5 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-12 md:items-start">
          {/* Left: Brand & concise description */}
          <div className="md:col-span-5">
            <span className="rwa-display inline-flex items-baseline text-[22px] tracking-[-0.03em] text-white">
              DIPTOS<span className="ml-0.5 inline-block size-2 rounded-full bg-lime" />
            </span>
            <p className="mt-3 max-w-md text-[14.5px] leading-relaxed text-[#A3A3A3]">
              Condition-Verified USDC Settlement for human work and autonomous AI agents. Non-custodial native USDC
              vaults, deterministic proof, and automatic late-delivery rebates on {ARC_NETWORK.short}.
            </p>
          </div>

          {/* Right: Cleanly aligned destination links */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:col-span-7 md:justify-items-end">
            <div className="space-y-2.5 font-mono text-[13px]">
              <p className="text-[12px] uppercase tracking-[0.05em] text-white">Surfaces</p>
              <ul className="space-y-2 text-[#A3A3A3]">
                <li>
                  <a
                    href={getAppUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 transition-colors hover:text-lime"
                  >
                    App <ArrowUpRight className="size-3.5" strokeWidth={1.5} />
                  </a>
                </li>
                <li>
                  <a
                    href={getAgentUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 transition-colors hover:text-lime"
                  >
                    AI Agents <ArrowUpRight className="size-3.5" strokeWidth={1.5} />
                  </a>
                </li>
                <li>
                  <a
                    href={getSdkUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 transition-colors hover:text-lime"
                  >
                    SDK Docs <ArrowUpRight className="size-3.5" strokeWidth={1.5} />
                  </a>
                </li>
              </ul>
            </div>

            <div className="space-y-2.5 font-mono text-[13px]">
              <p className="text-[12px] uppercase tracking-[0.05em] text-white">Network</p>
              <ul className="space-y-2 text-[#A3A3A3]">
                <li>
                  <a
                    href={ARC_NETWORK.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 transition-colors hover:text-lime"
                  >
                    Arc Explorer <ArrowUpRight className="size-3.5" strokeWidth={1.5} />
                  </a>
                </li>
                <li>
                  <a
                    href={LINKS.circleFaucet}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 transition-colors hover:text-lime"
                  >
                    Circle Faucet <ArrowUpRight className="size-3.5" strokeWidth={1.5} />
                  </a>
                </li>
              </ul>
            </div>

            <div className="space-y-2.5 font-mono text-[13px]">
              <p className="text-[12px] uppercase tracking-[0.05em] text-white">Session</p>
              <ul className="space-y-2 text-[#A3A3A3]">
                <li>
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_CONTROLS_EVENT))}
                    className="text-left transition-colors hover:text-lime"
                  >
                    Cookie Controls
                  </button>
                </li>
                <li className="text-[#A3A3A3]/70">Arc 5042002</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 font-mono text-[12px] tracking-[0.03em] text-[#A3A3A3]">
          <span>Non-Custodial Settlement Protocol · Arc Testnet (5042002) · diptos.xyz</span>
          <span className="text-white/60">Zero Platform Custody</span>
        </div>
      </div>
    </footer>
  )
}
