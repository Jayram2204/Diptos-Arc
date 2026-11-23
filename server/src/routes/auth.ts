import { Hono } from 'hono'
import crypto from 'node:crypto'
import { type Address, getAddress, type Hex, isAddress, verifyMessage } from 'viem'

interface NonceRecord {
  nonce: string
  expiresAt: number
}

interface SessionRecord {
  id: string
  address: Address
  chainId: number
  createdAt: number
  expiresAt: number
}

const SESSION_COOKIE = 'diptos_sid'
const SESSION_TTL_SEC = 7 * 24 * 60 * 60 // 7 days
const NONCE_TTL_MS = 10 * 60 * 1000 // 10 minutes

// Server-side session & nonce stores (Redis REST optional, in-memory fallback for dev/serverless)
const nonceStore = new Map<string, NonceRecord>()
const sessionStore = new Map<string, SessionRecord>()

function parseCookie(header: string | undefined, name: string): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const [rawK, ...rest] = part.trim().split('=')
    if (rawK === name) {
      return decodeURIComponent(rest.join('='))
    }
  }
  return null
}

function buildCookieHeader(value: string, maxAgeSec: number, isHttps: boolean): string {
  const attrs = [
    `${SESSION_COOKIE}=${encodeURIComponent(value)}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${maxAgeSec}`,
  ]
  if (isHttps) attrs.push('Secure')
  return attrs.join('; ')
}

function isRequestHttps(req: { header: (name: string) => string | undefined; url: string }): boolean {
  const proto = req.header('x-forwarded-proto')
  if (proto) return proto.split(',')[0].trim() === 'https'
  return req.url.startsWith('https://')
}

function buildSiweMessage(params: {
  domain: string
  address: Address
  nonce: string
  chainId: number
  issuedAt: string
}): string {
  return [
    `${params.domain} wants you to sign in with your Ethereum account:`,
    params.address,
    '',
    'Sign in to Diptos Guaranteed Outcome Protection. Zero platform custody; this signature does not authorize any fund transfer.',
    '',
    `URI: https://${params.domain}`,
    'Version: 1',
    `Chain ID: ${params.chainId}`,
    `Nonce: ${params.nonce}`,
    `Issued At: ${params.issuedAt}`,
  ].join('\n')
}

export const authRoute = new Hono()

authRoute.get('/nonce', (c) => {
  const now = Date.now()
  for (const [k, rec] of nonceStore.entries()) {
    if (rec.expiresAt <= now) nonceStore.delete(k)
  }

  const nonce = crypto.randomBytes(16).toString('hex')
  nonceStore.set(nonce, { nonce, expiresAt: now + NONCE_TTL_MS })

  const host = c.req.header('host') || 'diptos.xyz'
  const domain = host.replace(/:\d+$/, '')
  return c.json({
    nonce,
    domain,
    chainId: 5042002,
    issuedAt: new Date(now).toISOString(),
  })
})

authRoute.post('/verify', async (c) => {
  let body: {
    address?: string
    signature?: string
    message?: string
    nonce?: string
    chainId?: number
  }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const { address, signature, message, nonce, chainId = 5042002 } = body
  if (!address || !isAddress(address)) {
    return c.json({ error: 'Valid 0x address is required.' }, 400)
  }
  if (!signature || !signature.startsWith('0x')) {
    return c.json({ error: 'Valid EIP-191 signature is required.' }, 400)
  }
  if (!nonce || !message) {
    return c.json({ error: 'Signed SIWE message and nonce are required.' }, 400)
  }

  const storedNonce = nonceStore.get(nonce)
  if (!storedNonce || storedNonce.expiresAt < Date.now()) {
    nonceStore.delete(nonce)
    return c.json({ error: 'Session nonce expired or invalid. Please retry.' }, 401)
  }
  if (!message.includes(nonce)) {
    return c.json({ error: 'Nonce mismatch in signed message.' }, 401)
  }

  const checksummed = getAddress(address)
  let valid = false
  try {
    valid = await verifyMessage({
      address: checksummed,
      message,
      signature: signature as Hex,
    })
  } catch {
    valid = false
  }

  if (!valid) {
    return c.json({ error: 'Signature verification failed.' }, 401)
  }

  // Single-use nonce
  nonceStore.delete(nonce)

  const sid = crypto.randomBytes(32).toString('hex')
  const now = Date.now()
  const session: SessionRecord = {
    id: sid,
    address: checksummed,
    chainId: Number(chainId) || 5042002,
    createdAt: now,
    expiresAt: now + SESSION_TTL_SEC * 1000,
  }
  sessionStore.set(sid, session)

  const https = isRequestHttps(c.req)
  c.header('Set-Cookie', buildCookieHeader(sid, SESSION_TTL_SEC, https))
  return c.json({
    authenticated: true,
    address: session.address,
    chainId: session.chainId,
    expiresAt: new Date(session.expiresAt).toISOString(),
  })
})

authRoute.get('/session', (c) => {
  const sid = parseCookie(c.req.header('cookie'), SESSION_COOKIE)
  if (!sid) {
    return c.json({ authenticated: false, address: null, chainId: null })
  }
  const session = sessionStore.get(sid)
  if (!session || session.expiresAt <= Date.now()) {
    sessionStore.delete(sid)
    return c.json({ authenticated: false, address: null, chainId: null })
  }
  return c.json({
    authenticated: true,
    address: session.address,
    chainId: session.chainId,
    expiresAt: new Date(session.expiresAt).toISOString(),
  })
})

authRoute.post('/logout', (c) => {
  const sid = parseCookie(c.req.header('cookie'), SESSION_COOKIE)
  if (sid) sessionStore.delete(sid)
  const https = isRequestHttps(c.req)
  c.header('Set-Cookie', buildCookieHeader('', 0, https))
  return c.json({ ok: true, authenticated: false })
})

export { buildSiweMessage }
