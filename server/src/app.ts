import 'dotenv/config'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { getOracleStatus } from './lib/oracleSigner.js'
import { agentGuardrailRoute } from './routes/agentGuardrail.js'
import { authRoute } from './routes/auth.js'
import { escrowsRoute } from './routes/escrows.js'
import { onrampRoute } from './routes/onramp.js'
import { eventsRoute, quicknodeWebhookRoute } from './routes/quicknode.js'
import { riskGeminiRoute } from './routes/riskGemini.js'
import { verifyDeliverableRoute } from './routes/verifyDeliverable.js'
import { verifyGrokRoute } from './routes/verifyGrok.js'
import { voiceBriefRoute } from './routes/voiceBrief.js'
import { walletRelayRoute } from './routes/walletRelay.js'

export const app = new Hono()

app.use(
  '/api/*',
  cors({
    origin: (origin) => origin || '*',
    credentials: true,
  }),
)

// Sliding-window per-IP rate limiter to protect AI & TTS credits
const rateBuckets = new Map<string, number[]>()

function rateLimit(maxRequests: number, windowMs: number) {
  return async (c: Parameters<Parameters<typeof app.use>[1]>[0], next: () => Promise<void>) => {
    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
      c.req.header('x-real-ip') ||
      'anon'
    const key = `${c.req.path}:${ip}`
    const now = Date.now()
    const hits = (rateBuckets.get(key) ?? []).filter((t) => now - t < windowMs)
    if (hits.length >= maxRequests) {
      return c.json(
        {
          error: `Rate limit exceeded (${maxRequests} req / ${Math.round(windowMs / 1000)}s). Please wait a moment.`,
        },
        429,
      )
    }
    hits.push(now)
    rateBuckets.set(key, hits)
    await next()
  }
}

app.use('/api/verify/grok', rateLimit(10, 60_000))
app.use('/api/verify/deliverable', rateLimit(15, 60_000))
app.use('/api/onramp/sessions', rateLimit(20, 60_000))
app.use('/api/voice/brief', rateLimit(5, 60_000))
app.use('/api/wallet/relay', rateLimit(10, 60_000))

app.get('/api/health', async (c) => {
  const oracle = await getOracleStatus()
  return c.json({
    ok: true,
    chainId: 5042002,
    network: 'Arc Testnet',
    rpcUrl: oracle.rpcUrl,
    latestArcBlock: oracle.latestArcBlock,
    services: {
      geminiPredictionMarkets: true,
      grokVerifier: true,
      elevenLabsVoice: Boolean(process.env.ELEVENLABS_API_KEY?.trim()),
      quickNodeHmacEnabled: Boolean(process.env.QUICKNODE_WEBHOOK_SECRET?.trim()),
      statelessArcIndexer: true,
      oracleSigner: oracle.oracleSigner,
      totalAttestationsSigned: oracle.totalAttestationsSigned,
    },
  })
})

app.get('/api/oracle/status', async (c) => {
  return c.json(await getOracleStatus())
})

app.route('/api/auth', authRoute)
app.route('/api/escrows', escrowsRoute)
app.route('/api/onramp', onrampRoute)
app.route('/api/risk', riskGeminiRoute)
app.route('/api/verify/grok', verifyGrokRoute)
app.route('/api/verify/deliverable', verifyDeliverableRoute)
app.route('/api/voice/brief', voiceBriefRoute)
app.route('/api/webhooks/quicknode', quicknodeWebhookRoute)
app.route('/api/events', eventsRoute)
app.route('/api/agent', agentGuardrailRoute)
app.route('/api/wallet', walletRelayRoute)
