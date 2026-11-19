import 'dotenv/config'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { getOracleStatus } from './lib/oracleSigner.js'
import { agentGuardrailRoute } from './routes/agentGuardrail.js'
import { escrowsRoute } from './routes/escrows.js'
import { eventsStreamRoute, quicknodeWebhookRoute } from './routes/quicknode.js'
import { riskGeminiRoute } from './routes/riskGemini.js'
import { verifyGrokRoute } from './routes/verifyGrok.js'
import { voiceBriefRoute } from './routes/voiceBrief.js'

export const app = new Hono()

app.use('/api/*', cors())

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
      grokVerifier: Boolean(process.env.XAI_API_KEY?.trim()),
      elevenLabsVoice: Boolean(process.env.ELEVENLABS_API_KEY?.trim()),
      quickNodeHmacEnabled: Boolean(process.env.QUICKNODE_WEBHOOK_SECRET?.trim()),
      arcRpcIndexer: true,
      oracleSigner: oracle.oracleSigner,
      totalAttestationsSigned: oracle.totalAttestationsSigned,
    },
  })
})

app.get('/api/oracle/status', async (c) => {
  return c.json(await getOracleStatus())
})

app.route('/api/escrows', escrowsRoute)
app.route('/api/risk', riskGeminiRoute)
app.route('/api/verify/grok', verifyGrokRoute)
app.route('/api/voice/brief', voiceBriefRoute)
app.route('/api/webhooks/quicknode', quicknodeWebhookRoute)
app.route('/api/events/stream', eventsStreamRoute)
app.route('/api/agent', agentGuardrailRoute)
