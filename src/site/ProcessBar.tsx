import { Reveal } from '@/components/ui'

const OUTCOME_BAR_ITEMS = [
  'NATIVE USDC · ARC + BASE',
  'x402 COMPATIBLE',
  'ZERO PLATFORM CUSTODY',
  'DETERMINISTIC PROOF',
  'AUTOMATIC LATE-DELIVERY REBATE',
]

const LIFECYCLE_STEPS = [
  {
    num: '01',
    title: 'ORIGINATE',
    tag: 'LINK & SCOPE',
    body: 'Create a shareable settlement link with objective acceptance criteria, SLA deadline, and automatic late-delivery rebate rate.',
  },
  {
    num: '02',
    title: 'LOCK NATIVE USDC',
    tag: 'ZERO CUSTODY',
    body: 'Buyer locks native USDC directly in DiptosEscrow.sol. Canonical keccak256 hashes block replay or double-spend.',
  },
  {
    num: '03',
    title: 'DETERMINISTIC PROOF',
    tag: 'HARDWARE-PINNED',
    body: 'Objective deliverable proof is verified against the on-chain scope and bound to a single-use cryptographic release nonce.',
  },
  {
    num: '04',
    title: '1-SECOND SETTLEMENT',
    tag: 'ATOMIC DVP',
    body: 'On-time proof releases 99.5% immediately. Late delivery rebates the buyer mathematically in one atomic transaction.',
  },
]

export function ProcessBar() {
  return (
    <div id="how-it-works" className="border-t border-paper/10">
      {/* Outcome & Ecosystem Bar */}
      <div className="overflow-hidden border-b border-paper/10 bg-black py-4">
        <div className="flex w-max animate-marquee items-center gap-10 whitespace-nowrap">
          {[...OUTCOME_BAR_ITEMS, ...OUTCOME_BAR_ITEMS, ...OUTCOME_BAR_ITEMS, ...OUTCOME_BAR_ITEMS].map(
            (item, idx) => (
              <span
                key={`${item}-${idx}`}
                className="inline-flex items-center gap-10 font-mono text-[11.5px] font-medium uppercase tracking-[0.16em] text-paper/80"
              >
                <span>{item}</span>
                <span className="size-1.5 rounded-full bg-lime" />
              </span>
            ),
          )}
        </div>
      </div>

      {/* Full-Bleed Warm Paper (#F4F2EC) Editorial Contrast Section */}
      <section className="bg-paper py-28 text-ink lg:py-36">
        <div className="mx-auto max-w-[1380px] px-6 lg:px-10">
          <div className="flex flex-col justify-between gap-8 border-b border-ink/15 pb-12 lg:flex-row lg:items-end">
            <Reveal className="max-w-2xl">
              <p className="font-mono text-[11.5px] font-medium uppercase tracking-[0.14em] text-ink/60">
                01 // HOW IT WORKS · GUARANTEED OUTCOME PROTECTION
              </p>
              <h2 className="rwa-display mt-4 text-[clamp(2.2rem,4.2vw,3.8rem)] uppercase text-ink">
                FROM ESCROW LINK TO ATOMIC FINALITY.
              </h2>
            </Reveal>
            <Reveal delayMs={100} className="max-w-md">
              <p className="text-[15.5px] leading-relaxed text-ink/70">
                Every stage executes deterministically on-chain with non-custodial smart contracts, hardware-pinned
                verification, and continuous SLA math.
              </p>
            </Reveal>
          </div>

          <div className="mt-12 grid items-stretch gap-6 md:grid-cols-2 lg:grid-cols-4">
            {LIFECYCLE_STEPS.map((step, i) => (
              <Reveal key={step.num} delayMs={i * 90} className="h-full">
                <article className="flex h-full flex-col justify-between rounded-2xl border border-ink/12 bg-white/55 p-7 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1">
                  <div>
                    <div className="flex items-center justify-between border-b border-ink/10 pb-4">
                      <span className="font-mono text-[13px] font-semibold tracking-[0.12em] text-ink">
                        {step.num}
                      </span>
                      <span className="rounded-full border border-ink/15 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/65">
                        {step.tag}
                      </span>
                    </div>
                    <h3 className="rwa-display mt-6 text-[22px] uppercase text-ink">{step.title}</h3>
                    <p className="mt-3 text-[14px] leading-relaxed text-ink/75">{step.body}</p>
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
