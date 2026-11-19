import { Hono } from 'hono'
import crypto from 'node:crypto'
import {
  encodeFunctionData,
  formatEther,
  type Hex,
  isAddress,
  keccak256,
  parseAbi,
  parseEther,
  stringToHex,
  zeroAddress,
} from 'viem'
import {
  ARC_CHAIN_ID,
  arcPublicClient,
  getEscrowContractAddress,
  getRegistryContractAddress,
} from '../lib/oracleSigner.js'

export const escrowsRoute = new Hono()

const ESCROW_READ_ABI = parseAbi([
  'function getEscrowCount() view returns (uint256)',
  'function getEscrowsPaginated(uint256 offset, uint256 limit) view returns ((bytes32 escrowId, address payer, address payee, uint256 amount, uint256 deadline, uint256 createdAt, uint256 fundedAt, uint256 lambdaBps, uint256 nonce, bool isAgentMode, uint8 status, bytes32 deliverableHash)[])',
  'function getEscrowView(bytes32 escrowId) view returns ((bytes32 escrowId, address payer, address payee, uint256 amount, uint256 deadline, uint256 createdAt, uint256 fundedAt, uint256 lambdaBps, uint256 nonce, bool isAgentMode, uint8 status, bytes32 deliverableHash))',
  'function createEscrowLink(bytes32 escrowId, address payee, uint256 deadline, uint256 lambdaBps, bool isAgentMode) payable',
])

const REGISTRY_STATS_ABI = parseAbi([
  'function getCounterpartyStats(address payee) view returns ((uint256 completedOnTime, uint256 completedLate, uint256 totalVolumeSettled, uint256 totalLatencySeconds, uint256 averageLatencySeconds))',
])

type OnChainEscrowView = {
  escrowId: Hex
  payer: string
  payee: string
  amount: bigint
  deadline: bigint
  createdAt: bigint
  fundedAt: bigint
  lambdaBps: bigint
  nonce: bigint
  isAgentMode: boolean
  status: number
  deliverableHash: Hex
}

const STATUS_MAP = ['created', 'funded', 'verified', 'settled', 'refunded'] as const

function toEscrowIdBytes32(rawId: string): Hex {
  const trimmed = rawId.trim()
  if (/^0x[0-9a-fA-F]{64}$/.test(trimmed)) return trimmed as Hex
  return keccak256(stringToHex(`diptos:arc:5042002:${trimmed}`))
}

function mapOnChainView(v: OnChainEscrowView) {
  const deadlineUnix = Number(v.deadline)
  const createdUnix = Number(v.createdAt || v.fundedAt)
  const deadlineHours =
    deadlineUnix > createdUnix ? Math.max(1, Math.round((deadlineUnix - createdUnix) / 3600)) : 24
  const amountUsdc = Number(formatEther(v.amount))
  const lambdaBps = Number(v.lambdaBps)

  return {
    id: v.escrowId,
    escrowIdBytes32: v.escrowId,
    title: v.isAgentMode
      ? `AI Agent Escrow ${v.escrowId.slice(0, 10)}`
      : `Arc USDC Escrow ${v.escrowId.slice(0, 10)}`,
    scope: `On-chain non-custodial escrow settled via Grok EIP-712 Oracle on Arc Testnet (5042002).`,
    amountUsdc,
    amountWei: v.amount.toString(),
    deadline: deadlineUnix > 0 ? new Date(deadlineUnix * 1000).toISOString() : new Date().toISOString(),
    deadlineUnix,
    deadlineHours,
    createdAt: createdUnix > 0 ? new Date(createdUnix * 1000).toISOString() : new Date().toISOString(),
    fundedAt: Number(v.fundedAt),
    mode: v.isAgentMode ? ('agent' as const) : ('human' as const),
    payer: v.payer,
    payee: v.payee,
    nonce: Number(v.nonce),
    tecdLambda: Number((lambdaBps / 10_000).toFixed(4)),
    tecdLambdaBps: lambdaBps,
    status: STATUS_MAP[v.status] ?? 'created',
    deliverableHash: v.deliverableHash,
    onChain: true,
  }
}

escrowsRoute.get('/', async (c) => {
  const escrowContract = getEscrowContractAddress()
  if (!escrowContract) {
    return c.json({ escrows: [], total: 0, chainId: ARC_CHAIN_ID })
  }

  const offset = Math.max(0, Number(c.req.query('offset') ?? 0))
  const limit = Math.min(50, Math.max(1, Number(c.req.query('limit') ?? 25)))

  try {
    const [total, items] = await Promise.all([
      arcPublicClient.readContract({
        address: escrowContract,
        abi: ESCROW_READ_ABI,
        functionName: 'getEscrowCount',
      }),
      arcPublicClient.readContract({
        address: escrowContract,
        abi: ESCROW_READ_ABI,
        functionName: 'getEscrowsPaginated',
        args: [BigInt(offset), BigInt(limit)],
      }),
    ])

    const escrows = (items as readonly OnChainEscrowView[])
      .filter((v) => v.payer !== zeroAddress)
      .map(mapOnChainView)

    return c.json({
      escrows,
      total: Number(total),
      offset,
      limit,
      chainId: ARC_CHAIN_ID,
      contract: escrowContract,
    })
  } catch (err) {
    return c.json(
      {
        escrows: [],
        total: 0,
        chainId: ARC_CHAIN_ID,
        contract: escrowContract,
        rpcNote: (err as Error).message.split('\n')[0],
      },
      200,
    )
  }
})

