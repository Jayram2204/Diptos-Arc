import { ARC_NETWORK, LINKS } from '@/config/protocol'

export function Footer() {
  return (
    <footer className="border-t border-paper/10 bg-black py-16">
      <div className="mx-auto flex max-w-[1380px] flex-col justify-between gap-10 px-6 lg:flex-row lg:items-end lg:px-10">
        <div>
          <span className="rwa-display inline-flex items-baseline text-[22px] tracking-[-0.04em] text-paper">
            DIPTOS<span className="ml-0.5 inline-block size-2 rounded-full bg-lime" />
          </span>
          <p className="mt-3 max-w-md text-[14px] text-secondary">
            Programmable USDC escrow links, Grok EIP-712 deliverable audits, Gemini TECD risk calibration, and
            QuickNode Streams exclusively on {ARC_NETWORK.short}.
          </p>
        </div>

        <ul className="flex flex-wrap gap-x-8 gap-y-2 font-mono text-[11px] uppercase tracking-[0.12em]">
          <li>
            <a href="#escrows" className="text-secondary transition-colors hover:text-lime">
              01 ESCROW
            </a>
          </li>
          <li>
            <a href="#architecture" className="text-secondary transition-colors hover:text-lime">
              02 ARCHITECTURE
            </a>
          </li>
          <li>
            <a href="#tecd-risk" className="text-secondary transition-colors hover:text-lime">
              03 TECD RISK
            </a>
          </li>
          <li>
            <a href={ARC_NETWORK.explorerUrl} target="_blank" rel="noreferrer" className="text-secondary transition-colors hover:text-lime">
              ARC EXPLORER
            </a>
          </li>
          <li>
            <a href={LINKS.circleFaucet} target="_blank" rel="noreferrer" className="text-secondary transition-colors hover:text-lime">
              FAUCET
            </a>
          </li>
        </ul>
      </div>

      <div className="mx-auto mt-10 max-w-[1380px] border-t border-paper/10 px-6 pt-6 font-mono text-[10.5px] uppercase tracking-[0.12em] text-secondary/70 lg:px-10">
        UBC 2026 HACKATHON · ARC TESTNET (CHAIN ID 5042002) · DIPTOS.XYZ
      </div>
    </footer>
  )
}
