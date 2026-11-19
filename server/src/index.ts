import { serve } from '@hono/node-server'
import { app } from './app.js'

const port = parseInt(process.env.API_PORT || '4000', 10)
console.log(`[diptos-server] listening on http://127.0.0.1:${port} (Arc Testnet 5042002)`)

serve({ fetch: app.fetch, port })
