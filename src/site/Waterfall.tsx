import { useEffect, useMemo, useState } from 'react'
import { Check, ShieldCheck } from 'lucide-react'
import { formatEther, parseUnits } from 'viem'
import { fmtAmount } from '@/lib/chain'
import { diptos } from '@/lib/sdk'

interface TECDDisplay {
  payeePayoutUsdc: number
  buyerRebateUsdc: number
  protocolFeeUsdc: number
  decayPercent: number
  source: 'arc-eth-call' | 'sdk-wad'
}

interface SlaPreset {
  id: 'strict' | 'standard' | 'agent'
  name: string
  lambda: number
  windowHours: number
  summary: string
}

const SLA_PRESETS: SlaPreset[] = [
  {
    id: 'strict',
    name: 'Strict Sprint',
    lambda: 0.8,
    windowHours: 24,
    summary: 'Steep late-delivery rebate curve for time-critical launches and urgent audits.',
  },
  {
    id: 'standard',
    name: 'Standard Milestone',
    lambda: 0.5,
    windowHours: 72,
    summary: 'Balanced buyer protection for freelance design, engineering, and contract sprints.',
  },
  {
    id: 'agent',
    name: 'AI Agent SLA',
    lambda: 0.35,
    windowHours: 12,
    summary: 'Smooth continuous rebate calibrated for autonomous agent tasks and x402 API jobs.',
  },
]