escrowsRoute.get('/:id', async (c) => {
  const rawId = c.req.param('id')
  const escrowIdBytes32 = toEscrowIdBytes32(rawId)
  const escrowContract = getEscrowContractAddress()

  if (!escrowContract) {
    return c.json({ error: 'Escrow contract address not set', escrowIdBytes32 }, 503)
  }

  try {
    const view = (await arcPublicClient.readContract({
      address: escrowContract,
      abi: ESCROW_READ_ABI,
      functionName: 'getEscrowView',
      args: [escrowIdBytes32],
    })) as OnChainEscrowView

    if (!view || view.payer === zeroAddress) {
      return c.json({ error: 'Escrow not yet funded on Arc Testnet', escrowIdBytes32 }, 404)
    }

    const mapped = mapOnChainView(view)

    let counterpartyStats = null
    const registryAddr = getRegistryContractAddress()
    if (registryAddr && isAddress(view.payee)) {
      try {
        const stats = (await arcPublicClient.readContract({
          address: registryAddr,
          abi: REGISTRY_STATS_ABI,
          functionName: 'getCounterpartyStats',
          args: [view.payee],
        })) as {
          completedOnTime: bigint
          completedLate: bigint
          totalVolumeSettled: bigint
          totalLatencySeconds: bigint
          averageLatencySeconds: bigint
        }
        counterpartyStats = {
          completedOnTime: Number(stats.completedOnTime),
          completedLate: Number(stats.completedLate),
          totalVolumeSettledUsdc: Number(formatEther(stats.totalVolumeSettled)),
          averageLatencySeconds: Number(stats.averageLatencySeconds),
        }
      } catch {
        // Fresh counterparty
      }
    }

    return c.json({ escrow: mapped, counterpartyStats })
  } catch (err) {
    return c.json(
      { error: 'Failed to read escrow from Arc Testnet', detail: (err as Error).message.split('\n')[0] },
      502,
    )
  }
})

/**
 * Stateless intent builder: computes deterministic bytes32 escrowId and pre-encoded
 * createEscrowLink calldata without writing any local JSON files.
 */
escrowsRoute.post('/', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return c.json({ error: 'Invalid JSON payload' }, 400)
  }

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const scope = typeof body.scope === 'string' ? body.scope.trim() : ''
  const amountUsdc = Number(body.amountUsdc)
  const deadlineHours = Math.max(0.03, Math.min(720, Number(body.deadlineHours ?? 24)))
  const mode = body.mode === 'agent' ? 'agent' : 'human'
  const payee =
    typeof body.payee === 'string' && isAddress(body.payee.trim())
      ? body.payee.trim()
      : '0x000000000000000000000000000000000000dEaD'
  const tecdLambda = Number.isFinite(Number(body.tecdLambda))
    ? Math.min(2.0, Math.max(0.05, Number(body.tecdLambda)))
    : 0.35

  if (!title || title.length < 2) return c.json({ error: 'Deliverable title is required' }, 400)
  if (!scope || scope.length < 4) return c.json({ error: 'Deliverable scope is required' }, 400)
  if (!Number.isFinite(amountUsdc) || amountUsdc <= 0) {
    return c.json({ error: 'amountUsdc must be positive' }, 400)
  }

  const slug = `esc_${crypto.randomBytes(5).toString('hex')}`
  const escrowIdBytes32 = toEscrowIdBytes32(slug)
  const now = Date.now()
  const deadlineMs = now + Math.round(deadlineHours * 3600 * 1000)
  const deadlineUnix = Math.floor(deadlineMs / 1000)
  const tecdLambdaBps = Math.round(tecdLambda * 10_000)

  const calldata = encodeFunctionData({
    abi: ESCROW_READ_ABI,
    functionName: 'createEscrowLink',
    args: [escrowIdBytes32, payee, BigInt(deadlineUnix), BigInt(tecdLambdaBps), mode === 'agent'],
  })

  const params = new URLSearchParams({
    title,
    scope,
    amount: String(amountUsdc),
    hours: String(deadlineHours),
    mode,
    payee,
    lambda: String(tecdLambda),
  })

  const checkoutPath = `/pay/${escrowIdBytes32}?${params.toString()}`

  return c.json(
    {
      escrow: {
        id: escrowIdBytes32,
        escrowIdBytes32,
        title,
        scope,
        amountUsdc,
        deadline: new Date(deadlineMs).toISOString(),
        deadlineUnix,
        deadlineHours,
        mode,
        payee,
        tecdLambda: Number(tecdLambda.toFixed(4)),
        tecdLambdaBps,
        status: 'created',
        createdAt: new Date(now).toISOString(),
        onChain: false,
      },
      txIntent: {
        chainId: ARC_CHAIN_ID,
        to: getEscrowContractAddress(),
        valueWei: parseEther(String(amountUsdc)).toString(),
        calldata,
      },
      checkoutPath,
      shareUrl: `https://diptos.xyz${checkoutPath}`,
    },
    201,
  )
})
