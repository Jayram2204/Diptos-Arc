import { useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { formatEther, parseUnits } from 'viem'
import { fmtAmount } from '@/lib/chain'
import { useGeminiRisk } from '@/lib/hooks'
import { diptos } from '@/lib/sdk'

interface TECDDisplay {
  payeePayoutUsdc: number
  buyerRebateUsdc: number
  protocolFeeUsdc: number
  decayPercent: number
  source: 'arc-eth-call' | 'sdk-wad'
}

export function Waterfall() {
  const { data: gemini, loading: geminiLoading, error: geminiError, refresh: refreshGemini } = useGeminiRisk()

  const [amountUsdc, setAmountUsdc] = useState(5000)
  const [slaWindowHours, setSlaWindowHours] = useState(24)
  const [delayHours, setDelayHours] = useState(12)
  const [manualLambda, setManualLambda] = useState<number | null>(null)

  const effectiveLambda = manualLambda ?? gemini?.recommendedLambda ?? 0.35

  const [result, setResult] = useState<TECDDisplay>(() => {
    const local = diptos.calculateTECD({
      principalUsdc: 5000,
      lambda: 0.35,
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
    <section id="tecd-risk" className="mx-auto max-w-[1320px] border-t border-white/[0.08] px-6 py-20 lg:px-8">
      <div className="max-w-2xl">
        <p className="rwa-hud text-secondary">03 // TECD RISK &amp; GEMINI ORACLE</p>
        <h2 className="rwa-display mt-3 text-[28px] text-[#F4F2EC] sm:text-[38px]">
          EXPONENTIAL LATENCY DECAY. LIVE MACRO CALIBRATION.
        </h2>
      </div>

      {/* Symmetrical 12-Column Equal-Height 2-Card Grid */}
      <div className="mt-10 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
        {/* Left Card (7 cols): TECD Decay Curve + Interactive Simulator */}
        <div className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#111318] p-7 lg:col-span-7">
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-secondary">
                V(t) = V₀ · e^(−{effectiveLambda.toFixed(3)} · ({delayHours}/{slaWindowHours})^1.5)
              </p>
              <span
                className={`font-mono text-[11px] uppercase tracking-[0.12em] ${
                  delayHours === 0 ? 'text-emerald' : 'text-crimson'
                }`}
              >
                {delayHours === 0 ? 'ON-TIME // 0% DECAY' : `LATE +${delayHours}H // -${result.decayPercent.toFixed(1)}%`}
              </span>
            </div>

            <div className="mt-5 rounded-lg border border-white/[0.06] bg-[#090A0D] px-3 py-4">
              <svg viewBox={`0 0 ${curve.w} ${curve.h}`} className="h-[136px] w-full" aria-label="TECD Decay Curve">
                <line x1="12" y1="14" x2="508" y2="14" stroke="rgba(244,242,236,0.08)" strokeDasharray="3 4" />
                <line x1="12" y1="68" x2="508" y2="68" stroke="rgba(244,242,236,0.08)" strokeDasharray="3 4" />
                <line x1="12" y1="122" x2="508" y2="122" stroke="rgba(244,242,236,0.12)" />
                <path d={curve.path} fill="none" stroke="#F4F2EC" strokeWidth="2" />
                <line
                  x1={curve.dotX}
                  y1={curve.dotY}
                  x2={curve.dotX}
                  y2="122"
                  stroke="rgba(16,185,129,0.45)"
                  strokeDasharray="2 3"
                />
                <circle cx={curve.dotX} cy={curve.dotY} r="4.5" fill="#10B981" />
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
                  className="mt-1.5 h-9 w-full rounded-lg border border-white/[0.08] bg-[#161922] px-3 font-mono text-[13px] text-[#F4F2EC] outline-none transition-colors focus:border-white/30"
                />
              </label>
              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-secondary">SLA WINDOW (H)</span>
                <input
                  type="number"
                  min={1}
                  max={720}
                  value={slaWindowHours}
                  onChange={(e) => setSlaWindowHours(Math.max(1, Number(e.target.value) || 1))}
                  className="mt-1.5 h-9 w-full rounded-lg border border-white/[0.08] bg-[#161922] px-3 font-mono text-[13px] text-[#F4F2EC] outline-none transition-colors focus:border-white/30"
                />
              </label>
              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-secondary">
                  LAMBDA λ {manualLambda === null && gemini ? '(LIVE)' : ''}
                </span>
                <input
                  type="number"
                  step="0.01"
                  min={0.05}
                  max={2}
                  value={Number(effectiveLambda.toFixed(3))}
                  onChange={(e) => setManualLambda(Math.max(0.05, Math.min(2, Number(e.target.value) || 0.05)))}
                  className="mt-1.5 h-9 w-full rounded-lg border border-white/[0.08] bg-[#161922] px-3 font-mono text-[13px] text-[#F4F2EC] outline-none transition-colors focus:border-white/30"
                />
              </label>
            </div>

            <div className="mt-6">
              <div className="flex items-baseline justify-between font-mono text-[11px] uppercase tracking-[0.1em]">
                <span className="text-secondary">DELIVERY DELAY (0H → 72H)</span>
                <span className="text-[#F4F2EC]">{delayHours} HOURS LATE</span>
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

          <div className="mt-6 grid grid-cols-3 gap-4 border-t border-white/[0.08] pt-5 font-mono">
            <div>
              <p className="text-[10px] uppercase text-secondary">PAYEE PAYOUT</p>
              <p className="mt-1 text-[17px] font-semibold text-emerald">{fmtAmount(result.payeePayoutUsdc)} USDC</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-secondary">BUYER REBATE</p>
              <p className="mt-1 text-[17px] font-semibold text-crimson">{fmtAmount(result.buyerRebateUsdc)} USDC</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-secondary">FEE (0.5%)</p>
              <p className="mt-1 text-[17px] font-semibold text-[#F4F2EC]">{fmtAmount(result.protocolFeeUsdc)} USDC</p>
            </div>
          </div>
        </div>

        {/* Right Card (5 cols): Live Gemini Prediction Markets Probability Rows */}
        <div className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#111318] p-7 lg:col-span-5">
          <div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#F4F2EC]">
                  GEMINI PREDICTION MARKETS
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-secondary">GET /api/risk/gemini</p>
              </div>
              <button
                type="button"
                onClick={() => void refreshGemini()}
                disabled={geminiLoading}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/15 px-3 font-mono text-[10.5px] uppercase tracking-[0.1em] text-secondary transition-colors hover:border-white/30 hover:text-[#F4F2EC]"
              >
                <RefreshCw className={`size-3 ${geminiLoading ? 'animate-spin' : ''}`} />
                SYNC
              </button>
            </div>

            {gemini ? (
              <>
                <div className="mt-5 grid grid-cols-2 gap-4 border-y border-white/[0.08] py-4 font-mono">
                  <div>
                    <p className="text-[10px] uppercase text-secondary">VOLATILITY INDEX</p>
                    <p className="mt-1 text-[22px] font-semibold text-[#F4F2EC]">{gemini.volatilityIndex.toFixed(3)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-secondary">CALIBRATED λ</p>
                    <p className="mt-1 text-[22px] font-semibold text-emerald">{gemini.recommendedLambda.toFixed(3)}</p>
                  </div>
                </div>

                <ul className="mt-3 divide-y divide-white/[0.06]">
                  {gemini.contracts.slice(0, 5).map((c) => (
                    <li key={c.instrumentSymbol} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-[#F4F2EC]">{c.title}</p>
                        <p className="font-mono text-[10px] text-secondary">{c.instrumentSymbol}</p>
                      </div>
                      <span className="shrink-0 font-mono text-[12px] font-semibold text-[#F4F2EC]">
                        YES {Math.round(c.yesProbability * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : geminiError ? (
              <p className="mt-6 font-mono text-[12px] text-crimson">
                Gemini Prediction Markets feed unavailable ({geminiError}).
              </p>
            ) : (
              <p className="mt-6 font-mono text-[12px] text-secondary">Syncing active Gemini contracts…</p>
            )}
          </div>

          {gemini && (
            <div className="mt-6 flex items-center justify-between border-t border-white/[0.08] pt-4 font-mono text-[10.5px]">
              <span className="text-secondary">UPDATED {new Date(gemini.fetchedAt).toLocaleTimeString()}</span>
              <button
                type="button"
                onClick={() => setManualLambda(null)}
                className="text-[#F4F2EC] underline-offset-4 hover:underline"
              >
                USE LIVE λ = {gemini.recommendedLambda.toFixed(3)}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
