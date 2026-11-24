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
    title: 'ORIGINATE',
    tag: 'LINK & SCOPE',
    body: 'Create a shareable payment link with clear acceptance criteria, delivery deadline, and automatic late-delivery rebate rate.',
  },
  {
    num: '02',
    title: 'LOCK NATIVE USDC',
    tag: 'ZERO CUSTODY',
    body: 'Buyer locks native USDC directly in a non-custodial vault. Unique on-chain IDs prevent duplicate claims or tampering.',
  },
  {
    num: '03',
    title: 'DETERMINISTIC PROOF',
    tag: 'HARDWARE-PINNED',
    body: 'Objective deliverable proof is verified against the agreed scope before automatic release—zero manual arbitration.',
  },
  {
    num: '04',
    title: '1-SECOND PAYOUT',
    tag: 'INSTANT RELEASE',
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
          className="inline-flex items-center gap-8 font-mono text-[11.5px] font-medium uppercase tracking-[0.16em] text-[#E5E7EB]"
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
    <div id="how-it-works" className="border-t border-paper/10">
      {/* Kinetic Continuous Capabilities & Rails Marquee (screen-reader accessible: clones aria-hidden) */}
      <div className="overflow-hidden border-b border-paper/10 bg-black py-4">
        <div className="flex w-max animate-marquee items-center">
          <MarqueeTrack />
          <MarqueeTrack hidden />
          <MarqueeTrack hidden />
          <MarqueeTrack hidden />
        </div>
      </div>

      {/* Full-Bleed Warm Paper (#F4F2EC) Editorial Contrast Section */}
      <section className="bg-paper py-24 text-ink lg:py-32">
        <div className="mx-auto max-w-[1380px] px-5 sm:px-6 lg:px-10">
          <div className="flex flex-col justify-between gap-8 border-b border-ink/15 pb-12 lg:flex-row lg:items-end">
            <Reveal className="max-w-2xl">
              <p className="font-mono text-[11.5px] font-medium uppercase tracking-[0.14em] text-ink/75">
                01 // HOW IT WORKS · GUARANTEED OUTCOME PROTECTION
              </p>
              <h2 className="rwa-display mt-4 text-[clamp(2rem,4.2vw,3.6rem)] uppercase text-ink">
                FROM PAYMENT LINK TO 1-SECOND PAYOUT.
              </h2>
            </Reveal>
            <Reveal delayMs={100} className="max-w-md">
              <p className="text-[15.5px] leading-relaxed text-ink/80">
                Every stage executes automatically on-chain with non-custodial vaults, hardware-pinned verification,
                and continuous late-delivery math.
              </p>
            </Reveal>
          </div>

          <div className="mt-12 grid items-stretch gap-6 md:grid-cols-2 lg:grid-cols-4">
            {LIFECYCLE_STEPS.map((step, i) => (
              <Reveal key={step.num} delayMs={i * 90} className="h-full">
                <article className="flex h-full flex-col justify-between rounded-2xl border border-ink/12 bg-white/60 p-7 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1">
                  <div>
                    <div className="flex items-center justify-between border-b border-ink/10 pb-4">
                      <span className="font-mono text-[13px] font-semibold tracking-[0.12em] text-ink">
                        {step.num}
                      </span>
                      <span className="rounded-full border border-ink/20 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/80">
                        {step.tag}
                      </span>
                    </div>
                    <h3 className="rwa-display mt-6 text-[22px] uppercase text-ink">{step.title}</h3>
                    <p className="mt-3 text-[14px] leading-relaxed text-ink/80">{step.body}</p>
                  </div>
                  <div className="mt-8 h-1 w-full overflow-hidden rounded-full bg-ink/10">
                    <div className="h-full bg-ink" style={{ width: `${(i + 1) * 25}%` }} />
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
