import { ArrowUpRight } from 'lucide-react'
import { OPEN_COOKIE_CONTROLS_EVENT } from '@/components/CookieConsentPill'
import { ARC_NETWORK, LINKS } from '@/config/protocol'
import { getAppUrl, getSdkUrl } from '@/lib/route'

export function Footer() {
  return (
    <footer className="border-t border-paper/10 bg-black py-16">
      <div className="mx-auto flex max-w-[1380px] flex-col justify-between gap-10 px-6 lg:flex-row lg:items-end lg:px-10">
        <div>
          <span className="rwa-display inline-flex items-baseline text-[22px] tracking-[-0.04em] text-paper">
            DIPTOS<span className="ml-0.5 inline-block size-2 rounded-full bg-lime" />
          </span>
          <p className="mt-3 max-w-md text-[14px] text-secondary">
            Guaranteed Outcome Protection for human work and autonomous AI agents. Non-custodial native USDC settlement,
            deterministic proof, and automatic late-delivery rebates on {ARC_NETWORK.short}.
          </p>
        </div>

        <ul className="flex flex-wrap items-center gap-x-8 gap-y-2 font-mono text-[11px] uppercase tracking-[0.12em]">
          <li>
            <a
              href={getAppUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-secondary transition-colors hover:text-lime"
            >
              APP.DIPTOS.XYZ <ArrowUpRight className="size-3" />
            </a>
          </li>
          <li>
            <a
              href={getSdkUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-secondary transition-colors hover:text-lime"
            >
              SDK.DIPTOS.XYZ <ArrowUpRight className="size-3" />
            </a>
          </li>
          <li>
            <a
              href={ARC_NETWORK.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-secondary transition-colors hover:text-lime"
            >
              ARC EXPLORER <ArrowUpRight className="size-3" />
            </a>
          </li>
          <li>
            <a
              href={LINKS.circleFaucet}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-secondary transition-colors hover:text-lime"
            >
              FAUCET <ArrowUpRight className="size-3" />
            </a>
          </li>
        </ul>
      </div>

      <div className="mx-auto mt-10 flex max-w-[1380px] flex-wrap items-center justify-between gap-4 border-t border-paper/10 px-6 pt-6 font-mono text-[10.5px] uppercase tracking-[0.12em] text-secondary/80 lg:px-10">
        <span>NON-CUSTODIAL SETTLEMENT PROTOCOL · ARC TESTNET (CHAIN ID 5042002) · DIPTOS.XYZ</span>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_CONTROLS_EVENT))}
          className="text-[#E5E7EB] underline-offset-4 hover:text-lime hover:underline"
        >
          COOKIE &amp; SESSION CONTROLS
        </button>
      </div>
    </footer>
  )
}
