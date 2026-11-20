import { Hono } from 'hono'
import { createWalletClient, http, parseEther } from 'viem'
import { DIPTOS_ESCROW_ABI } from '../../../packages/sdk/src/index.js'
import {
  ARC_RPC_PRIMARY,
  arcPublicClient,
  arcTestnetChain,
  getEscrowContractAddress,
  getOracleAccount,
} from '../lib/oracleSigner.js'

export const walletRelayRoute = new Hono()

const ALLOWED_FUNCTIONS = new Set([
  'createEscrowLink',
  'fundTestEscrow',
  'releaseWithOracle',
  'claimTimeoutRefund',
  'faucetMint',
])

walletRelayRoute.get('/address', (c) => {
  const account = getOracleAccount()
  return c.json({
    address: account?.address ?? '0x344d7adf93542C6c27a11bb53A2d7C9d909D9f34',
    chainId: 5042002,
  })
})

walletRelayRoute.post('/relay', async (c) => {
  const account = getOracleAccount()
  if (!account) {
    return c.json({ error: 'Judge relayer key not configured on server' }, 503)
  }

  const body = await c.req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return c.json({ error: 'Invalid JSON payload' }, 400)
  }

  const functionName = typeof body.functionName === 'string' ? body.functionName.trim() : ''
  if (!ALLOWED_FUNCTIONS.has(functionName)) {
    return c.json({ error: `Function ${functionName} is not permitted on judge relayer` }, 400)
  }

  const rawArgs = Array.isArray(body.args) ? body.args : []
  const args = rawArgs.map((a: unknown) =>
    typeof a === 'string' && /^\d+$/.test(a) ? BigInt(a) : a,
  )

  let value = body.valueWei ? BigInt(String(body.valueWei)) : 0n
  // Cap judge test wallet escrow funding to max 0.25 USDC per tx so the 14.84 USDC reserve lasts for hundreds of tests
  const maxTestValue = parseEther('0.25')
  if (value > maxTestValue) {
    value = maxTestValue
  }

  const escrowAddr = getEscrowContractAddress()

  try {
    const wc = createWalletClient({
      account,
      chain: arcTestnetChain,
      transport: http(ARC_RPC_PRIMARY),
    })

    const hash = await wc.writeContract({
      address: escrowAddr,
      abi: DIPTOS_ESCROW_ABI,
      functionName: functionName as never,
      args: args as never,
      value,
    })

    const rc = await arcPublicClient.waitForTransactionReceipt({ hash })
    return c.json({
      hash,
      blockNumber: rc.blockNumber.toString(),
      gasUsed: rc.gasUsed.toString(),
      status: rc.status,
      from: account.address,
    })
  } catch (err) {
    return c.json(
      {
        error: (err as Error).message.split('\n')[0] || 'Arc Testnet transaction reverted',
      },
      502,
    )
  }
})
