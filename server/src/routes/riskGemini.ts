import { Hono } from 'hono'
import { appendRiskHistory, listRiskHistory } from '../store.js'

export const riskGeminiRoute = new Hono()

const GEMINI_EVENTS_URL = 'https://api.gemini.com/v1/prediction-markets/events?status=active&limit=10'

export interface GeminiContractSnapshot {
  instrumentSymbol: string
  title: string
  yesProbability: number
  noProbability: number
  status: string
}

export interface GeminiRiskSnapshot {
  source: 'gemini-prediction-markets'
  fetchedAt: string
  volatilityIndex: number
  recommendedLambda: number
  recommendedLambdaBps: number
  contracts: GeminiContractSnapshot[]
}

function parseProbability(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw > 1 ? Math.min(1, raw / 100) : Math.max(0, Math.min(1, raw))
  }
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw)
    if (Number.isFinite(n)) {
      return n > 1 ? Math.min(1, n / 100) : Math.max(0, Math.min(1, n))
    }
  }
  return null
}

function extractContracts(payload: unknown): GeminiContractSnapshot[] {
  const list = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object'
      ? (payload as Record<string, unknown>).events ??
        (payload as Record<string, unknown>).data ??
        (payload as Record<string, unknown>).results ??
        []
      : []

  if (!Array.isArray(list)) return []

  const contracts: GeminiContractSnapshot[] = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const ev = item as Record<string, unknown>
    const eventTitle = String(ev.title ?? ev.name ?? ev.question ?? ev.slug ?? 'Active Market')
    const nested = Array.isArray(ev.contracts)
      ? ev.contracts
      : Array.isArray(ev.markets)
        ? ev.markets
        : [ev]

    for (const c of nested) {
      if (!c || typeof c !== 'object') continue
      const row = c as Record<string, unknown>
      const symbol = String(
        row.instrumentSymbol ?? row.symbol ?? row.ticker ?? ev.ticker ?? ev.slug ?? '',
      ).trim()
      if (!symbol) continue

      const prices = (row.prices ?? row.lastTradePrice ?? {}) as Record<string, unknown>
      const yesProb = parseProbability(
        row.yesProbability ?? row.yesPrice ?? row.lastPrice ?? row.probability ?? prices.yes ?? prices.buyYes,
      )
      const noProb = parseProbability(row.noProbability ?? row.noPrice ?? prices.no ?? prices.buyNo)
      const resolvedYes = yesProb ?? (noProb !== null ? 1 - noProb : 0.5)
      const resolvedNo = noProb ?? Number((1 - resolvedYes).toFixed(4))

      contracts.push({
        instrumentSymbol: symbol,
        title: String(row.title ?? row.label ?? eventTitle),
        yesProbability: Number(resolvedYes.toFixed(4)),
        noProbability: Number(resolvedNo.toFixed(4)),
        status: String(row.status ?? ev.status ?? 'active'),
      })

      if (contracts.length >= 10) break
    }
    if (contracts.length >= 10) break
  }

  return contracts
}

export async function fetchLiveGeminiRisk(): Promise<GeminiRiskSnapshot> {
  const res = await fetch(GEMINI_EVENTS_URL, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Diptos-Arc-Protocol/2.0',
    },
    signal: AbortSignal.timeout(8000),
  })

  if (!res.ok) {
    throw new Error(`Gemini API responded with HTTP ${res.status}`)
  }

  const json = await res.json()
  const contracts = extractContracts(json)

  // Weighted binary-entropy uncertainty index across active contracts (higher weight on top-ranked events)
  let weightedSum = 0
  let weightTotal = 0
  contracts.forEach((c, idx) => {
    const w = 1 / (1 + idx * 0.15)
    const uncertainty = 4 * c.yesProbability * (1 - c.yesProbability)
    weightedSum += w * uncertainty
    weightTotal += w
  })

  const volatilityIndex = weightTotal > 0 ? Number((weightedSum / weightTotal).toFixed(4)) : 0.5
  const recommendedLambda = Number((0.18 + volatilityIndex * 0.5).toFixed(4))
  const recommendedLambdaBps = Math.round(recommendedLambda * 10_000)
  const fetchedAt = new Date().toISOString()

  appendRiskHistory({
    fetchedAt,
    volatilityIndex,
    recommendedLambda,
    recommendedLambdaBps,
    contractCount: contracts.length,
  })

  return {
    source: 'gemini-prediction-markets',
    fetchedAt,
    volatilityIndex,
    recommendedLambda,
    recommendedLambdaBps,
    contracts,
  }
}

riskGeminiRoute.get('/gemini', async (c) => {
  try {
    const snapshot = await fetchLiveGeminiRisk()
    return c.json(snapshot)
  } catch (err) {
    return c.json(
      {
        error: 'Failed to fetch live Gemini Prediction Markets feed',
        detail: (err as Error).message,
      },
      502,
    )
  }
})

riskGeminiRoute.get('/history', (c) => {
  const limit = Math.min(100, Math.max(1, Number(c.req.query('limit') ?? 30)))
  return c.json({ history: listRiskHistory(limit) })
})
