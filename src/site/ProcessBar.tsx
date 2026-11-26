import { Reveal } from '@/components/ui'

const CAPABILITIES_STRIP = [
  'ARC NATIVE USDC',
  'BASE USDC + x402',
  'ZERO PLATFORM CUSTODY',
  'DETERMINISTIC PROOF',
  'AUTOMATIC LATE-DELIVERY REBATE',
]

const LIFECYCLE_STEPS = [
  {
    num: '01',
    title: 'Originate',
    body: 'Create a shareable payment link with clear acceptance criteria, delivery deadline, and automatic late-delivery rebate rate.',
  },
  {
    num: '02',
    title: 'Lock Native USDC',
    body: 'Buyer locks native USDC directly in a non-custodial vault. Unique on-chain IDs prevent duplicate claims or tampering.',
  },
  {
    num: '03',
    title: 'Deterministic Proof',
    body: 'Objective deliverable proof is verified against the agreed scope before automatic release—zero manual arbitration.',
  },
  {
    num: '04',
    title: '1-Second Payout',
    body: 'On-time proof pays 99.5% immediately (0.5% flat fee). Late delivery rebates the buyer mathematically in one transaction.',
  },
]

function MarqueeTrack({ hidden = false }: { hidden?: boolean }) {
  return (
    <div
      aria-hidden={hidden || undefined}
      className={`flex shrink-0 items-center gap-8 whitespace-nowrap pr-8 ${hidden ? 'select-none' : ''}`}
    >
      {CAPABILITIES_STRIP.map((item) => (
        <span
          key={item}
          className="inline-flex items-center gap-8 font-mono text-[13px] font-medium uppercase tracking-[0.06em] text-[#A3A3A3]"
        >
          <span>{item}</span>
          <span aria-hidden="true" className="text-lime">
            ·
          </span>
        </span>
      ))}
    </div>
  )
}

export function ProcessBar() {
  return (
    <div id="how-it-works">
      {/* Kinetic Continuous Capabilities & Rails Marquee */}
      <div className="overflow-hidden bg-black py-5">
        <div className="flex w-max animate-marquee items-center">
          <MarqueeTrack />
          <MarqueeTrack hidden />
          <MarqueeTrack hidden />
          <MarqueeTrack hidden />
        </div>
      </div>

      {/* Full-Bleed Pure White (#FFFFFF) Editorial Contrast Section */}
      <section className="bg-white py-24 text-black lg:py-28">
        <div className="mx-auto max-w-[1280px] px-5 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-8 pb-12 lg:flex-row lg:items-end">
            <Reveal className="max-w-2xl">
              <p className="font-mono text-[13px] font-medium uppercase tracking-[0.05em] text-black/60">
                01 // HOW IT WORKS · CONDITION-VERIFIED USDC SETTLEMENT
              </p>
              <h2 className="rwa-display mt-4 text-[clamp(2rem,4vw,3.4rem)] uppercase tracking-[-0.025em] text-black">
                FROM PAYMENT LINK TO 1-SECOND PAYOUT.
              </h2>
            </Reveal>
            <Reveal delayMs={100} className="max-w-md">
              <p className="text-[16px] leading-relaxed text-black/75">
                Every stage executes automatically on-chain with non-custodial vaults, hardware-pinned verification,
                and continuous late-delivery math.
              </p>
            </Reveal>
          </div>

          <div className="mt-6 grid items-stretch gap-5 md:grid-cols-2 lg:grid-cols-4">
            {LIFECYCLE_STEPS.map((step, i) => (
              <Reveal key={step.num} delayMs={i * 75} className="h-full">
                <article className="flex h-full flex-col justify-between rounded-[12px] border border-black/12 bg-white p-6 transition-transform duration-300 hover:-translate-y-0.5">
                  <div>
                    <span className="font-mono text-[13px] font-semibold tracking-[0.04em] text-black/55">
                      {step.num}
                    </span>
                    <h3 className="mt-4 text-[20px] font-semibold tracking-[-0.02em] text-black">{step.title}</h3>
                    <p className="mt-2.5 text-[15px] leading-relaxed text-black/75">{step.body}</p>
                  </div>
                  <div className="mt-7 h-1 w-full overflow-hidden rounded-full bg-black/10">
                    <div className="h-full bg-black" style={{ width: `${(i + 1) * 25}%` }} />
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
