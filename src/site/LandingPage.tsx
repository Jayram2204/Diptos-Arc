import { useState } from 'react'
import { ArrowRight, ArrowUpRight, Check, Menu, Minus, ShieldCheck, X } from 'lucide-react'
import { InteractiveFlywheelEmblem, KineticFlywheel } from '@/components/KineticFlywheel'
import { useArcPulse, useGeminiRisk } from '@/lib/hooks'
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
  const { data: gemini } = useGeminiRisk()
  const pulse = useArcPulse(6000)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [burstCount, setBurstCount] = useState(0)

  const liveLambda = gemini?.recommendedLambda ?? 0.35
  const appUrl = getAppUrl()
  const sdkUrl = getSdkUrl()

  return (
    <div className="min-h-screen bg-[#F7F6F2] text-[#0A0B0E]">
      {/* Apex-only Kinetic Cryptographic Flywheel Preloader */}
      <KineticFlywheel />

      {/* BAND 1: Crisp Editorial Header */}
      <header className="sticky top-0 z-50 h-[72px] border-b border-[#0A0B0E]/10 bg-[#F7F6F2]/90 backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-[1280px] items-center justify-between gap-4 px-5 sm:px-8">
          {/* Left: DIPTOS. wordmark + 28px interactive flywheel + Arc pill */}
          <div className="flex items-center gap-3">
            <a
              href="#top"
              className="rwa-display inline-flex items-baseline text-[20px] tracking-[-0.04em] text-[#0A0B0E]"
            >
              DIPTOS<span className="ml-0.5 inline-block size-2 rounded-full bg-[#C8FF00] ring-1 ring-[#0A0B0E]/40" />
            </a>
            <InteractiveFlywheelEmblem
              size={28}
              externalTrigger={burstCount}
              ariaLabel="Spin Diptos header settlement wheel"
            />
            <span className="hidden items-center gap-2 rounded-full border border-[#0A0B0E]/12 bg-[#FFFFFF] px-3 py-1 font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-[#0A0B0E]/80 sm:inline-flex">
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
                className="text-[13.5px] font-medium text-[#525560] transition-colors hover:text-[#0A0B0E]"
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Right: Two Restrained Pills */}
          <div className="flex items-center gap-2.5">
            <a
              href={sdkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden h-9 items-center gap-1 rounded-full border border-[#0A0B0E]/20 px-4 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[#0A0B0E] transition-colors hover:border-[#0A0B0E] hover:bg-[#0A0B0E]/[0.04] sm:inline-flex"
            >
              SDK Docs <ArrowUpRight className="size-3.5" />
            </a>
            <a
              href={appUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#0A0B0E] px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-[#F7F6F2] transition-colors hover:bg-[#1E2028]"
            >
              Launch App <ArrowRight className="size-3.5" />
            </a>
            <button
              type="button"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Toggle navigation menu"
              className="grid size-9 place-items-center rounded-full border border-[#0A0B0E]/15 text-[#0A0B0E] lg:hidden"
            >
              {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <nav className="border-b border-[#0A0B0E]/10 bg-[#F7F6F2] px-5 py-4 lg:hidden">
            <ul className="space-y-2.5">
              {NAV_LINKS.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="block py-1 text-[14px] font-medium text-[#0A0B0E]"
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
                  className="inline-flex h-9 w-full items-center justify-center gap-1 rounded-full border border-[#0A0B0E]/20 font-mono text-[11px] uppercase tracking-[0.1em] text-[#0A0B0E]"
                >
                  SDK Docs <ArrowUpRight className="size-3.5" />
                </a>
              </li>
            </ul>
          </nav>
        )}
      </header>

      <main>
        {/* BAND 2: Flagship Asymmetric Split Hero on Warm Paper (#F7F6F2) */}
        <section id="top" className="mx-auto max-w-[1280px] px-5 pb-20 pt-14 sm:px-8 sm:pt-20">
          <div className="grid items-start gap-12 lg:grid-cols-12 lg:gap-10">
            {/* Left Column (7 cols) */}
            <div className="lg:col-span-7">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#525560]">
                AUTONOMOUS SETTLEMENT &amp; PROOF-OF-WORK PROTOCOL ON ARC
              </p>

              <h1 className="rwa-display mt-5 break-normal text-[clamp(2.6rem,4.8vw,4.4rem)] leading-[1.03] tracking-[-0.03em] text-[#0A0B0E]">
                Self-Pricing USDC Settlement for Modern Work &amp; AI Agents.
              </h1>

              <p className="mt-6 max-w-[600px] text-[16px] leading-[1.65] text-[#525560] sm:text-[17px]">
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
                  className="inline-flex h-12 items-center gap-2 rounded-full bg-[#0A0B0E] px-6 font-mono text-[12px] font-semibold uppercase tracking-[0.12em] text-[#F7F6F2] transition-all hover:bg-[#1E2028]"
                >
                  Create Settlement Link <ArrowRight className="size-4" />
                </a>
                <a
                  href={sdkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-12 items-center gap-2 rounded-full border border-[#0A0B0E]/20 bg-[#FFFFFF] px-6 font-mono text-[12px] font-medium uppercase tracking-[0.12em] text-[#0A0B0E] transition-colors hover:border-[#0A0B0E]"
                >
                  Explore @diptos/sdk <ArrowUpRight className="size-4" />
                </a>
              </div>

              {/* Interactive Flywheel Burst Trigger Pill */}
              <div className="mt-7 inline-flex items-center gap-3 rounded-full border border-[#0A0B0E]/12 bg-[#FFFFFF] py-1.5 pl-2 pr-4 shadow-xs">
                <InteractiveFlywheelEmblem
                  size={36}
                  externalTrigger={burstCount}
                  ariaLabel="Test settlement burst animation"
                />
                <button
                  type="button"
                  onClick={() => setBurstCount((c) => c + 1)}
                  onDoubleClick={() => setBurstCount((c) => c + 1)}
                  className="cursor-pointer text-left font-mono text-[11px] font-medium tracking-[0.04em] text-[#0A0B0E] hover:underline"
                >
                  Double-Tap / Click to Test Settlement Burst
                </button>
              </div>
            </div>

            {/* Right Column (5 cols): Live Protocol Proof Card */}
            <div className="lg:col-span-5 lg:pt-2">
              <div className="rounded-2xl border border-[#0A0B0E]/10 bg-[#FFFFFF] p-6 shadow-sm">
                <div className="flex items-center justify-between border-b border-[#0A0B0E]/10 pb-4">
                  <div>
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#525560]">
                      LIVE ARC SETTLEMENT RECEIPT
                    </p>
                    <p className="mt-1 font-mono text-[13px] font-semibold text-[#0A0B0E]">
                      DiptosEscrow.sol // 5042002
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#10B981]/30 bg-[#10B981]/10 px-2.5 py-1 font-mono text-[10px] font-semibold text-[#059669]">
                    <ShieldCheck className="size-3.5" />
                    ATOMIC DVP
                  </span>
                </div>

                <dl className="mt-2 divide-y divide-[#0A0B0E]/8 font-mono text-[12.5px]">
                  <div className="flex items-center justify-between py-3.5">
                    <dt className="text-[#525560]">Principal Locked</dt>
                    <dd className="font-semibold tabular-nums text-[#0A0B0E]">2,500.00 USDC</dd>
                  </div>
                  <div className="flex items-center justify-between py-3.5">
                    <dt className="text-[#525560]">Gemini Live Risk λ</dt>
                    <dd className="font-semibold tabular-nums text-[#0A0B0E]">
                      {liveLambda.toFixed(3)}{' '}
                      <span className="ml-1 rounded bg-[#C8FF00] px-1.5 py-0.5 text-[10px] font-bold text-[#0A0B0E]">
                        LIVE
                      </span>
                    </dd>
                  </div>
                  <div className="flex items-center justify-between py-3.5">
                    <dt className="text-[#525560]">Grok AI Verification</dt>
                    <dd className="font-semibold text-[#059669]">EIP-712 Signed</dd>
                  </div>
                  <div className="flex items-center justify-between py-3.5">
                    <dt className="text-[#525560]">Arc Finality</dt>
                    <dd className="font-semibold tabular-nums text-[#0A0B0E]">
                      &lt; 1.0s{' '}
                      {pulse.blockNumber !== undefined && (
                        <span className="text-[11px] font-normal text-[#525560]">
                          (#{pulse.blockNumber.toLocaleString('en-US')})
                        </span>
                      )}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between py-3.5">
                    <dt className="text-[#525560]">Settlement Split</dt>
                    <dd className="font-semibold tabular-nums text-[#0A0B0E]">99.5% Payee / 0.5% Protocol</dd>
                  </div>
                </dl>

                <div className="mt-4 flex items-center justify-between rounded-xl border border-[#0A0B0E]/10 bg-[#F7F6F2] px-4 py-3 font-mono text-[11px]">
                  <span className="text-[#525560]">
                    TECD Curve: V₀·e^(−{liveLambda.toFixed(2)}·(Δt/T)^1.5)
                  </span>
                  <a
                    href="#tecd-risk"
                    className="font-semibold text-[#0A0B0E] underline-offset-4 hover:underline"
                  >
                    Simulate ↓
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* BAND 3: Why Diptos Exists — Editorial Comparison Matrix (#FFFFFF) */}
        <section id="protocol" className="border-y border-[#0A0B0E]/10 bg-[#FFFFFF] py-20">
          <div className="mx-auto max-w-[1280px] px-5 sm:px-8">
            <div className="max-w-2xl">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#525560]">
                WHY DIPTOS EXISTS
              </p>
              <h2 className="rwa-display mt-3 text-[28px] text-[#0A0B0E] sm:text-[38px]">
                BUILT FOR CONTINUOUS SETTLEMENT, NOT BINARY DISPUTES.
              </h2>
            </div>

            <div className="mt-10 overflow-x-auto rounded-2xl border border-[#0A0B0E]/10">
              <table className="w-full min-w-[760px] text-left">
                <thead className="border-b border-[#0A0B0E]/10 bg-[#F7F6F2]">
                  <tr className="font-mono text-[11px] uppercase tracking-[0.12em]">
                    <th className="px-6 py-4 font-semibold text-[#525560]">Dimension</th>
                    <th className="px-6 py-4 font-semibold text-[#525560]">Web2 Platforms (15% Fee)</th>
                    <th className="px-6 py-4 font-semibold text-[#525560]">Binary Crypto Escrows</th>
                    <th className="bg-[#0A0B0E] px-6 py-4 font-semibold text-[#C8FF00]">
                      Diptos Protocol on Arc
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0A0B0E]/10 text-[13.5px]">
                  {COMPARISON_ROWS.map((row) => (
                    <tr key={row.feature} className="align-top">
                      <td className="px-6 py-4 font-semibold text-[#0A0B0E]">{row.feature}</td>
                      <td className="px-6 py-4 text-[#525560]">
                        <span className="inline-flex items-start gap-2">
                          <Minus className="mt-0.5 size-4 shrink-0 text-[#0A0B0E]/30" />
                          <span>{row.web2}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[#525560]">
                        <span className="inline-flex items-start gap-2">
                          <Minus className="mt-0.5 size-4 shrink-0 text-[#0A0B0E]/30" />
                          <span>{row.binary}</span>
                        </span>
                      </td>
                      <td className="bg-[#0A0B0E]/[0.03] px-6 py-4 font-medium text-[#0A0B0E]">
                        <span className="inline-flex items-start gap-2">
                          <Check className="mt-0.5 size-4 shrink-0 text-[#059669]" />
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

        {/* BAND 4: 4-Step Settlement Lifecycle (#F7F6F2 Warm Paper) */}
        <section id="how-it-works" className="mx-auto max-w-[1280px] px-5 py-20 sm:px-8">
          <div className="max-w-2xl">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#525560]">
              SETTLEMENT LIFECYCLE
            </p>
            <h2 className="rwa-display mt-3 text-[28px] text-[#0A0B0E] sm:text-[38px]">
              FOUR STEPS FROM LINK TO FINALITY.
            </h2>
          </div>

          <div className="mt-10 grid divide-y divide-[#0A0B0E]/12 border-y border-[#0A0B0E]/12 md:grid-cols-2 md:divide-y-0 lg:grid-cols-4 lg:divide-x">
            {LIFECYCLE_STEPS.map((step) => (
              <div key={step.num} className="py-7 lg:px-6 lg:first:pl-0 lg:last:pr-0">
                <span className="inline-flex items-center rounded bg-[#0A0B0E] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#C8FF00]">
                  {step.num}
                </span>
                <h3 className="mt-4 text-[17px] font-semibold text-[#0A0B0E]">{step.title}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-[#525560]">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* BAND 5: Transition Into Live On-Chain Protocol Bands (#0A0B0E Obsidian Contrast) */}
        <div className="bg-[#0A0B0E] text-paper">
          <EscrowsGrid />
          <Waterfall />
          <Architecture />
          <Registry />
        </div>
      </main>

      {/* BAND 6: Editorial Footer (#F7F6F2 Warm Paper) */}
      <footer className="border-t border-[#0A0B0E]/10 bg-[#F7F6F2] text-[#0A0B0E]">
        <div className="mx-auto flex max-w-[1280px] flex-col justify-between gap-8 px-5 py-14 sm:px-8 md:flex-row md:items-start">
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5">
              <span className="rwa-display text-[19px] tracking-[-0.04em] text-[#0A0B0E]">
                DIPTOS<span className="ml-0.5 inline-block size-2 rounded-full bg-[#C8FF00] ring-1 ring-[#0A0B0E]/40" />
              </span>
              <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[#525560]">
                ARC TESTNET • 5042002
              </span>
            </div>
            <p className="mt-3 text-[13.5px] leading-relaxed text-[#525560]">
              Non-custodial programmable USDC settlement links and autonomous AI agent guardrails on Arc Testnet.
            </p>
          </div>

          <ul className="grid grid-cols-2 gap-x-10 gap-y-2.5 font-mono text-[12px]">
            <li>
              <a
                href={appUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[#0A0B0E]/80 hover:text-[#0A0B0E]"
              >
                app.diptos.xyz <ArrowUpRight className="size-3" />
              </a>
            </li>
            <li>
              <a
                href={sdkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[#0A0B0E]/80 hover:text-[#0A0B0E]"
              >
                sdk.diptos.xyz <ArrowUpRight className="size-3" />
              </a>
            </li>
            <li>
              <a
                href="https://github.com/Jayram2204/Diptos-Arc"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[#0A0B0E]/80 hover:text-[#0A0B0E]"
              >
                github.com/Jayram2204/Diptos-Arc <ArrowUpRight className="size-3" />
              </a>
            </li>
            <li>
              <a
                href="https://testnet.arcscan.app"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[#0A0B0E]/80 hover:text-[#0A0B0E]"
              >
                testnet.arcscan.app <ArrowUpRight className="size-3" />
              </a>
            </li>
            <li>
              <a
                href="https://www.npmjs.com/package/@diptos/sdk"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[#0A0B0E]/80 hover:text-[#0A0B0E]"
              >
                @diptos/sdk (npm) <ArrowUpRight className="size-3" />
              </a>
            </li>
          </ul>
        </div>
        <div className="mx-auto max-w-[1280px] border-t border-[#0A0B0E]/10 px-5 py-6 font-mono text-[11px] text-[#525560] sm:px-8">
          Arc Testnet (Chain ID 5042002) • Non-custodial programmable escrow software • © {new Date().getFullYear()} Diptos
        </div>
      </footer>
    </div>
  )
}
