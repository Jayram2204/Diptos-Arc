import { Wordmark } from '@/components/Logo'
import { ARC_NETWORK, LINKS } from '@/config/protocol'

export function Footer() {
  return (
    <footer className="border-t border-white/[0.08] bg-canvas">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-8 px-4 py-12 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <Wordmark />
          <p className="mt-3 text-[13px] text-secondary">
            Programmable USDC escrow links for human freelancers and autonomous AI agents on {ARC_NETWORK.short}.
          </p>
        </div>
        <ul className="grid grid-cols-2 gap-x-10 gap-y-2 font-mono text-[12px]">
          <li>
            <a href="#how-it-works" className="text-secondary hover:text-primary">
              how-it-works
            </a>
          </li>
          <li>
            <a href="#architecture" className="text-secondary hover:text-primary">
              live-sandbox
            </a>
          </li>
          <li>
            <a href="#tecd-risk" className="text-secondary hover:text-primary">
              tecd-risk
            </a>
          </li>
          <li>
            <a href="#registry" className="text-secondary hover:text-primary">
              arc-contracts
            </a>
          </li>
          <li>
            <a href={LINKS.explorer} target="_blank" rel="noreferrer" className="text-secondary hover:text-primary">
              arc-explorer ↗
            </a>
          </li>
          <li>
            <a href={LINKS.circleFaucet} target="_blank" rel="noreferrer" className="text-secondary hover:text-primary">
              circle-faucet ↗
            </a>
          </li>
        </ul>
      </div>
      <p className="mx-auto max-w-[1280px] border-t border-white/[0.06] px-4 py-6 font-mono text-[11px] text-secondary/70 sm:px-6">
        Arc Testnet (Chain ID 5042002) • Non-custodial programmable escrow software • © {new Date().getFullYear()} Diptos
      </p>
    </footer>
  )
}
