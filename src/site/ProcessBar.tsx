const STEPS = [
  {
    index: '01 / ORIGINATE',
    body: 'Create a shareable diptos.xyz/pay/:id link or call diptos.createEscrowLink() from an AI agent.',
  },
  {
    index: '02 / LOCK USDC',
    body: 'Payer locks native USDC on Arc Testnet (5042002) with canonical keccak256 anti-double-spend protection.',
  },
  {
    index: '03 / AI & MACRO AUDIT',
    body: 'Gemini Prediction Markets calibrates real-time risk λ; Grok AI audits submitted deliverables.',
  },
  {
    index: '04 / ATOMIC SETTLEMENT',
    body: 'On-time delivery pays 99.5% instantly; late delivery triggers automatic TECD rebate math.',
  },
] as const

export function ProcessBar() {
  return (
    <section id="how-it-works" className="border-y border-white/[0.08] bg-surface/50">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        <div className="grid divide-y divide-white/[0.08] md:grid-cols-2 md:divide-y-0 lg:grid-cols-4 lg:divide-x">
          {STEPS.map((step) => (
            <div key={step.index} className="py-7 lg:px-6 lg:first:pl-0 lg:last:pr-0">
              <p className="font-mono text-[11px] font-semibold tracking-[0.12em] text-gold">{step.index}</p>
              <p className="mt-2.5 text-[13px] leading-relaxed text-secondary">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
