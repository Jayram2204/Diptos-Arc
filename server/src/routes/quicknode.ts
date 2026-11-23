import { Hono } from 'hono'
import crypto from 'node:crypto'
import { decodeEventLog, formatEther, type Hex, parseAbiItem } from 'viem'
import { arcPublicClient, getEscrowContractAddress } from '../lib/oracleSigner.js'

export interface StreamEvent {
  id: string
  source: 'quicknode' | 'arc-rpc'
  eventName:
    | 'EscrowCreated'
    | 'MilestoneSettled'
    | 'EscrowSettled'
    | 'TECDPenaltyApplied'
    | 'TimeoutRefunded'
    | 'ArcBlock'
  chainId: 5042002
  blockNumber: number
  logIndex: number
  txHash?: string
  escrowId?: string
  summary: string
  receivedAt: string
}

const ESCROW_LOG_EVENTS = [
  parseAbiItem(
    'event EscrowCreated(bytes32 indexed escrowId, address indexed payer, address indexed payee, uint256 amount, uint256 deadline, uint256 lambdaBps, uint256 milestoneCount, bool isAgentMode)',
  ),
  parseAbiItem(
    'event MilestoneSettled(bytes32 indexed escrowId, uint256 indexed milestoneIndex, address indexed payee, uint256 payeePayout, uint256 payerRebate, uint256 protocolFee, bytes32 deliverableHash, uint256 nonceUsed)',
  ),
  parseAbiItem(
    'event TECDPenaltyApplied(bytes32 indexed escrowId, uint256 indexed milestoneIndex, uint256 delaySeconds, uint256 decayBps, uint256 payerRebate, uint256 payeePayout)',
  ),
  parseAbiItem(
    'event TimeoutRefunded(bytes32 indexed escrowId, address indexed payer, uint256 refundedAmount, uint256 milestonesRefunded)',
  ),
] as const

// Ephemeral in-memory ring buffer for QuickNode webhook pushes within the active runtime instance
const webhookBuffer: StreamEvent[] = []

function verifyQuickNodeSignature(
  rawBody: string,
  headerSig: string | undefined,
  secret: string,
): boolean {
  if (!headerSig) return false
  const cleanSig = headerSig.replace(/^sha256=/i, '').trim()
  const expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
  if (cleanSig.length !== expected.length) return false
  return crypto.timingSafeEqual(Buffer.from(cleanSig, 'utf8'), Buffer.from(expected, 'utf8'))
}

function normalizeQuickNodeEvents(payload: unknown): StreamEvent[] {
  const now = new Date().toISOString()
  const out: StreamEvent[] = []
  const items = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object'
      ? Array.isArray((payload as Record<string, unknown>).data)
        ? ((payload as Record<string, unknown>).data as unknown[])
        : [payload]
      : []

  for (const item of items) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const blockNumber = Number(row.blockNumber ?? row.number ?? 0)
    const logIndex = Number(row.logIndex ?? 0)
    const txHash =
      typeof row.transactionHash === 'string'
        ? row.transactionHash
        : typeof row.txHash === 'string'
          ? row.txHash
          : undefined
    const rawName = String(row.eventName ?? row.event ?? 'ArcBlock')
    const eventName: StreamEvent['eventName'] =
      rawName === 'EscrowCreated' ||
      rawName === 'MilestoneSettled' ||
      rawName === 'EscrowSettled' ||
      rawName === 'TECDPenaltyApplied' ||
      rawName === 'TimeoutRefunded'
        ? rawName
        : 'ArcBlock'
    const escrowId = typeof row.escrowId === 'string' ? row.escrowId : undefined

    out.push({
      id: `qn_${txHash ?? crypto.randomBytes(6).toString('hex')}_${logIndex}`,
      source: 'quicknode',
      eventName,
      chainId: 5042002,
      blockNumber: Number.isFinite(blockNumber) ? blockNumber : 0,
      logIndex: Number.isFinite(logIndex) ? logIndex : 0,
      txHash,
      escrowId,
      summary: `${eventName} pushed via QuickNode Stream at Arc block #${blockNumber}`,
      receivedAt: now,
    })
  }
  return out
}

export const quicknodeWebhookRoute = new Hono()

quicknodeWebhookRoute.post('/', async (c) => {
  const rawBody = await c.req.text()
  const secret = process.env.QUICKNODE_WEBHOOK_SECRET?.trim()

  if (secret) {
    const sig = c.req.header('x-qn-signature')
    if (!verifyQuickNodeSignature(rawBody, sig, secret)) {
      return c.json({ error: 'Invalid x-qn-signature HMAC' }, 401)
    }
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return c.json({ error: 'Invalid JSON payload' }, 400)
  }

  const events = normalizeQuickNodeEvents(payload)
  for (const evt of events) {
    webhookBuffer.unshift(evt)
  }
  if (webhookBuffer.length > 60) webhookBuffer.length = 60

  return c.json({ ok: true, ingested: events.length })
})

export const eventsRoute = new Hono()

// Cached historical ArcScan Blockscout backfill so the ticker is immediately populated with real txs
let historicalCache: { fetchedAt: number; events: StreamEvent[] } | null = null
const HISTORICAL_TTL_MS = 30_000

