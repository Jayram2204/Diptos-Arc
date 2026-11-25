import { createOnrampServerKit } from '@circle-fin/onramp-kit/server'
import { Hono } from 'hono'
import { isAddress } from 'viem'

export const onrampRoute = new Hono()

onrampRoute.post('/sessions', async (c) => {
  c.header('Cache-Control', 'no-store')

  const apiKey = process.env.CIRCLE_API_KEY?.trim()
  if (!apiKey) {
    return c.json(
      {
        configured: false,
        reason: 'CIRCLE_API_KEY_NOT_SET',
        message:
          'Circle Onramp Kit requires CIRCLE_API_KEY in server environment variables. Existing Arc wallet checkout remains active.',
      },
      200,
    )
  }

  const body = await c.req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return c.json({ configured: true, error: 'Invalid JSON payload' }, 400)
  }

  const userId = String(body.userId ?? body.appUserId ?? '').trim()
  const destinationAddress = String(body.destinationAddress ?? '').trim()
  const escrowId = String(body.escrowId ?? '').trim()
  const amountUsdc = Number(body.amountUsdc ?? 0)

  if (!userId) {
    return c.json({ configured: true, error: 'userId is required' }, 400)
  }
  if (!destinationAddress || !isAddress(destinationAddress)) {
    return c.json({ configured: true, error: 'Valid EVM destinationAddress is required' }, 400)
  }
  if (!Number.isFinite(amountUsdc) || amountUsdc <= 0) {
    return c.json({ configured: true, error: 'amountUsdc must be greater than 0' }, 400)
  }

  const baseUrl = process.env.CIRCLE_ONRAMP_BASE_URL?.trim() || 'https://api-test.circle.com'
  const widgetBaseUrl =
    process.env.CIRCLE_ONRAMP_WIDGET_BASE_URL?.trim() || 'https://onramp-sandbox.arc.io'
  const referrerDomain = process.env.CIRCLE_ONRAMP_REFERRER_DOMAIN?.trim() || undefined

  try {
    const serverKit = createOnrampServerKit({
      apiKey,
      baseUrl,
      widgetBaseUrl,
      ...(referrerDomain ? { referrerDomain } : {}),
    })

    const session = await serverKit.createSession({
      appUserId: userId,
      destinationAddress,
      assets: {
        pairs: [{ token: 'USDC', chain: 'arc' }],
      },
    })

    return c.json({
      configured: true,
      escrowId: escrowId || undefined,
      amountUsdc,
      widgetBaseUrl,
      session,
    })
  } catch (err) {
    const msg = (err as Error).message || 'Circle Onramp session creation failed'
    return c.json(
      {
        configured: true,
        error: msg,
        reason: 'CIRCLE_ONRAMP_UPSTREAM_ERROR',
      },
      502,
    )
  }
})