export function Waterfall() {
  const [amountUsdc, setAmountUsdc] = useState(5000)
  const [slaWindowHours, setSlaWindowHours] = useState(24)
  const [delayHours, setDelayHours] = useState(12)
  const [effectiveLambda, setEffectiveLambda] = useState(0.5)
  const [activePreset, setActivePreset] = useState<string>('standard')

  const applyPreset = (preset: SlaPreset) => {
    setActivePreset(preset.id)
    setEffectiveLambda(preset.lambda)
    setSlaWindowHours(preset.windowHours)
  }

  const [result, setResult] = useState<TECDDisplay>(() => {
    const local = diptos.calculateTECD({
      principalUsdc: 5000,
      lambda: 0.5,
      delaySeconds: 12 * 3600,
      totalDurationSeconds: 24 * 3600,
      gamma: 1.5,
    })
    return {
      payeePayoutUsdc: local.payeePayoutUsdc,
      buyerRebateUsdc: local.buyerRebateUsdc,
      protocolFeeUsdc: local.protocolFeeUsdc,
      decayPercent: local.decayPercent,
      source: 'sdk-wad',
    }
  })

  useEffect(() => {
    let alive = true
    const immediate = diptos.calculateTECD({
      principalUsdc: amountUsdc,
      lambda: effectiveLambda,
      delaySeconds: delayHours * 3600,
      totalDurationSeconds: slaWindowHours * 3600,
      gamma: 1.5,
    })
    setResult({
      payeePayoutUsdc: immediate.payeePayoutUsdc,
      buyerRebateUsdc: immediate.buyerRebateUsdc,
      protocolFeeUsdc: immediate.protocolFeeUsdc,
      decayPercent: immediate.decayPercent,
      source: 'sdk-wad',
    })

    const timer = setTimeout(() => {
      if (amountUsdc <= 0) return
      const nowSec = Math.floor(Date.now() / 1000)
      const deadlineUnix = BigInt(nowSec + Math.max(60, Math.round(slaWindowHours * 3600)))
      const simulatedTimestamp = deadlineUnix + BigInt(Math.max(0, Math.round(delayHours * 3600)))

      diptos
        .previewTECDPayoutOnChain({
          amountWei: parseUnits(String(amountUsdc), 18),
          deadlineUnix,
          simulatedTimestamp,
          lambdaBps: BigInt(Math.round(effectiveLambda * 10_000)),
        })
        .then((onChain) => {
          if (!alive) return
          setResult({
            payeePayoutUsdc: Number(formatEther(onChain.payeePayout)),
            buyerRebateUsdc: Number(formatEther(onChain.payerRebate)),
            protocolFeeUsdc: Number(formatEther(onChain.protocolFee)),
            decayPercent: Number(onChain.decayBps) / 100,
            source: 'arc-eth-call',
          })
        })
        .catch(() => {})
    }, 150)

    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [amountUsdc, delayHours, slaWindowHours, effectiveLambda])

  const curve = useMemo(() => {
    const w = 520
    const h = 136
    const padX = 12
    const padY = 14
    const pts: string[] = []
    for (let hr = 0; hr <= 72; hr += 2) {
      const r = diptos.calculateTECD({
        principalUsdc: 100,
        lambda: effectiveLambda,
        delaySeconds: hr * 3600,
        totalDurationSeconds: slaWindowHours * 3600,
        gamma: 1.5,
      })
      const x = padX + (hr / 72) * (w - padX * 2)
      const y = padY + (1 - r.retentionRatio) * (h - padY * 2)
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
    }
    const curRatio = diptos.calculateTECD({
      principalUsdc: 100,
      lambda: effectiveLambda,
      delaySeconds: delayHours * 3600,
      totalDurationSeconds: slaWindowHours * 3600,
      gamma: 1.5,
    }).retentionRatio
    const dotX = padX + (delayHours / 72) * (w - padX * 2)
    const dotY = padY + (1 - curRatio) * (h - padY * 2)
    return { w, h, path: `M ${pts.join(' L ')}`, dotX, dotY }
  }, [effectiveLambda, slaWindowHours, delayHours])

  return (
    <section id="tecd-risk" className="mx-auto max-w-[1280px] border-t border-paper/12 px-6 py-20 lg:px-8">
      <div className="max-w-2xl">
        <p className="rwa-hud text-lime">03 // LATE-DELIVERY MATH</p>
        <h2 className="rwa-display mt-3 text-[28px] text-paper sm:text-[38px]">
          AUTOMATIC BUYER REBATE. ZERO DISPUTES.
        </h2>
      </div>

      {/* Symmetrical 12-Column Equal-Height 2-Card Grid */}
      <div className="mt-10 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
        {/* Left Card (7 cols): Live On-Chain previewTECDPayout() Decay Curve */}
        <div className="rwa-depth-card flex flex-col justify-between rounded-2xl p-7 lg:col-span-7">
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-secondary">
                V(t) = V₀ · e^(−{effectiveLambda.toFixed(2)} · ({delayHours}/{slaWindowHours})^1.5)
              </p>
              <span
                className={`font-mono text-[11px] uppercase tracking-[0.12em] ${
                  delayHours === 0 ? 'text-emerald' : 'text-crimson'
                }`}
              >
                {delayHours === 0 ? 'ON-TIME // 0% REBATE' : `LATE +${delayHours}H // -${result.decayPercent.toFixed(1)}%`}
              </span>
            </div>

            <div className="mt-5 border-y border-paper/10 py-4">
              <svg viewBox={`0 0 ${curve.w} ${curve.h}`} className="h-[136px] w-full" aria-label="TECD Decay Curve">
                <line x1="12" y1="14" x2="508" y2="14" stroke="rgba(244,242,236,0.08)" strokeDasharray="3 4" />
                <line x1="12" y1="68" x2="508" y2="68" stroke="rgba(244,242,236,0.08)" strokeDasharray="3 4" />
                <line x1="12" y1="122" x2="508" y2="122" stroke="rgba(244,242,236,0.12)" />
                <path d={curve.path} fill="none" stroke="#C8FF00" strokeWidth="2.2" />
                <line
                  x1={curve.dotX}
                  y1={curve.dotY}
                  x2={curve.dotX}
                  y2="122"
                  stroke="rgba(200,255,0,0.35)"
                  strokeDasharray="2 3"
                />
                <circle cx={curve.dotX} cy={curve.dotY} r="5" fill="#C8FF00" />
              </svg>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-4">
              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-secondary">PRINCIPAL (USDC)</span>
                <input
                  type="number"
                  min={1}
                  value={amountUsdc}
                  onChange={(e) => setAmountUsdc(Math.max(1, Number(e.target.value) || 0))}
                  className="mt-1.5 h-9 w-full border-b border-paper/20 bg-transparent font-mono text-[14px] text-paper outline-none focus:border-lime"
                />
              </label>
              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-secondary">SLA WINDOW (H)</span>
                <input
                  type="number"
                  min={1}
                  max={720}
                  value={slaWindowHours}
                  onChange={(e) => {
                    setActivePreset('custom')
                    setSlaWindowHours(Math.max(1, Number(e.target.value) || 1))
                  }}
                  className="mt-1.5 h-9 w-full border-b border-paper/20 bg-transparent font-mono text-[14px] text-paper outline-none focus:border-lime"
                />
              </label>
              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-secondary">
                  CUSTOM λ
                </span>
                <input
                  type="number"
                  step="0.05"
                  min={0.05}
                  max={2}
                  value={Number(effectiveLambda.toFixed(2))}
                  onChange={(e) => {
                    setActivePreset('custom')
                    setEffectiveLambda(Math.max(0.05, Math.min(2, Number(e.target.value) || 0.05)))
                  }}
                  className="mt-1.5 h-9 w-full border-b border-paper/20 bg-transparent font-mono text-[14px] text-lime outline-none focus:border-lime"
                />
              </label>
            </div>

            <div className="mt-6">
              <div className="flex items-baseline justify-between font-mono text-[11px] uppercase tracking-[0.1em]">
                <span className="text-secondary">DELIVERY DELAY (0H → 72H)</span>
                <span className="text-lime">{delayHours} HOURS LATE</span>
              </div>
              <input
                type="range"
                min={0}
                max={72}
                step={1}
                value={delayHours}
                onChange={(e) => setDelayHours(Number(e.target.value))}
                aria-label="Delivery delay in hours"
                className="mt-3 w-full cursor-pointer"
              />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-4 border-t border-paper/10 pt-5 font-mono">
            <div>
              <p className="text-[10px] uppercase text-secondary">PAYEE PAYOUT</p>
              <p className="mt-1 text-[18px] font-semibold text-emerald">{fmtAmount(result.payeePayoutUsdc)} USDC</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-secondary">AUTO BUYER REBATE</p>
              <p className="mt-1 text-[18px] font-semibold text-crimson">{fmtAmount(result.buyerRebateUsdc)} USDC</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-secondary">FEE (0.5%)</p>
              <p className="mt-1 text-[18px] font-semibold text-paper">{fmtAmount(result.protocolFeeUsdc)} USDC</p>
            </div>
          </div>
        </div>

        {/* Right Card (5 cols): Interactive SLA Protection Presets driving live previewTECDPayout() */}
        <div className="rwa-depth-card flex flex-col justify-between rounded-2xl p-7 lg:col-span-5">
          <div>
            <div className="flex items-center justify-between gap-3 border-b border-paper/10 pb-4">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-lime">
                  SLA PROTECTION PRESETS
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-secondary">
                  DiptosEscrow.previewTECDPayout()
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald/35 bg-emerald/10 px-2.5 py-0.5 font-mono text-[10px] text-emerald">
                <ShieldCheck className="size-3" />
                {result.source === 'arc-eth-call' ? 'ARC ETH_CALL' : 'WAD PARITY'}
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {SLA_PRESETS.map((preset) => {
                const selected = activePreset === preset.id
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className={`w-full rounded-xl border p-4 text-left transition-colors ${
                      selected
                        ? 'border-lime/60 bg-lime/[0.07]'
                        : 'border-paper/10 bg-black/40 hover:border-paper/25'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[12.5px] font-semibold uppercase tracking-[0.06em] text-paper">
                        {preset.name}
                      </span>
                      <span className="inline-flex items-center gap-1.5 font-mono text-[11.5px] font-semibold text-lime">
                        λ = {preset.lambda.toFixed(2)}
                        {selected && <Check className="size-3.5" />}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-secondary">{preset.summary}</p>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-paper/10 pt-4 font-mono text-[10.5px] text-secondary">
            <span>ACTIVE PRESET: {activePreset.toUpperCase()}</span>
            <span className="text-paper">ON-CHAIN FIXED-POINT WAD</span>
          </div>
        </div>
      </div>
    </section>
  )
}
