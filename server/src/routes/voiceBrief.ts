import { Hono } from 'hono'
import { formatEther, type Hex, keccak256, parseAbi, stringToHex, zeroAddress } from 'viem'
import { arcPublicClient, getEscrowContractAddress } from '../lib/oracleSigner.js'
import { fetchLiveGeminiRisk } from './riskGemini.js'

export const voiceBriefRoute = new Hono()

const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'
const ESCROW_VIEW_ABI = parseAbi([
  'function getEscrowView(bytes32 escrowId) view returns ((bytes32 escrowId, address payer, address payee, uint256 amount, uint256 deadline, uint256 createdAt, uint256 fundedAt, uint256 lambdaBps, uint256 nonce, bool isAgentMode, uint8 status, bytes32 deliverableHash))',
])

function toEscrowBytes32(rawId: string): Hex {
  const trimmed = rawId.trim()
  if (/^0x[0-9a-fA-F]{64}$/.test(trimmed)) return trimmed as Hex
  return keccak256(stringToHex(`diptos:arc:5042002:${trimmed}`))
}

voiceBriefRoute.post('/', async (c) => {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim()
  if (!apiKey) {
    return c.json(
      {
        error: 'ELEVENLABS_API_KEY is not configured on the server.',
        hint: 'Set ELEVENLABS_API_KEY in Vercel Environment Variables to stream live ElevenLabs audio briefs.',
      },
      503,
    )
  }

  const body = await c.req.json().catch(() => ({}))
  const escrowIdRaw = typeof body?.escrowId === 'string' ? body.escrowId.trim() : ''

  let dealClause =
    'Diptos treasury risk brief on Arc Testnet. Native USDC escrow links settle atomically with Grok EIP-712 deliverable verification and Time-Entropic Collateral Decay SLA protection.'

  if (escrowIdRaw) {
    const escrowContract = getEscrowContractAddress()
    let amountUsdc = Number(body?.amountUsdc ?? 0)
    let lambda = Number(body?.tecdLambda ?? 0.35)
    let modeLabel = body?.mode === 'agent' ? 'autonomous AI agent' : 'human freelancer'
    const title = typeof body?.title === 'string' && body.title.trim() ? body.title.trim() : escrowIdRaw.slice(0, 14)

    if (escrowContract) {
      try {
        const view = (await arcPublicClient.readContract({
          address: escrowContract,
          abi: ESCROW_VIEW_ABI,
          functionName: 'getEscrowView',
          args: [toEscrowBytes32(escrowIdRaw)],
        })) as {
          payer: string
          amount: bigint
          lambdaBps: bigint
          isAgentMode: boolean
        }
        if (view && view.payer !== zeroAddress) {
          amountUsdc = Number(formatEther(view.amount))
          lambda = Number(view.lambdaBps) / 10_000
          modeLabel = view.isAgentMode ? 'autonomous AI agent' : 'human freelancer'
        }
      } catch {
        // Use caller-provided intent fields when pre-funding
      }
    }

    dealClause = `Diptos executive brief on Arc Testnet. Escrow ${title}, mode ${modeLabel}, locks ${amountUsdc} native USDC with a flat zero point five percent settlement fee. On-time delivery verified by Grok settles ninety-nine point five percent atomically with zero chargebacks. Late delivery triggers Time-Entropic Collateral Decay at lambda ${lambda.toFixed(2)}, rebating the buyer automatically.`
  }

  let macroClause = ''
  try {
    const gemini = await fetchLiveGeminiRisk()
    const top = gemini.contracts[0]
    macroClause = top
      ? ` Live Gemini Prediction Markets report a volatility index of ${gemini.volatilityIndex.toFixed(2)}, led by ${top.title} at ${Math.round(top.yesProbability * 100)} percent yes, calibrating TECD lambda to ${gemini.recommendedLambda.toFixed(2)}.`
      : ` Live Gemini Prediction Markets calibrate TECD lambda to ${gemini.recommendedLambda.toFixed(2)}.`
  } catch {
    // Keep brief factual
  }

  const script = `${dealClause}${macroClause}`
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
        voice_settings: { stability: 0.55, similarity_boost: 0.75 },
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
      },
    })
  } catch (err) {
    return c.json(
      { error: 'ElevenLabs audio synthesis failed', detail: (err as Error).message },
      502,
    )
  }
})
