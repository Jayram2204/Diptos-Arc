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
  const [hoveredHour, setHoveredHour] = useState<number | null>(null)

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

  const maxDelayHours = Math.max(72, slaWindowHours)

  const curve = useMemo(() => {
    const w = 520
    const h = 166
    const padLeft = 40
    const padRight = 14
    const padTop = 14
    const padBottom = 28
    const plotW = w - padLeft - padRight
    const plotH = h - padTop - padBottom

    const pts: string[] = []
    const steps = 36
    for (let i = 0; i <= steps; i++) {
      const hr = (i / steps) * maxDelayHours
      const r = diptos.calculateTECD({
        principalUsdc: 100,
        lambda: effectiveLambda,
        delaySeconds: hr * 3600,
        totalDurationSeconds: slaWindowHours * 3600,
        gamma: 1.5,
      })
      const x = padLeft + (hr / maxDelayHours) * plotW
      const y = padTop + (1 - r.retentionRatio) * plotH
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
    }

    const activeHr = Math.min(maxDelayHours, hoveredHour ?? delayHours)
    const activeCalc = diptos.calculateTECD({
      principalUsdc: amountUsdc,
      lambda: effectiveLambda,
      delaySeconds: activeHr * 3600,
      totalDurationSeconds: slaWindowHours * 3600,
      gamma: 1.5,
    })
    const dotX = padLeft + (activeHr / maxDelayHours) * plotW
    const dotY = padTop + (1 - activeCalc.retentionRatio) * plotH

    const xTicks = [
      { label: '0h', hr: 0 },
      { label: '+25%', hr: slaWindowHours * 0.25 },
      { label: '+50%', hr: slaWindowHours * 0.5 },
      { label: '+100%', hr: slaWindowHours },
    ]
      .filter((t) => t.hr <= maxDelayHours)
      .map((t) => ({
        ...t,
        x: padLeft + (t.hr / maxDelayHours) * plotW,
      }))

    return {
      w,
      h,
      padLeft,
      padRight,
      padTop,
      padBottom,
      plotW,
      plotH,
      path: `M ${pts.join(' L ')}`,
      dotX,
      dotY,
      activeHr,
      activeCalc,
      xTicks,
    }
  }, [effectiveLambda, slaWindowHours, delayHours, hoveredHour, amountUsdc, maxDelayHours])

  const handleSvgMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const relX = ((e.clientX - rect.left) / rect.width) * curve.w
    const clamped = Math.max(curve.padLeft, Math.min(curve.w - curve.padRight, relX))
    const hr = Math.round(((clamped - curve.padLeft) / curve.plotW) * maxDelayHours)
    setHoveredHour(hr)
  }

  return (
    <section id="tecd-risk" className="mx-auto max-w-[1280px] px-5 py-24 sm:px-6 lg:px-8">
      <div className="max-w-2xl">
        <p className="rwa-hud text-lime">03 // LATE-DELIVERY MATH</p>
        <h2 className="rwa-display mt-3 text-[28px] text-white sm:text-[38px]">
          AUTOMATIC BUYER REBATE. NO MANUAL DISPUTES OVER LATENESS.
        </h2>
      </div>

      {/* Symmetrical 12-Column Equal-Height 2-Card Grid (Strict Black / White / Lime) */}
      <div className="mt-10 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
        {/* Left Card (7 cols): Live On-Chain previewTECDPayout() Decay Curve */}
        <div className="flex flex-col justify-between rounded-[12px] border border-white/10 bg-[#111111] p-7 lg:col-span-7">
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-mono text-[13px] normal-case tracking-[0.01em] text-white">
                V(t) = V₀ · e^(−{effectiveLambda.toFixed(2)} · ({delayHours}/{slaWindowHours})^1.5)
              </p>
              <span
                className={`font-mono text-[12px] font-semibold uppercase tracking-[0.04em] ${
                  delayHours === 0 ? 'text-white' : 'text-lime'
                }`}
              >
                {delayHours === 0 ? 'ON-TIME // 0% REBATE' : `LATE +${delayHours}H // -${result.decayPercent.toFixed(1)}%`}
              </span>
            </div>

            <div className="relative mt-5 border-y border-white/10 py-3.5">
              {hoveredHour !== null && (
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/15 bg-black px-3 py-1.5 font-mono text-[12px] text-[#A3A3A3]">
                  <span className="text-white">Hover: +{curve.activeHr}h late</span>
                  <span>
                    Payee <strong className="text-white">{fmtAmount(curve.activeCalc.payeePayoutUsdc)}</strong> · Rebate{' '}
                    <strong className="text-lime">{fmtAmount(curve.activeCalc.buyerRebateUsdc)}</strong> USDC
                  </span>
                </div>
              )}
              <svg
                viewBox={`0 0 ${curve.w} ${curve.h}`}
                className="h-[170px] w-full cursor-crosshair"
                aria-label="TECD Decay Curve"
                onMouseMove={handleSvgMove}
                onMouseLeave={() => setHoveredHour(null)}
              >
                {/* Y-Axis grid & labels */}
                <line x1={curve.padLeft} y1={curve.padTop} x2={curve.w - curve.padRight} y2={curve.padTop} stroke="rgba(255,255,255,0.08)" strokeDasharray="3 4" />
                <line x1={curve.padLeft} y1={curve.padTop + curve.plotH / 2} x2={curve.w - curve.padRight} y2={curve.padTop + curve.plotH / 2} stroke="rgba(255,255,255,0.08)" strokeDasharray="3 4" />
                <line x1={curve.padLeft} y1={curve.padTop + curve.plotH} x2={curve.w - curve.padRight} y2={curve.padTop + curve.plotH} stroke="rgba(255,255,255,0.2)" />
                <text x="4" y={curve.padTop + 4} fill="#A3A3A3" fontSize="11" fontFamily="monospace">100%</text>
                <text x="10" y={curve.padTop + curve.plotH / 2 + 4} fill="#A3A3A3" fontSize="11" fontFamily="monospace">50%</text>
                <text x="16" y={curve.padTop + curve.plotH + 3} fill="#A3A3A3" fontSize="11" fontFamily="monospace">0%</text>

                {/* X-Axis ticks (0h, +25%, +50%, +100%) */}
                {curve.xTicks.map((t) => (
                  <g key={t.label}>
                    <line
                      x1={t.x}
                      y1={curve.padTop + curve.plotH}
                      x2={t.x}
                      y2={curve.padTop + curve.plotH + 4}
                      stroke="rgba(255,255,255,0.3)"
                    />
                    <text
                      x={t.x}
                      y={curve.h - 5}
                      textAnchor="middle"
                      fill="#A3A3A3"
                      fontSize="11"
                      fontFamily="monospace"
                    >
                      {t.label}
                    </text>
                  </g>
                ))}

                {/* Decay Curve */}
                <path d={curve.path} fill="none" stroke="#CCFF00" strokeWidth="2.2" />
                <line
                  x1={curve.dotX}
                  y1={curve.dotY}
                  x2={curve.dotX}
                  y2={curve.padTop + curve.plotH}
                  stroke="rgba(204,255,0,0.4)"
                  strokeDasharray="2 3"
                />
                <circle cx={curve.dotX} cy={curve.dotY} r="5" fill="#CCFF00" />
              </svg>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-4">
              <label className="block">
                <span className="font-mono text-[12px] uppercase tracking-[0.04em] text-[#A3A3A3]">Principal (USDC)</span>
                <input
                  type="number"
                  min={1}
                  value={amountUsdc}
                  onChange={(e) => setAmountUsdc(Math.max(1, Number(e.target.value) || 0))}
                  className="mt-1.5 h-10 w-full border-b border-white/20 bg-transparent font-mono text-[15px] text-white outline-none focus:border-lime"
                />
              </label>
              <label className="block">
                <span className="font-mono text-[12px] uppercase tracking-[0.04em] text-[#A3A3A3]">SLA Window (H)</span>
                <input
                  type="number"
                  min={1}
                  max={720}
                  value={slaWindowHours}
                  onChange={(e) => {
                    setActivePreset('custom')
                    setSlaWindowHours(Math.max(1, Number(e.target.value) || 1))
                  }}
                  className="mt-1.5 h-10 w-full border-b border-white/20 bg-transparent font-mono text-[15px] text-white outline-none focus:border-lime"
                />
              </label>
              <label className="block">
                <span className="font-mono text-[12px] uppercase tracking-[0.04em] text-[#A3A3A3]">
                  Custom <span className="normal-case">λ</span>
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
                  className="mt-1.5 h-10 w-full border-b border-white/20 bg-transparent font-mono text-[15px] text-white outline-none focus:border-lime"
                />
              </label>
            </div>

            <div className="mt-6">
              <div className="flex items-baseline justify-between font-mono text-[12.5px] uppercase tracking-[0.04em]">
                <span className="text-[#A3A3A3]">Delivery Delay (0h → {maxDelayHours}h)</span>
                <span className={delayHours === 0 ? 'text-white' : 'text-lime'}>{delayHours} HOURS LATE</span>
              </div>
              <input
                type="range"
                min={0}
                max={maxDelayHours}
                step={1}
                value={delayHours}
                onChange={(e) => setDelayHours(Number(e.target.value))}
                aria-label="Delivery delay in hours"
                className="mt-3 w-full cursor-pointer"
              />
            </div>
          </div>

          {(() => {
            const displayFee = Math.round(result.protocolFeeUsdc * 100) / 100
            const displayPayee = Math.round(result.payeePayoutUsdc * 100) / 100
            const displayRebate =
              delayHours === 0
                ? 0
                : Math.max(0, Math.round((amountUsdc - displayPayee - displayFee) * 100) / 100)
            const exactPayee =
              delayHours === 0
                ? Math.max(0, Math.round((amountUsdc - displayFee) * 100) / 100)
                : displayPayee

            return (
              <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3 font-mono tabular-nums">
                {/* White surface: Payee Payout */}
                <div className="rounded-[10px] bg-white p-4 text-black">
                  <p className="text-[11.5px] font-medium uppercase tracking-[0.04em] text-black/60">Payee Payout</p>
                  <p className="mt-1.5 text-[19px] font-bold text-black">{fmtAmount(exactPayee)} USDC</p>
                </div>
                {/* Lime surface: Auto Buyer Rebate */}
                <div className="rounded-[10px] bg-lime p-4 text-black">
                  <p className="text-[11.5px] font-medium uppercase tracking-[0.04em] text-black/65">Auto Buyer Rebate</p>
                  <p className="mt-1.5 text-[19px] font-bold text-black">{fmtAmount(displayRebate)} USDC</p>
                </div>
                {/* Graphite surface: Protocol Fee */}
                <div className="rounded-[10px] border border-white/15 bg-black p-4 text-white">
                  <p className="text-[11.5px] font-medium uppercase tracking-[0.04em] text-[#A3A3A3]">Fee (0.5%)</p>
                  <p className="mt-1.5 text-[19px] font-bold text-white">{fmtAmount(displayFee)} USDC</p>
                </div>
              </div>
            )
          })()}
        </div>

        {/* Right Card (5 cols): Interactive SLA Protection Presets */}
        <div className="flex flex-col justify-between rounded-[12px] border border-white/10 bg-[#111111] p-7 lg:col-span-5">
          <div>
            <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <p className="font-mono text-[13px] font-semibold uppercase tracking-[0.04em] text-white">
                  SLA Protection Presets
                </p>
                <p className="mt-0.5 font-mono text-[12px] text-[#A3A3A3]">
                  DiptosEscrow.previewTECDPayout()
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black px-3 py-1 font-mono text-[11px] text-lime">
                <ShieldCheck className="size-3.5" strokeWidth={1.5} />
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
                    className={`w-full rounded-[10px] border p-4 text-left transition-colors ${
                      selected
                        ? 'border-white bg-white text-black'
                        : 'border-white/10 bg-[#0E0E0E] text-white hover:border-white/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[13.5px] font-semibold tracking-[0.01em]">
                        {preset.name}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 font-mono text-[12.5px] font-semibold normal-case ${
                          selected ? 'text-black' : 'text-lime'
                        }`}
                      >
                        λ = {preset.lambda.toFixed(2)}
                        {selected && <Check className="size-3.5" strokeWidth={2} />}
                      </span>
                    </div>
                    <p className={`mt-1.5 text-[14px] leading-relaxed ${selected ? 'text-black/75' : 'text-[#A3A3A3]'}`}>
                      {preset.summary}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 font-mono text-[12px] text-[#A3A3A3]">
            <span>ACTIVE: {activePreset.toUpperCase()}</span>
            <span className="text-white">ON-CHAIN FIXED-POINT WAD</span>
          </div>
        </div>
      </div>
    </section>
  )
}
