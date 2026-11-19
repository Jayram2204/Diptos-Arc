import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, TrendingUp } from 'lucide-react'
import { Button, Eyebrow } from '@/components/ui'
import { computeTECD, fmtAmount } from '@/lib/chain'
import { useGeminiRisk } from '@/lib/hooks'

export function Waterfall() {
  const { data: gemini, loading: geminiLoading, error: geminiError, refresh: refreshGemini } = useGeminiRisk()

  const [amountUsdc, setAmountUsdc] = useState(5000)
  const [slaWindowHours, setSlaWindowHours] = useState(24)
  const [delayHours, setDelayHours] = useState(12)
  const [lambda, setLambda] = useState(0.35)
  const [syncedFromGemini, setSyncedFromGemini] = useState(false)

  useEffect(() => {
    if (gemini && !syncedFromGemini) {
      setLambda(gemini.recommendedLambda)
      setSyncedFromGemini(true)
    }
  }, [gemini, syncedFromGemini])

  const result = useMemo(
    () =>
      computeTECD({
        amountUsdc,
        delayHours,
        slaWindowHours,
        lambda,
        gamma: 1.5,
      }),
    [amountUsdc, delayHours, slaWindowHours, lambda],
  )

  const payeePct = amountUsdc > 0 ? Math.max(0, Math.min(100, (result.sellerPayout / amountUsdc) * 100)) : 0
  const rebatePct = amountUsdc > 0 ? Math.max(0, Math.min(100, (result.buyerRebate / amountUsdc) * 100)) : 0
  const feePct = Math.max(0, 100 - payeePct - rebatePct)

  return (
    <section id="tecd-risk" className="mx-auto max-w-[1280px] border-t border-white/[0.08] px-4 py-20 sm:px-6">
      <div className="max-w-2xl">
        <Eyebrow>TECD &amp; Macro Risk Calibration</Eyebrow>
        <h2 className="mt-3 text-[28px] font-semibold text-primary sm:text-[34px]">
          Time-Entropic Collateral Decay &amp; Gemini Prediction Markets.
        </h2>
        <p className="mt-3 text-[14px] text-secondary">
          Late deliveries automatically rebate the buyer along{' '}
          <span className="font-mono text-primary">V(t) = V₀ · e^(−λ(t/T)^γ)</span>. Macro uncertainty from live
          Gemini Prediction Markets dynamically tunes the decay intensity <span className="font-mono text-gold">λ</span>.
        </p>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-12">
        {/* Left: Interactive TECD Delay Simulator (7 cols) */}
        <div className="rounded-[10px] border border-white/[0.08] bg-surface p-6 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-4">
            <div>
              <h3 className="text-[17px] font-semibold text-primary">Interactive TECD Delay Simulator</h3>
              <p className="mt-0.5 font-mono text-[11px] text-secondary">
                V(t) = V₀ · exp(−{lambda.toFixed(2)} · ({delayHours}/{slaWindowHours})^1.5)
              </p>
            </div>
            <span
              className={`rounded-md border px-2.5 py-1 font-mono text-[11px] font-medium ${
                delayHours === 0
                  ? 'border-emerald/30 bg-emerald/10 text-emerald'
                  : 'border-crimson/35 bg-crimson/10 text-crimson'
              }`}
            >
              {delayHours === 0 ? 'ON-TIME • 0% DECAY' : `LATE +${delayHours}H • -${result.decayPercent.toFixed(1)}%`}
            </span>
          </div>

          {/* Controls */}
          <div className="mt-5 grid grid-cols-3 gap-3">
            <label className="block">
              <span className="text-[11px] text-secondary">Escrow (USDC)</span>
              <input
                type="number"
                min={10}
                value={amountUsdc}
                onChange={(e) => setAmountUsdc(Math.max(1, Number(e.target.value) || 0))}
                className="mt-1 h-9 w-full rounded-lg border border-white/[0.08] bg-elevated px-2.5 font-mono text-[13px] text-primary outline-none focus:border-gold/60"
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-secondary">SLA Window (T)</span>
              <input
                type="number"
                min={1}
                max={720}
                value={slaWindowHours}
                onChange={(e) => setSlaWindowHours(Math.max(1, Number(e.target.value) || 1))}
                className="mt-1 h-9 w-full rounded-lg border border-white/[0.08] bg-elevated px-2.5 font-mono text-[13px] text-primary outline-none focus:border-gold/60"
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-secondary">Risk λ (Gemini)</span>
              <input
                type="number"
                step="0.01"
                min={0.05}
                max={2}
                value={lambda}
                onChange={(e) => setLambda(Math.max(0.05, Math.min(2, Number(e.target.value) || 0.05)))}
                className="mt-1 h-9 w-full rounded-lg border border-white/[0.08] bg-elevated px-2.5 font-mono text-[13px] text-gold outline-none focus:border-gold/60"
              />
            </label>
          </div>

          {/* Delivery Delay Slider (0h to 72h) */}
          <div className="mt-6">
            <div className="flex items-baseline justify-between text-[12px]">
              <span className="font-medium text-primary">Delivery Delay Beyond Deadline</span>
              <span className="font-mono text-[14px] font-semibold text-gold">{delayHours}h</span>
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
              <span>0h (On-Time)</span>
              <span>24h</span>
              <span>48h</span>
              <span>72h (Severe Delay)</span>
            </div>
          </div>

          {/* Animated Split Bar */}
          <div className="mt-6">
            <div className="flex h-3.5 w-full overflow-hidden rounded-md bg-elevated">
              <div
                className="bg-emerald transition-[width] duration-300"
                style={{ width: `${payeePct}%` }}
                title={`Payee Instant Payout: ${fmtAmount(result.sellerPayout)} USDC`}
              />
              <div
                className="bg-gold transition-[width] duration-300"
                style={{ width: `${feePct}%` }}
                title={`Protocol Fee (0.5%): ${fmtAmount(result.protocolFee)} USDC`}
              />
              <div
                className="bg-crimson transition-[width] duration-300"
                style={{ width: `${rebatePct}%` }}
                title={`Automatic Buyer Rebate: ${fmtAmount(result.buyerRebate)} USDC`}
              />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 border-t border-white/[0.08] pt-4 sm:grid-cols-3">
              <div>
                <p className="flex items-center gap-1.5 text-[11px] text-secondary">
                  <span className="size-2 rounded-sm bg-emerald" /> Payee Instant Payout
                </p>
                <p className="mt-1 font-mono text-[17px] font-semibold text-emerald">
                  {fmtAmount(result.sellerPayout)} <span className="text-[11px] text-secondary">USDC</span>
                </p>
              </div>
              <div>
                <p className="flex items-center gap-1.5 text-[11px] text-secondary">
                  <span className="size-2 rounded-sm bg-crimson" /> Automatic Buyer Rebate
                </p>
                <p className="mt-1 font-mono text-[17px] font-semibold text-crimson">
                  {fmtAmount(result.buyerRebate)} <span className="text-[11px] text-secondary">USDC</span>
                </p>
              </div>
              <div>
                <p className="flex items-center gap-1.5 text-[11px] text-secondary">
                  <span className="size-2 rounded-sm bg-gold" /> Protocol Fee (0.5%)
                </p>
                <p className="mt-1 font-mono text-[17px] font-semibold text-primary">
                  {fmtAmount(result.protocolFee)} <span className="text-[11px] text-secondary">USDC</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Live Gemini Prediction Markets Risk Oracle (5 cols) */}
        <div className="flex flex-col justify-between rounded-[10px] border border-white/[0.08] bg-surface p-6 lg:col-span-5">
          <div>
            <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="size-4 text-gold" />
                  <h3 className="text-[17px] font-semibold text-primary">Gemini Risk Oracle</h3>
                </div>
                <p className="mt-0.5 font-mono text-[11px] text-secondary">GET /api/risk/gemini • Live Feed</p>
              </div>
              <Button size="sm" variant="ghost" loading={geminiLoading} onClick={() => void refreshGemini()}>
                {!geminiLoading && <RefreshCw className="size-3.5" />}
                Sync
              </Button>
            </div>

            {gemini ? (
              <>
                <div className="mt-4 grid grid-cols-2 gap-3 border-b border-white/[0.08] pb-4 font-mono">
                  <div>
                    <p className="text-[10px] uppercase text-secondary">Macro Volatility Index</p>
                    <p className="mt-1 text-[20px] font-semibold text-primary">{gemini.volatilityIndex.toFixed(3)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-secondary">Calibrated TECD λ</p>
                    <p className="mt-1 text-[20px] font-semibold text-gold">{gemini.recommendedLambda.toFixed(3)}</p>
                  </div>
                </div>

                <ul className="mt-4 divide-y divide-white/[0.06]">
                  {gemini.contracts.slice(0, 4).map((c) => (
                    <li key={c.instrumentSymbol} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-medium text-primary">{c.title}</p>
                        <p className="font-mono text-[10px] text-secondary">{c.instrumentSymbol}</p>
                      </div>
                      <span className="shrink-0 rounded border border-white/[0.08] bg-elevated px-2 py-0.5 font-mono text-[11px] font-medium text-emerald">
                        YES {Math.round(c.yesProbability * 100)}%
                      </span>
                    </li>
                  ))}
                  {gemini.contracts.length === 0 && (
                    <li className="py-3 font-mono text-[12px] text-secondary">
                      No active prediction market contracts returned in current window.
                    </li>
                  )}
                </ul>
              </>
            ) : geminiError ? (
              <div className="mt-5 rounded-lg border border-crimson/30 bg-crimson/10 p-4 text-[12px] text-crimson">
                Live Gemini Prediction Markets feed unavailable ({geminiError}). Manual λ calibration remains active.
              </div>
            ) : (
              <div className="mt-5 space-y-2.5">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-10 animate-pulse rounded-lg bg-elevated" />
                ))}
              </div>
            )}
          </div>

          {gemini && (
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/[0.08] pt-4">
              <span className="font-mono text-[10px] text-secondary">
                Updated {new Date(gemini.fetchedAt).toLocaleTimeString()}
              </span>
              <Button size="sm" variant="secondary" onClick={() => setLambda(gemini.recommendedLambda)}>
                Apply λ = {gemini.recommendedLambda.toFixed(2)}
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
