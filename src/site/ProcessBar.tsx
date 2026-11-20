import { Reveal } from '@/components/ui'

const MARQUEE_ITEMS = [
  'ARC NATIVE USDC',
  'GEMINI PREDICTION MARKETS',
  'GROK AI AUDITOR',
  'QUICKNODE STREAMS',
  'ELEVENLABS VOICE',
  '@DIPTOS/SDK',
]

const LIFECYCLE_STEPS = [
  {
    num: '01',
    title: 'ORIGINATE',
    tag: 'LINK & SCOPE',
    body: 'Compose a programmable escrow link with scope, SLA window, and live Gemini-calibrated TECD decay rate.',
  },
  {
    num: '02',
    title: 'LOCK ON ARC',
    tag: 'NATIVE USDC',
    body: 'Buyer locks native USDC atomically into DiptosEscrow.sol. Canonical keccak256 hashes block double-spend.',
  },
  {
    num: '03',
    title: 'AI & MACRO AUDIT',
    tag: 'GROK EIP-712',
    body: 'Grok ingests live GitHub PR diffs or URLs, audits scope compliance, and signs a nonce-bound EIP-712 release.',
  },
  {
    num: '04',
    title: 'TECD SETTLEMENT',
    tag: 'ATOMIC DVP',
    body: 'On-time delivery settles 99.5% immediately. Late delivery rebates the buyer mathematically in one transaction.',
  },
]

export function ProcessBar() {
  return (
    <div className="border-t border-white/[0.08]">
      {/* Kinetic Continuous Marquee Strip */}
      <div className="overflow-hidden border-b border-white/[0.08] bg-[#090A0D] py-3.5">
        <div className="flex w-max animate-marquee items-center gap-10 whitespace-nowrap">
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS, ...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, idx) => (
            <span
              key={`${item}-${idx}`}
              className="inline-flex items-center gap-10 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-secondary"
            >
              <span>{item}</span>
              <span className="size-1.5 rounded-full bg-emerald" />
            </span>
          ))}
        </div>
      </div>

      {/* Symmetrical Equal-Height 4-Card Lifecycle Section */}
      <section className="bg-[#090A0D] py-20 lg:py-24">
        <div className="mx-auto max-w-[1320px] px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-6 border-b border-white/[0.08] pb-10 lg:flex-row lg:items-end">
            <Reveal className="max-w-2xl">
              <p className="rwa-hud text-secondary">PROTOCOL LIFECYCLE // 01 → 04</p>
              <h2 className="rwa-display mt-3 text-[28px] uppercase text-[#F4F2EC] sm:text-[38px]">
                FROM ESCROW LINK TO ATOMIC FINALITY.
              </h2>
            </Reveal>
            <Reveal delayMs={100} className="max-w-md">
              <p className="text-[14.5px] leading-relaxed text-secondary">
                Every stage executes deterministically between Arc Testnet smart contracts, xAI Grok EIP-712
                attestations, and real-time Gemini risk calibration.
              </p>
            </Reveal>
          </div>

          <div className="mt-10 grid items-stretch gap-5 md:grid-cols-2 lg:grid-cols-4">
            {LIFECYCLE_STEPS.map((step, i) => (
              <Reveal key={step.num} delayMs={i * 70} className="h-full">
                <article className="flex h-full flex-col justify-between rounded-xl border border-white/[0.08] bg-[#111318] p-6 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[1px] hover:border-white/[0.15] hover:bg-[#161922]">
                  <div>
                    <div className="flex items-center justify-between border-b border-white/[0.08] pb-3.5">
                      <span className="font-mono text-[12px] font-semibold tracking-[0.12em] text-[#F4F2EC]">
                        {step.num}
                      </span>
                      <span className="rounded-full border border-white/[0.1] bg-[#161922] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-secondary">
                        {step.tag}
                      </span>
                    </div>
                    <h3 className="rwa-display mt-5 text-[20px] uppercase text-[#F4F2EC]">{step.title}</h3>
                    <p className="mt-2.5 text-[13.5px] leading-relaxed text-secondary">{step.body}</p>
                  </div>
                  <div className="mt-6 h-[2px] w-full overflow-hidden rounded-full bg-white/[0.08]">
                    <div
                      className="h-full bg-emerald"
                      style={{ width: `${(i + 1) * 25}%` }}
                    />
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
