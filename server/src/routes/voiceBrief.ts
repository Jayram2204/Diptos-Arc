import { Hono } from 'hono'
import { getEscrowById } from '../store.js'
import { fetchLiveGeminiRisk } from './riskGemini.js'

export const voiceBriefRoute = new Hono()

const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM' // Rachel (standard ElevenLabs voice)

voiceBriefRoute.post('/', async (c) => {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim()
  if (!apiKey) {
    return c.json(
      {
        error: 'ELEVENLABS_API_KEY is not configured on the server.',
        hint: 'Set ELEVENLABS_API_KEY in .env to stream live ElevenLabs executive audio briefs.',
      },
      503,
    )
  }

  const body = await c.req.json().catch(() => ({}))
  const escrowId = typeof body?.escrowId === 'string' ? body.escrowId.trim() : ''
  const escrow = escrowId ? getEscrowById(escrowId) : undefined

  let macroClause = 'Live Gemini prediction market telemetry is syncing.'
  try {
    const gemini = await fetchLiveGeminiRisk()
    const top = gemini.contracts[0]
    macroClause = top
      ? `Live Gemini Prediction Markets show a volatility index of ${gemini.volatilityIndex.toFixed(2)}, led by ${top.title} at ${Math.round(top.yesProbability * 100)} percent yes, calibrating the TECD decay parameter lambda to ${gemini.recommendedLambda.toFixed(2)}.`
      : `Live Gemini Prediction Markets report a volatility index of ${gemini.volatilityIndex.toFixed(2)}, calibrating TECD lambda to ${gemini.recommendedLambda.toFixed(2)}.`
  } catch {
    // Keep brief factual without fabricating numbers
  }

  const script = escrow
    ? `Diptos executive brief on Arc Testnet. Escrow ${escrow.title}, mode ${escrow.mode === 'agent' ? 'autonomous AI agent' : 'human freelancer'}, locks ${escrow.amountUsdc} native USDC with a ${escrow.deadlineHours} hour SLA window and a flat zero point five percent settlement fee. On-time delivery verified by Grok settles ninety-nine point five percent atomically with zero chargeback risk. Late delivery triggers Time-Entropic Collateral Decay at lambda ${escrow.tecdLambda.toFixed(2)}, rebating the buyer automatically. ${macroClause}`
    : `Diptos treasury risk brief on Arc Testnet. Native USDC escrow links settle atomically with Grok deliverable verification and Time-Entropic Collateral Decay SLA protection. ${macroClause}`

  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim() || DEFAULT_VOICE_ID
  const modelId = process.env.ELEVENLABS_MODEL_ID?.trim() || 'eleven_turbo_v2_5'

  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: script,
        model_id: modelId,
        voice_settings: {
          stability: 0.55,
          similarity_boost: 0.75,
        },
      }),
      signal: AbortSignal.timeout(25_000),
    })

    if (!res.ok) {
      const errText = await res.text()
      return c.json(
        { error: `ElevenLabs API returned HTTP ${res.status}`, detail: errText.slice(0, 300) },
        502,
      )
    }

    const audioBuffer = await res.arrayBuffer()
    return new Response(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
        'X-Diptos-Script-Length': String(script.length),
      },
    })
  } catch (err) {
    return c.json(
      { error: 'ElevenLabs audio synthesis failed', detail: (err as Error).message },
      502,
    )
  }
})
