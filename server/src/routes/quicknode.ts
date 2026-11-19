import { Hono } from 'hono'
import crypto from 'node:crypto'
import { streamSSE } from 'hono/streaming'
import { startArcRpcIndexer } from '../lib/arcIndexer.js'
import { appendStreamEvent, listStreamEvents, type StreamEvent, updateEscrow } from '../store.js'

type Subscriber = (evt: StreamEvent) => void
const subscribers = new Set<Subscriber>()

export function broadcastStreamEvent(evt: StreamEvent) {
  for (const sub of subscribers) {
    try {
      sub(evt)
    } catch {
      // subscriber disconnected
    }
  }
}

// Boot the dual-mode Arc RPC fallback indexer alongside QuickNode webhooks
startArcRpcIndexer(broadcastStreamEvent)

function verifyQuickNodeSignature(rawBody: string, headerSig: string | undefined, secret: string): boolean {
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

    const summary =
      eventName === 'EscrowCreated'
        ? `Escrow funded on Arc block #${blockNumber}`
        : eventName === 'MilestoneSettled' || eventName === 'EscrowSettled'
          ? `Atomic DvP milestone settled on Arc block #${blockNumber}`
          : eventName === 'TECDPenaltyApplied'
            ? `TECD latency decay & buyer rebate executed on block #${blockNumber}`
            : eventName === 'TimeoutRefunded'
              ? `Permissionless timeout refund reclaimed on block #${blockNumber}`
              : `Arc Testnet block #${blockNumber} ingested via QuickNode Stream`

    out.push({
      id: `qn_${crypto.randomBytes(6).toString('hex')}`,
      source: 'quicknode',
      eventName,
      chainId: 5042002,
      blockNumber: Number.isFinite(blockNumber) ? blockNumber : 0,
      txHash,
      logIndex: typeof row.logIndex === 'number' ? row.logIndex : undefined,
      escrowId,
      summary,
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
  let ingested = 0

  for (const evt of events) {
    const { added } = appendStreamEvent(evt)
    if (!added) continue
    ingested += 1
    if (evt.escrowId) {
      if (evt.eventName === 'EscrowCreated') {
        updateEscrow(evt.escrowId, { status: 'funded', txHash: evt.txHash })
      } else if (evt.eventName === 'MilestoneSettled' || evt.eventName === 'EscrowSettled') {
        updateEscrow(evt.escrowId, { status: 'settled', settleTxHash: evt.txHash })
      } else if (evt.eventName === 'TimeoutRefunded') {
        updateEscrow(evt.escrowId, { status: 'refunded' })
      }
    }
    broadcastStreamEvent(evt)
  }

  return c.json({ ok: true, ingested })
})

export const eventsStreamRoute = new Hono()

eventsStreamRoute.get('/', (c) => {
  return streamSSE(c, async (stream) => {
    const recent = listStreamEvents(30)
    await stream.writeSSE({
      event: 'snapshot',
      data: JSON.stringify({ events: recent }),
    })

    const onEvent: Subscriber = (evt) => {
      void stream.writeSSE({
        event: 'quicknode',
        id: evt.id,
        data: JSON.stringify(evt),
      })
    }

    subscribers.add(onEvent)

    const keepAlive = setInterval(() => {
      void stream.writeSSE({
        event: 'ping',
        data: JSON.stringify({ ts: Date.now() }),
      })
    }, 20_000)

    await new Promise<void>((resolve) => {
      c.req.raw.signal.addEventListener('abort', () => {
        clearInterval(keepAlive)
        subscribers.delete(onEvent)
        resolve()
      })
    })
  })
})
