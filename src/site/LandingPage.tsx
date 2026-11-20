import { useState } from 'react'
import { ArrowRight, ArrowUpRight, Check, Menu, Minus, X } from 'lucide-react'
import { InteractiveFlywheelEmblem, KineticFlywheel } from '@/components/KineticFlywheel'
import { getAppUrl, getSdkUrl } from '@/lib/route'
import { Architecture } from './Architecture'
import { EscrowsGrid } from './EscrowsGrid'
import { Registry } from './Registry'
import { Waterfall } from './Waterfall'

const NAV_LINKS = [
  { label: 'Protocol', href: '#protocol' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Live Settlement', href: '#escrows' },
  { label: 'Contracts', href: '#registry' },
] as const

const COMPARISON_ROWS = [
  {
    feature: 'Settlement & Gas Rail',
    web2: 'Fiat wires, 3–5 day settlement, 15% take rate',
    binary: 'Requires volatile ETH/SOL gas + separate ERC-20',
    diptos: 'Native USDC gas & atomic settlement on Arc (<1.0s)',
  },
  {
    feature: 'Late Delivery Handling',
    web2: 'Manual support tickets & 60-day chargebacks',
    binary: 'Binary all-or-nothing freeze or multisig dispute',
    diptos: 'Continuous TECD math V₀·e^(−λ(Δt/T)^1.5) auto-rebate',
  },
  {
    feature: 'Proof-of-Work Verification',
    web2: 'Subjective human arbitration',
    binary: 'No deliverable inspection; pure trust or DAO vote',
    diptos: 'Grok AI GitHub PR inspection + EIP-712 release digest',
  },
  {
    feature: 'Execution Surfaces',
    web2: 'Human marketplace lock-in only',
    binary: 'Raw contract calls; poor consumer UX',
    diptos: 'Dual Human (app.diptos.xyz/pay/:id) + AI Agent (@diptos/sdk)',
  },
] as const

const LIFECYCLE_STEPS = [
  {
    num: '01',
    title: 'Originate Link or SDK Call',
    body: 'Create a shareable app.diptos.xyz/pay/:id checkout link or call diptos.createEscrowLink() from an autonomous AI agent.',
  },
  {
    num: '02',
    title: 'Lock Native USDC on Arc',
    body: 'Payer locks native 18-decimal USDC in DiptosEscrow.sol with canonical keccak256 anti-double-spend registration.',
  },
  {
    num: '03',
    title: 'Gemini Risk & Grok AI Audit',
    body: 'Gemini Prediction Markets calibrates real-time λ risk; Grok AI inspects the submitted GitHub PR or live URL.',
  },
  {
    num: '04',
    title: 'Atomic DvP or TECD Rebate',
    body: 'On-time proof settles 99.5% instantly (0.5% fee); late delivery triggers continuous on-chain TECD buyer rebate math.',
  },
] as const

export function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [burstCount, setBurstCount] = useState(0)

  const appUrl = getAppUrl()
  const sdkUrl = getSdkUrl()

  return (
    <div className="min-h-screen bg-[#000000] text-[#F4F2EC]">
      {/* Apex-only White Kinetic Cryptographic Flywheel Preloader on #000000 */}
      <KineticFlywheel />

      {/* BAND 1: Dark Institutional Header */}
      <header className="sticky top-0 z-50 h-[72px] border-b border-[#F4F2EC]/10 bg-[#000000]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-full max-w-[1280px] items-center justify-between gap-4 px-5 sm:px-8">
          {/* Left: DIPTOS. wordmark + 28px white interactive flywheel + Arc pill */}
          <div className="flex items-center gap-3">
            <a
              href="#top"
              className="rwa-display inline-flex items-baseline text-[20px] tracking-[-0.04em] text-[#F4F2EC]"
            >
              DIPTOS<span className="ml-0.5 inline-block size-2 rounded-full bg-[#C8FF00]" />
            </a>
            <InteractiveFlywheelEmblem
              size={28}
              externalTrigger={burstCount}
              ariaLabel="Spin Diptos header settlement wheel"
            />
            <span className="hidden items-center gap-2 rounded-full border border-[#F4F2EC]/10 bg-[#0A0C12] px-3 py-1 font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-[#F4F2EC]/75 sm:inline-flex">
              <span className="size-1.5 rounded-full bg-[#10B981]" />
              ARC TESTNET • 5042002
            </span>
          </div>

          {/* Center: 4 Clean Anchor Links */}
          <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary">
            {NAV_LINKS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-[13.5px] font-medium text-[#F4F2EC]/65 transition-colors hover:text-[#F4F2EC]"
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Right: Twin Institutional Pills */}
          <div className="flex items-center gap-2.5">
            <a
              href={sdkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden h-9 items-center gap-1 rounded-full border border-[#F4F2EC]/20 px-4 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[#F4F2EC] transition-colors hover:bg-white/[0.06] sm:inline-flex"
            >
              SDK Docs <ArrowUpRight className="size-3.5" />
            </a>
            <a
              href={appUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#C8FF00] px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-[#07080C] transition-colors hover:bg-[#d8ff4d]"
            >
              Launch App <ArrowRight className="size-3.5" />
            </a>
            <button
              type="button"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Toggle navigation menu"
              className="grid size-9 place-items-center rounded-full border border-[#F4F2EC]/15 text-[#F4F2EC] lg:hidden"
            >
              {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <nav className="border-b border-[#F4F2EC]/10 bg-[#000000] px-5 py-4 lg:hidden">
            <ul className="space-y-2.5">
              {NAV_LINKS.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="block py-1 text-[14px] font-medium text-[#F4F2EC]"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
              <li className="pt-2">
                <a
                  href={sdkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 w-full items-center justify-center gap-1 rounded-full border border-[#F4F2EC]/20 font-mono text-[11px] uppercase tracking-[0.1em] text-[#F4F2EC]"
                >
                  SDK Docs <ArrowUpRight className="size-3.5" />
                </a>
              </li>
            </ul>
          </nav>
        )}
      </header>

      <main>
        {/* BAND 2: Flagship Hero on Pitch Black (#000000) */}
        <section id="top" className="mx-auto max-w-[1280px] px-5 pb-20 pt-14 sm:px-8 sm:pt-20">
          <div className="max-w-[880px]">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#C8FF00]">
              AUTONOMOUS SETTLEMENT &amp; PROOF-OF-WORK PROTOCOL ON ARC
            </p>

            <h1 className="rwa-display mt-5 break-normal text-[clamp(2.6rem,5.2vw,4.75rem)] leading-[1.03] tracking-[-0.03em] text-[#F4F2EC]">
              Self-Pricing USDC Settlement for Modern Work &amp; AI Agents.
            </h1>

            <p className="mt-6 max-w-[640px] text-[16px] leading-[1.65] text-[#F4F2EC]/65 sm:text-[17px]">
              Replace 15% middleman fees and binary disputes with cryptographic settlement links on Arc. Risk-priced
              live by Gemini Prediction Markets, verified by Grok AI, and governed by continuous Time-Entropic
              Collateral Decay.
            </p>

            {/* Twin Pill CTAs */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href={appUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-[#C8FF00] px-6 font-mono text-[12px] font-semibold uppercase tracking-[0.12em] text-[#07080C] transition-colors hover:bg-[#d8ff4d]"
              >
                Create Settlement Link <ArrowRight className="size-4" />
              </a>
              <a
                href={sdkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center gap-2 rounded-full border border-[#F4F2EC]/20 bg-[#0A0C12] px-6 font-mono text-[12px] font-medium uppercase tracking-[0.12em] text-[#F4F2EC] transition-colors hover:bg-white/[0.06]"
              >
                Explore @diptos/sdk <ArrowUpRight className="size-4" />
              </a>
            </div>

            {/* Interactive White Flywheel Burst Trigger Pill */}
            <div className="mt-7 inline-flex items-center gap-3 rounded-full border border-[#F4F2EC]/12 bg-[#0A0C12] py-1.5 pl-2 pr-4">
              <InteractiveFlywheelEmblem
                size={36}
                externalTrigger={burstCount}
                ariaLabel="Test settlement burst animation"
              />
              <button
                type="button"
                onClick={() => setBurstCount((c) => c + 1)}
                onDoubleClick={() => setBurstCount((c) => c + 1)}
                className="cursor-pointer text-left font-mono text-[11px] font-medium tracking-[0.04em] text-[#F4F2EC] hover:text-[#C8FF00]"
              >
                Double-Tap / Click to Test Settlement Burst
              </button>
            </div>
          </div>
        </section>

        {/* BAND 3: Why Diptos Exists — Dark Institutional Comparison Matrix (#090A0D) */}
        <section id="protocol" className="border-y border-[#F4F2EC]/10 bg-[#090A0D] py-20">
          <div className="mx-auto max-w-[1280px] px-5 sm:px-8">
            <div className="max-w-2xl">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#C8FF00]">
                WHY DIPTOS EXISTS
              </p>
              <h2 className="rwa-display mt-3 text-[28px] text-[#F4F2EC] sm:text-[38px]">
                BUILT FOR CONTINUOUS SETTLEMENT, NOT BINARY DISPUTES.
              </h2>
            </div>

            <div className="mt-10 overflow-x-auto rounded-2xl border border-[#F4F2EC]/10 bg-[#0A0C12]">
              <table className="w-full min-w-[760px] text-left">
                <thead className="border-b border-[#F4F2EC]/10 bg-[#111318]">
                  <tr className="font-mono text-[11px] uppercase tracking-[0.12em]">
                    <th className="px-6 py-4 font-semibold text-[#F4F2EC]">Dimension</th>
                    <th className="px-6 py-4 font-semibold text-[#F4F2EC]/65">Web2 Platforms (15% Fee)</th>
                    <th className="px-6 py-4 font-semibold text-[#F4F2EC]/65">Binary Crypto Escrows</th>
                    <th className="bg-[#C8FF00]/10 px-6 py-4 font-semibold text-[#C8FF00]">
                      Diptos Protocol on Arc
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F4F2EC]/10 text-[13.5px]">
                  {COMPARISON_ROWS.map((row) => (
                    <tr key={row.feature} className="align-top">
                      <td className="px-6 py-4 font-semibold text-[#F4F2EC]">{row.feature}</td>
                      <td className="px-6 py-4 text-[#F4F2EC]/65">
                        <span className="inline-flex items-start gap-2">
                          <Minus className="mt-0.5 size-4 shrink-0 text-[#F4F2EC]/30" />
                          <span>{row.web2}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[#F4F2EC]/65">
                        <span className="inline-flex items-start gap-2">
                          <Minus className="mt-0.5 size-4 shrink-0 text-[#F4F2EC]/30" />
                          <span>{row.binary}</span>
                        </span>
                      </td>
                      <td className="bg-[#C8FF00]/[0.04] px-6 py-4 font-medium text-[#F4F2EC]">
                        <span className="inline-flex items-start gap-2">
                          <Check className="mt-0.5 size-4 shrink-0 text-[#10B981]" />
                          <span>{row.diptos}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* BAND 4: 4-Step Settlement Lifecycle (#000000 with 1px hairline dividers) */}
        <section id="how-it-works" className="mx-auto max-w-[1280px] px-5 py-20 sm:px-8">
          <div className="max-w-2xl">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#C8FF00]">
              SETTLEMENT LIFECYCLE
            </p>
            <h2 className="rwa-display mt-3 text-[28px] text-[#F4F2EC] sm:text-[38px]">
              FOUR STEPS FROM LINK TO FINALITY.
            </h2>
          </div>

          <div className="mt-10 grid divide-y divide-[#F4F2EC]/10 border-y border-[#F4F2EC]/10 md:grid-cols-2 md:divide-y-0 lg:grid-cols-4 lg:divide-x">
            {LIFECYCLE_STEPS.map((step) => (
              <div key={step.num} className="py-7 lg:px-6 lg:first:pl-0 lg:last:pr-0">
                <span className="inline-flex items-center rounded border border-[#C8FF00]/30 bg-[#C8FF00]/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-[#C8FF00]">
                  {step.num}
                </span>
                <h3 className="mt-4 text-[17px] font-semibold text-[#F4F2EC]">{step.title}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-[#F4F2EC]/65">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* BAND 5: Live On-Chain Protocol Bands (#000000 / #090A0D) */}
        <div className="bg-[#000000] text-[#F4F2EC]">
          <EscrowsGrid />
          <Waterfall />
          <Architecture />
          <Registry />
        </div>
      </main>

      {/* BAND 6: Dark Institutional Footer */}
      <footer className="border-t border-[#F4F2EC]/10 bg-[#090A0D] text-[#F4F2EC]">
        <div className="mx-auto flex max-w-[1280px] flex-col justify-between gap-8 px-5 py-14 sm:px-8 md:flex-row md:items-start">
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5">
              <span className="rwa-display text-[19px] tracking-[-0.04em] text-[#F4F2EC]">
                DIPTOS<span className="ml-0.5 inline-block size-2 rounded-full bg-[#C8FF00]" />
              </span>
              <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[#F4F2EC]/65">
                ARC TESTNET • 5042002
              </span>
            </div>
            <p className="mt-3 text-[13.5px] leading-relaxed text-[#F4F2EC]/65">
              Non-custodial programmable USDC settlement links and autonomous AI agent guardrails on Arc Testnet.
            </p>
          </div>

          <ul className="grid grid-cols-2 gap-x-10 gap-y-2.5 font-mono text-[12px]">
            <li>
              <a
                href={appUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[#F4F2EC]/70 hover:text-[#C8FF00]"
              >
                app.diptos.xyz <ArrowUpRight className="size-3" />
              </a>
            </li>
            <li>
              <a
                href={sdkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[#F4F2EC]/70 hover:text-[#C8FF00]"
              >
                sdk.diptos.xyz <ArrowUpRight className="size-3" />
              </a>
            </li>
            <li>
              <a
                href="https://github.com/Jayram2204/Diptos-Arc"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[#F4F2EC]/70 hover:text-[#C8FF00]"
              >
                github.com/Jayram2204/Diptos-Arc <ArrowUpRight className="size-3" />
              </a>
            </li>
            <li>
              <a
                href="https://testnet.arcscan.app"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[#F4F2EC]/70 hover:text-[#C8FF00]"
              >
                testnet.arcscan.app <ArrowUpRight className="size-3" />
              </a>
            </li>
            <li>
              <a
                href="https://www.npmjs.com/package/@diptos/sdk"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[#F4F2EC]/70 hover:text-[#C8FF00]"
              >
                @diptos/sdk (npm) <ArrowUpRight className="size-3" />
              </a>
            </li>
          </ul>
        </div>
        <div className="mx-auto max-w-[1280px] border-t border-[#F4F2EC]/10 px-5 py-6 font-mono text-[11px] text-[#F4F2EC]/55 sm:px-8">
          Arc Testnet (Chain ID 5042002) • Non-custodial programmable escrow software • © {new Date().getFullYear()} Diptos
        </div>
      </footer>
    </div>
  )
}
