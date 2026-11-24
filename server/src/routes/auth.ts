import { Hono } from 'hono'
import crypto from 'node:crypto'
import { type Address, getAddress, type Hex, isAddress, verifyMessage } from 'viem'

interface NonceRecord {
  nonce: string
  domain: string
  expiresAt: number
}

interface SessionRecord {
  id: string
  address: Address
  chainId: number
  issuedAt: number
  expiresAt: number
}

const SESSION_COOKIE = 'diptos_sid'
const NONCE_COOKIE = 'diptos_nonce'
const SESSION_TTL_SEC = 7 * 24 * 60 * 60 // 7 days
const NONCE_TTL_SEC = 5 * 60 // 5 minutes
const NONCE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

const COOKIE_SECRET =
  process.env.SESSION_COOKIE_SECRET?.trim() ||
  process.env.ORACLE_PRIVATE_KEY?.trim() ||
  'diptos-dev-cookie-hmac-secret'

// Server-side stores (in-memory for dev/edge, pluggable for Redis/Postgres)
const nonceStore = new Map<string, NonceRecord>()
const sessionStore = new Map<string, SessionRecord>()

/** Cryptographically random 12-character alphanumeric nonce (>71 bits entropy). */
function generateAlphanumericNonce(length = 12): string {
  const bytes = crypto.randomBytes(length * 2)
  let out = ''
  for (let i = 0; i < bytes.length && out.length < length; i++) {
    const idx = bytes[i] % NONCE_ALPHABET.length
    out += NONCE_ALPHABET[idx]
  }
  return out
}

function signNonceValue(nonce: string): string {
  const mac = crypto.createHmac('sha256', COOKIE_SECRET).update(nonce).digest('hex').slice(0, 24)
  return `${nonce}.${mac}`
}

function verifySignedNonceCookie(cookieVal: string | null): string | null {
  if (!cookieVal) return null
  const [nonce, mac] = cookieVal.split('.')
  if (!nonce || !mac) return null
  const expected = crypto.createHmac('sha256', COOKIE_SECRET).update(nonce).digest('hex').slice(0, 24)
  if (mac.length !== expected.length) return null
  return crypto.timingSafeEqual(Buffer.from(mac, 'utf8'), Buffer.from(expected, 'utf8')) ? nonce : null
}

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

function buildCookieHeader(name: string, value: string, maxAgeSec: number, isHttps: boolean): string {
  const attrs = [
    `${name}=${encodeURIComponent(value)}`,
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

export const authRoute = new Hono()

authRoute.get('/nonce', (c) => {
  const now = Date.now()
  for (const [k, rec] of nonceStore.entries()) {
    if (rec.expiresAt <= now) nonceStore.delete(k)
  }

  const host = c.req.header('host') || 'diptos.xyz'
  const domain = host.replace(/:\d+$/, '')
  const nonce = generateAlphanumericNonce(12)
  nonceStore.set(nonce, { nonce, domain, expiresAt: now + NONCE_TTL_SEC * 1000 })

  const https = isRequestHttps(c.req)
  c.header('Set-Cookie', buildCookieHeader(NONCE_COOKIE, signNonceValue(nonce), NONCE_TTL_SEC, https))

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
    return c.json({ error: 'Signed EIP-4361 message and nonce are required.' }, 400)
  }

  const storedNonce = nonceStore.get(nonce)
  const cookieNonce = verifySignedNonceCookie(parseCookie(c.req.header('cookie'), NONCE_COOKIE))
  const now = Date.now()

  if (!storedNonce || storedNonce.expiresAt < now) {
    nonceStore.delete(nonce)
    return c.json({ error: 'Verification nonce expired. Please try again.' }, 401)
  }
  if (cookieNonce && cookieNonce !== nonce) {
    return c.json({ error: 'Nonce cookie mismatch.' }, 401)
  }
  if (!message.includes(`Nonce: ${nonce}`)) {
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

  // Single-use nonce invalidation
  nonceStore.delete(nonce)

  const sid = crypto.randomBytes(32).toString('hex')
  const session: SessionRecord = {
    id: sid,
    address: checksummed,
    chainId: Number(chainId) || 5042002,
    issuedAt: now,
    expiresAt: now + SESSION_TTL_SEC * 1000,
  }
  sessionStore.set(sid, session)

  const https = isRequestHttps(c.req)
  c.header('Set-Cookie', buildCookieHeader(NONCE_COOKIE, '', 0, https), { append: true })
  c.header('Set-Cookie', buildCookieHeader(SESSION_COOKIE, sid, SESSION_TTL_SEC, https), { append: true })

  return c.json({
    authenticated: true,
    address: session.address,
    chainId: session.chainId,
    issuedAt: new Date(session.issuedAt).toISOString(),
    expiresAt: new Date(session.expiresAt).toISOString(),
  })
})

authRoute.get('/session', (c) => {
  const cookieHeader = c.req.header('cookie')
  const sid = parseCookie(cookieHeader, SESSION_COOKIE)
  const preferences = {
    chain: parseCookie(cookieHeader, 'diptos_chain'),
    mode: parseCookie(cookieHeader, 'diptos_mode'),
    consent: parseCookie(cookieHeader, 'diptos_consent') ?? 'pending',
    splashSeen: parseCookie(cookieHeader, 'diptos_splash_seen') === '1',
  }

  if (!sid) {
    return c.json({ authenticated: false, address: null, chainId: null, preferences })
  }
  const session = sessionStore.get(sid)
  if (!session || session.expiresAt <= Date.now()) {
    sessionStore.delete(sid)
    return c.json({ authenticated: false, address: null, chainId: null, preferences })
  }
  return c.json({
    authenticated: true,
    address: session.address,
    chainId: session.chainId,
    issuedAt: new Date(session.issuedAt).toISOString(),
    expiresAt: new Date(session.expiresAt).toISOString(),
    preferences,
  })
})

authRoute.post('/logout', (c) => {
  const sid = parseCookie(c.req.header('cookie'), SESSION_COOKIE)
  if (sid) sessionStore.delete(sid)
  const https = isRequestHttps(c.req)
  c.header('Set-Cookie', buildCookieHeader(SESSION_COOKIE, '', 0, https), { append: true })
  c.header('Set-Cookie', buildCookieHeader(NONCE_COOKIE, '', 0, https), { append: true })
  return c.json({ ok: true, authenticated: false })
})