async function fetchHistoricalArcLogs(escrowContract: string): Promise<StreamEvent[]> {
  if (historicalCache && Date.now() - historicalCache.fetchedAt < HISTORICAL_TTL_MS) {
    return historicalCache.events
  }

  const results: StreamEvent[] = []
  try {
    const res = await fetch(
      `https://testnet.arcscan.app/api/v2/addresses/${escrowContract}/logs`,
      { signal: AbortSignal.timeout(5000) },
    )
    if (res.ok) {
      const json = (await res.json()) as {
        items?: Array<{
          block_number?: number
          index?: number
          transaction_hash?: string
          data?: string
          topics?: Array<string | null>
          decoded?: { method_call?: string; parameters?: Array<{ name: string; value: string }> }
        }>
      }

      for (const item of json.items ?? []) {
        const blockNumber = Number(item.block_number ?? 0)
        const logIndex = Number(item.index ?? 0)
        const txHash = item.transaction_hash
        const topics = (item.topics ?? []).filter((t): t is string => typeof t === 'string' && t.startsWith('0x'))
        let eventName: StreamEvent['eventName'] | null = null
        let escrowId: string | undefined
        let summary = ''

        if (topics.length > 0 && typeof item.data === 'string' && item.data.startsWith('0x')) {
          try {
            const decoded = decodeEventLog({
              abi: ESCROW_LOG_EVENTS,
              data: item.data as Hex,
              topics: topics as [Hex, ...Hex[]],
              strict: false,
            })
            eventName = decoded.eventName as StreamEvent['eventName']
            const args = (decoded.args ?? {}) as Record<string, unknown>
            if (typeof args.escrowId === 'string') escrowId = args.escrowId

            if (eventName === 'EscrowCreated' && typeof args.amount === 'bigint') {
              summary = `Escrow locked (${Number(formatEther(args.amount)).toFixed(2)} USDC) on Arc #${blockNumber}`
            } else if (eventName === 'MilestoneSettled' && typeof args.payeePayout === 'bigint') {
              summary = `Atomic DvP settled (${Number(formatEther(args.payeePayout)).toFixed(4)} USDC) on Arc #${blockNumber}`
            } else if (eventName === 'TECDPenaltyApplied' && typeof args.payerRebate === 'bigint') {
              summary = `TECD automatic rebate (${Number(formatEther(args.payerRebate)).toFixed(4)} USDC) on Arc #${blockNumber}`
            } else if (eventName === 'TimeoutRefunded' && typeof args.refundedAmount === 'bigint') {
              summary = `Timeout refund (${Number(formatEther(args.refundedAmount)).toFixed(4)} USDC) on Arc #${blockNumber}`
            }
          } catch {
            // Non-escrow log (e.g. FaucetDispensed) — skip
          }
        }

        if (eventName) {
          results.push({
            id: `arc_hist_${blockNumber}_${logIndex}`,
            source: 'arc-rpc',
            eventName,
            chainId: 5042002,
            blockNumber,
            logIndex,
            txHash,
            escrowId,
            summary: summary || `${eventName} confirmed on Arc Testnet #${blockNumber}`,
            receivedAt: new Date().toISOString(),
          })
        }
      }
    }
  } catch {
    // Fallback to live RPC logs below
  }

  historicalCache = { fetchedAt: Date.now(), events: results }
  return results
}

/**
 * Stateless GET /api/events: backfills real historical EscrowCreated, MilestoneSettled,
 * TECDPenaltyApplied, and TimeoutRefunded logs from Arc Testnet (5042002), merged with
 * live getLogs and incoming QuickNode Streams webhook payloads.
 */
eventsRoute.get('/', async (c) => {
  const limit = Math.min(50, Math.max(1, Number(c.req.query('limit') ?? 25)))
  const escrowContract = getEscrowContractAddress()
  const merged = new Map<string, StreamEvent>()

  for (const evt of webhookBuffer) {
    const key = evt.txHash ? `${evt.txHash}:${evt.logIndex}` : evt.id
    merged.set(key, evt)
  }

  let latestBlock = 0
  if (escrowContract) {
    // 1. Backfill full historical contract events via ArcScan logs API
    const historical = await fetchHistoricalArcLogs(escrowContract)
    for (const evt of historical) {
      const key = evt.txHash ? `${evt.txHash}:${evt.logIndex}` : evt.id
      if (!merged.has(key)) merged.set(key, evt)
    }

    // 2. Overlay latest live RPC logs for sub-second freshness
    try {
      const head = await arcPublicClient.getBlockNumber()
      latestBlock = Number(head)
      const fromBlock = head > 5000n ? head - 5000n : 0n
      const logs = await arcPublicClient.getLogs({
        address: escrowContract,
        events: ESCROW_LOG_EVENTS,
        fromBlock,
        toBlock: head,
      })

      for (const log of logs) {
        const eventName = log.eventName as StreamEvent['eventName']
        const args = (log.args ?? {}) as Record<string, unknown>
        const blockNumber = Number(log.blockNumber ?? 0n)
        const logIndex = typeof log.logIndex === 'number' ? log.logIndex : 0
        const txHash = log.transactionHash ?? undefined
        const escrowId = typeof args.escrowId === 'string' ? args.escrowId : undefined
        const key = txHash ? `${txHash}:${logIndex}` : `arc_${blockNumber}_${logIndex}`

        if (!merged.has(key)) {
          merged.set(key, {
            id: `arc_${blockNumber}_${logIndex}`,
            source: 'arc-rpc',
            eventName,
            chainId: 5042002,
            blockNumber,
            logIndex,
            txHash,
            escrowId,
            summary: `${eventName} confirmed on Arc Testnet block #${blockNumber}`,
            receivedAt: new Date().toISOString(),
          })
        }
      }
    } catch {
      // Return historical + webhook events
    }
  }

  // Strictly order by blockNumber descending, then logIndex descending (Arc sub-second blocks share timestamps)
  const events = Array.from(merged.values())
    .sort((a, b) => (b.blockNumber !== a.blockNumber ? b.blockNumber - a.blockNumber : b.logIndex - a.logIndex))
    .slice(0, limit)

  return c.json({
    chainId: 5042002,
    latestBlock,
    events,
  })
})
