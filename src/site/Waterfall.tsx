import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, TrendingUp } from 'lucide-react'
import { Button, Eyebrow, Reveal } from '@/components/ui'
import { fmtAmount } from '@/lib/chain'
import { useGeminiRisk } from '@/lib/hooks'
import { diptos, type OnChainTECDPreview } from '@/lib/sdk'

export function Waterfall() {
  const { data: gemini, loading: geminiLoading, error: geminiError, refresh: refreshGemini } = useGeminiRisk()

  const [amountUsdc, setAmountUsdc] = useState(5000)
  const [slaWindowHours, setSlaWindowHours] = useState(24)
  const [delayHours, setDelayHours] = useState(14)
  const [manualLambda, setManualLambda] = useState<number | null>(null)

  const effectiveLambda = manualLambda ?? gemini?.recommendedLambda ?? 0.35

  const [result, setResult] = useState<OnChainTECDPreview>(() => {
    const init = diptos.calculateTECD({
      principalUsdc: 5000,
      lambda: 0.35,
      delaySeconds: 14 * 3600,
      totalDurationSeconds: 24 * 3600,
    })
    return {
      payeePayoutUsdc: init.payeePayoutUsdc,
      buyerRebateUsdc: init.buyerRebateUsdc,
      protocolFeeUsdc: init.protocolFeeUsdc,
      decayPercent: init.decayPercent,
      source: 'sdk-wad-fallback',
    }
  })

  useEffect(() => {
    let alive = true
    const immediate = diptos.calculateTECD({
      principalUsdc: amountUsdc,
      lambda: effectiveLambda,
      delaySeconds: delayHours * 3600,
      totalDurationSeconds: slaWindowHours * 3600,
    })
    setResult({
      payeePayoutUsdc: immediate.payeePayoutUsdc,
      buyerRebateUsdc: immediate.buyerRebateUsdc,
      protocolFeeUsdc: immediate.protocolFeeUsdc,
      decayPercent: immediate.decayPercent,
      source: 'sdk-wad-fallback',
    })

    const timer = setTimeout(() => {
      diptos
        .previewTECDOnChain({
          principalUsdc: amountUsdc,
          slaWindowSeconds: slaWindowHours * 3600,
          delaySeconds: delayHours * 3600,
          lambda: effectiveLambda,
        })
        .then((onChain) => {
          if (alive) setResult(onChain)
        })
        .catch(() => {})
    }, 150)

    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [amountUsdc, delayHours, slaWindowHours, effectiveLambda])

  // Build smooth SVG exponential decay path over 0h -> 72h
  const svgCurve = useMemo(() => {
    const W = 560
    const H = 190
    const padX = 16
    const padY = 18
    const plotW = W - padX * 2
    const plotH = H - padY * 2

    const pts: string[] = []
    for (let h = 0; h <= 72; h += 2) {
      const r = h === 0 ? 1 : Math.exp(-effectiveLambda * Math.pow(h / Math.max(1, slaWindowHours), 1.5))
      const x = padX + (h / 72) * plotW
      const y = padY + (1 - r) * plotH
      pts.push(`${h === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`)
    }
    const linePath = pts.join(' ')
    const areaPath = `${linePath} L ${(padX + plotW).toFixed(1)} ${(padY + plotH).toFixed(1)} L ${padX} ${(padY + plotH).toFixed(1)} Z`

    const activeRatio =
      delayHours === 0 ? 1 : Math.exp(-effectiveLambda * Math.pow(delayHours / Math.max(1, slaWindowHours), 1.5))
    const markerX = padX + (delayHours / 72) * plotW
    const markerY = padY + (1 - activeRatio) * plotH

    return { W, H, linePath, areaPath, markerX, markerY }
  }, [effectiveLambda, slaWindowHours, delayHours])

  return (
    <section id="tecd-risk" className="border-t border-paper/10 bg-black py-28 lg:py-36">
      <div className="mx-auto max-w-[1380px] px-6 lg:px-10">
        <Reveal className="max-w-2xl">
          <Eyebrow>03 // TECD &amp; MACRO RISK STUDIO</Eyebrow>
          <h2 className="rwa-display mt-4 text-[clamp(2rem,4vw,3.4rem)] uppercase text-paper">
            EXPONENTIAL SLA DECAY CALIBRATED BY GEMINI.
          </h2>
          <p className="mt-4 text-[16px] leading-relaxed text-secondary">
            Drag the delay slider to inspect real-time Solidity WAD math via{' '}
            <code className="font-mono text-paper">DiptosEscrow.previewTECDPayout</code> while live Gemini Prediction
            Markets probabilities tune <code className="font-mono text-lime">λ</code>.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-6 lg:grid-cols-12">
          {/* Left 7 cols: Morphing SVG TECD Curve Studio */}
          <Reveal className="rounded-2xl border border-paper/10 bg-surface p-8 lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-paper/10 pb-5">
              <div>
                <p className="rwa-hud text-lime">
                  {result.source === 'arc-eth-call' ? 'LIVE ARC ETH_CALL' : 'SOLIDITY WAD CURVE'}
                </p>
                <h3 className="rwa-display mt-1.5 text-[22px] text-paper">
                  V(t) = V₀ · e^(−{effectiveLambda.toFixed(2)} · ({delayHours}/{slaWindowHours})^1.5)
                </h3>
              </div>
              <span
                className={`rounded-full border px-3.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.12em] ${
                  delayHours === 0
                    ? 'border-emerald/35 bg-emerald/10 text-emerald'
                    : 'border-lime/40 bg-lime/10 text-lime'
                }`}
              >
                {delayHours === 0 ? 'ON-TIME · 0% DECAY' : `LATE +${delayHours}H · -${result.decayPercent.toFixed(1)}%`}
              </span>
            </div>

            {/* Morphing SVG Curve */}
            <div className="mt-6 overflow-hidden rounded-xl border border-paper/10 bg-black p-4">
              <svg viewBox={`0 0 ${svgCurve.W} ${svgCurve.H}`} className="h-44 w-full">
                <defs>
                  <linearGradient id="tecdFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#C8FF00" stopOpacity="0.24" />
                    <stop offset="100%" stopColor="#C8FF00" stopOpacity="0.01" />
                  </linearGradient>
                </defs>
                {/* Reference grid lines */}
                <line x1="16" y1="18" x2="544" y2="18" stroke="rgba(244,242,236,0.08)" strokeDasharray="3 4" />
                <line x1="16" y1="95" x2="544" y2="95" stroke="rgba(244,242,236,0.08)" strokeDasharray="3 4" />
                <line x1="16" y1="172" x2="544" y2="172" stroke="rgba(244,242,236,0.12)" />
                {/* Decay area + Acid Lime stroke */}
                <path d={svgCurve.areaPath} fill="url(#tecdFill)" />
                <path
                  d={svgCurve.linePath}
                  fill="none"
                  stroke="#C8FF00"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                {/* Active marker */}
                <line
                  x1={svgCurve.markerX}
                  y1={svgCurve.markerY}
                  x2={svgCurve.markerX}
                  y2={172}
                  stroke="rgba(200,255,0,0.4)"
                  strokeDasharray="2 3"
                />
                <circle cx={svgCurve.markerX} cy={svgCurve.markerY} r="6" fill="#C8FF00" />
                <circle cx={svgCurve.markerX} cy={svgCurve.markerY} r="11" fill="#C8FF00" fillOpacity="0.2" />
              </svg>
            </div>

            {/* Delivery Delay Slider */}
            <div className="mt-6">
              <div className="flex items-baseline justify-between font-mono text-[11.5px] uppercase tracking-[0.1em]">
                <span className="text-secondary">DELIVERY DELAY SLIDER (0H → 72H)</span>
                <span className="text-[15px] font-semibold text-lime">+{delayHours}H</span>
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
              <div className="mt-1 flex justify-between font-mono text-[10px] text-secondary">
                <span>0H (ON-TIME)</span>
                <span>24H</span>
                <span>48H</span>
                <span>72H</span>
              </div>
            </div>

            {/* Inputs */}
            <div className="mt-6 grid grid-cols-3 gap-3">
              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-secondary">USDC</span>
                <input
                  type="number"
                  min={10}
                  value={amountUsdc}
                  onChange={(e) => setAmountUsdc(Math.max(1, Number(e.target.value) || 0))}
                  className="mt-1.5 h-10 w-full rounded-xl border border-paper/15 bg-black px-3 font-mono text-[13px] text-paper outline-none focus:border-lime"
                />
              </label>
              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-secondary">SLA (HRS)</span>
                <input
                  type="number"
                  min={1}
                  max={720}
                  value={slaWindowHours}
                  onChange={(e) => setSlaWindowHours(Math.max(1, Number(e.target.value) || 1))}
                  className="mt-1.5 h-10 w-full rounded-xl border border-paper/15 bg-black px-3 font-mono text-[13px] text-paper outline-none focus:border-lime"
                />
              </label>
              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-secondary">LAMBDA λ</span>
                <input
                  type="number"
                  step="0.01"
                  min={0.05}
                  max={2}
                  value={effectiveLambda}
                  onChange={(e) => setManualLambda(Math.max(0.05, Math.min(2, Number(e.target.value) || 0.05)))}
                  className="mt-1.5 h-10 w-full rounded-xl border border-paper/15 bg-black px-3 font-mono text-[13px] text-lime outline-none focus:border-lime"
                />
              </label>
            </div>

            {/* Payout Breakdown */}
            <div className="mt-7 grid grid-cols-3 gap-3 border-t border-paper/10 pt-6 font-mono">
              <div>
                <span className="block text-[10px] uppercase tracking-[0.12em] text-secondary">PAYEE PAYOUT</span>
                <span className="mt-1 block text-[20px] font-semibold tabular-nums text-emerald">
                  ${fmtAmount(result.payeePayoutUsdc)}
                </span>
              </div>
              <div>
                <span className="block text-[10px] uppercase tracking-[0.12em] text-secondary">BUYER REBATE</span>
                <span className="mt-1 block text-[20px] font-semibold tabular-nums text-lime">
                  ${fmtAmount(result.buyerRebateUsdc)}
                </span>
              </div>
              <div>
                <span className="block text-[10px] uppercase tracking-[0.12em] text-secondary">FEE (0.5%)</span>
                <span className="mt-1 block text-[20px] font-semibold tabular-nums text-paper">
                  ${fmtAmount(result.protocolFeeUsdc)}
                </span>
              </div>
            </div>
          </Reveal>

          {/* Right 5 cols: Live Gemini Prediction Markets Risk Oracle */}
          <Reveal delayMs={100} className="rwa-depth-card flex flex-col justify-between rounded-2xl p-8 lg:col-span-5">
            <div>
              <div className="flex items-start justify-between gap-3 border-b border-paper/10 pb-5">
                <div>
                  <p className="rwa-hud inline-flex items-center gap-1.5 text-lime">
                    <TrendingUp className="size-3.5" /> GEMINI PREDICTION MARKETS
                  </p>
                  <h3 className="rwa-display mt-1.5 text-[22px] text-paper">Live Macro Risk Oracle</h3>
                </div>
                <Button size="sm" variant="secondary" loading={geminiLoading} onClick={() => void refreshGemini()}>
                  {!geminiLoading && <RefreshCw className="size-3.5" />} SYNC
                </Button>
              </div>

              {gemini ? (
                <>
                  <div className="mt-6 grid grid-cols-2 gap-4 border-b border-paper/10 pb-6 font-mono">
                    <div>
                      <span className="block text-[10px] uppercase tracking-[0.12em] text-secondary">
                        VOLATILITY INDEX
                      </span>
                      <span className="mt-1 block text-[26px] font-semibold tabular-nums text-paper">
                        {(gemini.volatilityIndex * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase tracking-[0.12em] text-secondary">
                        CALIBRATED λ
                      </span>
                      <button
                        type="button"
                        onClick={() => setManualLambda(null)}
                        className="mt-1 block text-left text-[26px] font-semibold tabular-nums text-lime hover:underline"
                      >
                        {gemini.recommendedLambda.toFixed(2)}
                      </button>
                    </div>
                  </div>

                  <ul className="mt-5 divide-y divide-paper/10">
                    {gemini.contracts.slice(0, 5).map((c) => (
                      <li key={c.instrumentSymbol} className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-paper">{c.title}</p>
                          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-secondary">
                            {c.instrumentSymbol}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full border border-emerald/35 bg-emerald/10 px-3 py-1 font-mono text-[10.5px] font-medium tabular-nums text-emerald">
                          YES {Math.round(c.yesProbability * 100)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : geminiError ? (
                <div className="mt-6 rounded-xl border border-crimson/35 bg-crimson/10 p-4 font-mono text-[12px] text-crimson">
                  Gemini feed unreachable ({geminiError}). Manual λ tuning remains active.
                </div>
              ) : (
                <div className="mt-6 space-y-3">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-12 animate-pulse rounded-xl bg-black/60" />
                  ))}
                </div>
              )}
            </div>

            <p className="mt-6 border-t border-paper/10 pt-4 font-mono text-[10.5px] uppercase tracking-[0.1em] text-secondary">
              SOURCE: API.GEMINI.COM/V1/PREDICTION-MARKETS/EVENTS
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
