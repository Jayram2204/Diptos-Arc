import { Hono } from 'hono'
import crypto from 'node:crypto'
import { isAddress, keccak256, stringToHex } from 'viem'
import { type EscrowMode, type EscrowRecord, getEscrowById, listEscrows, saveEscrow, updateEscrow } from '../store.js'

export const escrowsRoute = new Hono()

escrowsRoute.get('/', (c) => {
  return c.json({ escrows: listEscrows() })
})

escrowsRoute.get('/:id', (c) => {
  const escrow = getEscrowById(c.req.param('id'))
  if (!escrow) {
    return c.json({ error: 'Escrow not found' }, 404)
  }
  return c.json({ escrow })
})

escrowsRoute.post('/', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return c.json({ error: 'Invalid JSON payload' }, 400)
  }

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const scope = typeof body.scope === 'string' ? body.scope.trim() : ''
  const amountUsdc = Number(body.amountUsdc)
  const deadlineHours = Number(body.deadlineHours ?? 48)
  const mode: EscrowMode = body.mode === 'agent' ? 'agent' : 'human'
  const payee = typeof body.payee === 'string' && isAddress(body.payee.trim())
    ? body.payee.trim()
    : '0x000000000000000000000000000000000000dEaD'
  const tecdLambda = Number.isFinite(Number(body.tecdLambda))
    ? Math.min(2.0, Math.max(0.05, Number(body.tecdLambda)))
    : 0.35

  if (!title || title.length < 2) {
    return c.json({ error: 'Deliverable title is required' }, 400)
  }
  if (!scope || scope.length < 4) {
    return c.json({ error: 'Deliverable scope is required' }, 400)
  }
  if (!Number.isFinite(amountUsdc) || amountUsdc <= 0) {
    return c.json({ error: 'amountUsdc must be a positive number' }, 400)
  }
  if (!Number.isFinite(deadlineHours) || deadlineHours < 1 || deadlineHours > 720) {
    return c.json({ error: 'deadlineHours must be between 1 and 720' }, 400)
  }

  const id = `esc_${crypto.randomBytes(5).toString('hex')}`
  const escrowIdBytes32 = keccak256(stringToHex(`diptos:arc:5042002:${id}`))
  const now = Date.now()
  const deadlineMs = now + Math.round(deadlineHours * 3600 * 1000)

  const record: EscrowRecord = {
    id,
    escrowIdBytes32,
    title,
    scope,
    amountUsdc,
    deadline: new Date(deadlineMs).toISOString(),
    deadlineUnix: Math.floor(deadlineMs / 1000),
    deadlineHours,
    mode,
    payer: typeof body.payer === 'string' && isAddress(body.payer) ? body.payer : undefined,
    payee,
    tecdLambda: Number(tecdLambda.toFixed(4)),
    tecdLambdaBps: Math.round(tecdLambda * 10_000),
    status: 'created',
    createdAt: new Date(now).toISOString(),
  }

  saveEscrow(record)
  return c.json(
    {
      escrow: record,
      checkoutPath: `/pay/${record.id}`,
      shareUrl: `https://diptos.xyz/pay/${record.id}`,
    },
    201,
  )
})

escrowsRoute.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const existing = getEscrowById(id)
  if (!existing) {
    return c.json({ error: 'Escrow not found' }, 404)
  }
  const body = await c.req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return c.json({ error: 'Invalid JSON payload' }, 400)
  }

  const patch: Partial<EscrowRecord> = {}
  if (typeof body.payer === 'string' && isAddress(body.payer)) patch.payer = body.payer
  if (typeof body.payee === 'string' && isAddress(body.payee)) patch.payee = body.payee
  if (typeof body.txHash === 'string' && /^0x[0-9a-fA-F]{64}$/.test(body.txHash)) patch.txHash = body.txHash
  if (typeof body.settleTxHash === 'string' && /^0x[0-9a-fA-F]{64}$/.test(body.settleTxHash)) {
    patch.settleTxHash = body.settleTxHash
  }
  if (body.status === 'created' || body.status === 'funded' || body.status === 'verified' || body.status === 'settled') {
    patch.status = body.status
  }

  const updated = updateEscrow(id, patch)
  return c.json({ escrow: updated })
})
