import { Hono } from 'hono'
import crypto from 'node:crypto'
import { encodeFunctionData, isAddress, keccak256, parseAbi, parseEther, stringToHex } from 'viem'
import {
  ARC_CHAIN_ID,
  arcPublicClient,
  getEscrowContractAddress,
  getRegistryContractAddress,
} from '../lib/oracleSigner.js'
import { fetchLiveGeminiRisk } from './riskGemini.js'

export const agentGuardrailRoute = new Hono()

const REGISTRY_STATS_ABI = parseAbi([
  'function getCounterpartyStats(address payee) view returns ((uint256 completedOnTime, uint256 completedLate, uint256 totalVolumeSettled, uint256 totalLatencySeconds, uint256 averageLatencySeconds))',
])

const ESCROW_CREATE_ABI = parseAbi([
  'function createEscrowLink(bytes32 escrowId, address payee, uint256 deadline, uint256 lambdaBps, bool isAgentMode) payable',
])

agentGuardrailRoute.post('/quote-and-verify', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return c.json({ error: 'Invalid JSON payload' }, 400)
  }

  const payee = typeof body.payee === 'string' ? body.payee.trim() : ''
  const amountUsdc = Number(body.amountUsdc)
  const deadlineHours = Number(body.deadlineHours ?? 24)
  const scope = typeof body.scope === 'string' ? body.scope.trim() : ''

  if (!isAddress(payee)) return c.json({ error: 'Valid payee address is required' }, 400)
  if (!Number.isFinite(amountUsdc) || amountUsdc <= 0) {
    return c.json({ error: 'amountUsdc must be positive' }, 400)
  }
  if (!scope || scope.length < 4) return c.json({ error: 'Task scope is required' }, 400)

  const snap = await fetchLiveGeminiRisk()
  const macroLambda = snap.recommendedLambda
  const volatilityIndex = snap.volatilityIndex

  let completedOnTime = 0
  let completedLate = 0
  let totalVolumeSettledWei = '0'
  let averageLatencySeconds = 0
  const registryAddr = getRegistryContractAddress()

  if (registryAddr) {
    try {
      const stats = (await arcPublicClient.readContract({
        address: registryAddr,
        abi: REGISTRY_STATS_ABI,
        functionName: 'getCounterpartyStats',
        args: [payee],
      })) as {
        completedOnTime: bigint
        completedLate: bigint
        totalVolumeSettled: bigint
        totalLatencySeconds: bigint
        averageLatencySeconds: bigint
      }
      completedOnTime = Number(stats.completedOnTime)
      completedLate = Number(stats.completedLate)
      totalVolumeSettledWei = stats.totalVolumeSettled.toString()
      averageLatencySeconds = Number(stats.averageLatencySeconds)
    } catch {
      // Fresh counterparty with zero prior settlements
    }
  }

  const totalCompleted = completedOnTime + completedLate
  const onTimeRatio = totalCompleted > 0 ? completedOnTime / totalCompleted : 0.75
  const counterpartyTrustScore = Math.round(
    Math.min(100, Math.max(10, onTimeRatio * 80 + Math.min(20, totalCompleted * 4))),
  )

  const trustAdjustment = (100 - counterpartyTrustScore) / 250
  const calibratedLambda = Number(Math.min(1.5, Math.max(0.15, macroLambda + trustAdjustment)).toFixed(4))
  const recommendedLambdaBps = Math.round(calibratedLambda * 10_000)

  const slug =
    typeof body.escrowId === 'string' && body.escrowId.trim()
      ? body.escrowId.trim()
      : `esc_agent_${crypto.randomBytes(4).toString('hex')}`
  const escrowIdBytes32 = keccak256(stringToHex(`diptos:arc:5042002:${slug}`))
  const deadlineUnix = BigInt(Math.floor(Date.now() / 1000) + Math.round(deadlineHours * 3600))
  const valueWei = parseEther(String(amountUsdc))

  const calldata = encodeFunctionData({
    abi: ESCROW_CREATE_ABI,
    functionName: 'createEscrowLink',
    args: [escrowIdBytes32, payee, deadlineUnix, BigInt(recommendedLambdaBps), true],
  })

  return c.json({
    chainId: ARC_CHAIN_ID,
    to: getEscrowContractAddress(),
    valueWei: valueWei.toString(),
    calldata,
    escrowId: slug,
    escrowIdBytes32,
    deadlineUnix: Number(deadlineUnix),
    recommendedLambda: calibratedLambda,
    recommendedLambdaBps,
    riskSource: 'gemini-live',
    volatilityIndex,
    counterpartyTrustScore,
    counterpartyStats: {
      payee,
      completedOnTime,
      completedLate,
      totalVolumeSettledWei,
      averageLatencySeconds,
    },
  })
})
