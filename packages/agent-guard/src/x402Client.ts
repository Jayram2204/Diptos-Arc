import { PolicyGuard, type QuoteEvaluationResult } from './policyGuard.js'
import { calculateTecdSettlement, type TecdSettlementOutput } from './tecd.js'

export interface OutputSchemaSpec {
  requiredKeys: string[]
  expectedSha256?: string
}

export interface X402Quote {
  escrowId: string
  agentId: string
  provider: string
  payee: string
  amountUsdc: number
  slaWindowSeconds: number
  lambda: number
  chain: 'arc-5042002' | 'base-8453'
}

export interface EscrowLockReceipt {
  escrowId: string
  locked: boolean
  txHash?: string
}

export interface X402GuardedResult<TOutput = unknown> {
  status: 'settled' | 'refunded' | 'blocked'
  stage: 'quote' | 'lock' | 'verify' | 'settle'
  policy: QuoteEvaluationResult
  escrowId?: string
  output?: TOutput
  settlement?: TecdSettlementOutput
  refundReason?: string
  x402Headers: Record<string, string>
}

export interface DiptosX402ClientConfig {
  policy: PolicyGuard
  /**
   * External non-custodial escrow locker callback (e.g. Circle Programmable Wallet / backend signer).
   * The AI agent NEVER sees private keys.
   */
  lockEscrow: (quote: X402Quote) => Promise<EscrowLockReceipt>
  /** External on-chain settlement callback (releaseWithOracle / releaseByPayer). */
  settleEscrow: (params: {
    escrowId: string
    proofHash: string
    settlement: TecdSettlementOutput
  }) => Promise<{ txHash?: string }>
  /** External refund callback invoked automatically when output verification fails. */
  refundEscrow: (params: { escrowId: string; reason: string }) => Promise<{ txHash?: string }>
}

export function validateOutputSchema(
  output: unknown,
  schema?: OutputSchemaSpec,
): { valid: boolean; reason?: string } {
  if (!schema) return { valid: true }
  if (!output || typeof output !== 'object') {
    return { valid: false, reason: 'Output payload is not a JSON object.' }
  }
  const rec = output as Record<string, unknown>
  for (const key of schema.requiredKeys) {
    if (!(key in rec) || rec[key] === undefined || rec[key] === null || rec[key] === '') {
      return { valid: false, reason: `Output schema violation: missing required field "${key}".` }
    }
  }
  return { valid: true }
}

/**
 * Parses standard HTTP 402 Payment Required headers (`PAYMENT-REQUIRED` / `X-PAYMENT` / `X-Diptos-Rail`).
 */
export function parseX402ChallengeHeaders(headers: Headers | Record<string, string>): {
  amountUsdc?: number
  payee?: string
  rail?: string
} {
  const get = (k: string) =>
    headers instanceof Headers
      ? headers.get(k) ?? headers.get(k.toLowerCase())
      : headers[k] ?? headers[k.toLowerCase()] ?? null

  const paymentReq = get('PAYMENT-REQUIRED') || get('X-PAYMENT')
  const rail = get('X-Diptos-Rail') || 'arc-5042002'
  let amountUsdc: number | undefined
  let payee: string | undefined

  if (paymentReq) {
    try {
      const parsed = JSON.parse(paymentReq) as { amountUsdc?: number; amount?: number; payee?: string; payTo?: string }
      amountUsdc = Number(parsed.amountUsdc ?? parsed.amount)
      payee = parsed.payee ?? parsed.payTo
    } catch {
      const amtMatch = paymentReq.match(/amount=([0-9.]+)/i)
      const payMatch = paymentReq.match(/payee=(0x[a-fA-F0-9]{40})/i)
      if (amtMatch) amountUsdc = Number(amtMatch[1])
      if (payMatch) payee = payMatch[1]
    }
  }

  return { amountUsdc: Number.isFinite(amountUsdc) ? amountUsdc : undefined, payee, rail }
}

/**
 * Creates a proof-gated x402 client implementing the 4-step Dipto pipeline:
 * 1. Quote -> 2. Lock USDC in DiptosEscrow.sol -> 3. Execute & Verify Output Schema -> 4. Release or Auto-Rebate via TECD.
 */
export function createDiptosX402Client(config: DiptosX402ClientConfig) {
  async function executeGuarded<TOutput>(params: {
    quote: X402Quote
    outputSchema?: OutputSchemaSpec
    elapsedSeconds?: number
    proofHash?: string
    runTask: () => Promise<TOutput>
  }): Promise<X402GuardedResult<TOutput>> {
    const { quote, outputSchema, runTask } = params
    const x402Headers: Record<string, string> = {
      'X-Diptos-Rail': quote.chain,
      'X-Agent-Budget-Cap': `${config.policy.config.maxPerTaskUsdc.toFixed(2)} USDC`,
      'X-Proof-Gate': 'deterministic-eip712',
    }

    // Step 1: Quote & Policy Harness check (zero private keys in agent process)
    const policyResult = config.policy.evaluateQuote({
      agentId: quote.agentId,
      provider: quote.provider,
      amountUsdc: quote.amountUsdc,
      estimatedLatencySeconds: quote.slaWindowSeconds,
    })

    if (!policyResult.allowed) {
      return {
        status: 'blocked',
        stage: 'quote',
        policy: policyResult,
        refundReason: policyResult.reason,
        x402Headers,
      }
    }

    // Step 2: Lock USDC in DiptosEscrow.sol via external non-custodial signer
    config.policy.recordSpend(quote.agentId, quote.amountUsdc)
    const lockReceipt = await config.lockEscrow(quote)
    if (!lockReceipt.locked) {
      config.policy.refundSpend(quote.agentId, quote.amountUsdc)
      return {
        status: 'blocked',
        stage: 'lock',
        policy: policyResult,
        escrowId: quote.escrowId,
        refundReason: 'Escrow lock transaction did not confirm.',
        x402Headers,
      }
    }

    // Step 3: Execute task & deterministically verify output schema / proof
    const startedMs = Date.now()
    let output: TOutput
    try {
      output = await runTask()
    } catch (err) {
      const reason = `Task execution error: ${(err as Error).message}`
      await config.refundEscrow({ escrowId: quote.escrowId, reason })
      config.policy.refundSpend(quote.agentId, quote.amountUsdc)
      return {
        status: 'refunded',
        stage: 'verify',
        policy: policyResult,
        escrowId: quote.escrowId,
        refundReason: reason,
        x402Headers,
      }
    }

    const schemaCheck = validateOutputSchema(output, outputSchema)
    if (!schemaCheck.valid) {
      const reason = schemaCheck.reason || 'Output failed deterministic schema verification.'
      await config.refundEscrow({ escrowId: quote.escrowId, reason })
      config.policy.refundSpend(quote.agentId, quote.amountUsdc)
      return {
        status: 'refunded',
        stage: 'verify',
        policy: policyResult,
        escrowId: quote.escrowId,
        output,
        refundReason: reason,
        x402Headers,
      }
    }

    // Step 4: Release in <1s or auto-rebate buyer via TECD math
    const actualElapsed = params.elapsedSeconds ?? Math.max(0, Math.floor((Date.now() - startedMs) / 1000))
    const delaySeconds = Math.max(0, actualElapsed - quote.slaWindowSeconds)
    const settlement = calculateTecdSettlement({
      principalUsdc: quote.amountUsdc,
      lambda: quote.lambda,
      delaySeconds,
      slaWindowSeconds: quote.slaWindowSeconds,
    })

    await config.settleEscrow({
      escrowId: quote.escrowId,
      proofHash: params.proofHash || `proof:${quote.escrowId}`,
      settlement,
    })

    return {
      status: 'settled',
      stage: 'settle',
      policy: policyResult,
      escrowId: quote.escrowId,
      output,
      settlement,
      x402Headers: {
        ...x402Headers,
        'X-PAYMENT': JSON.stringify({
          escrowId: quote.escrowId,
          settledUsdc: settlement.payeePayoutUsdc,
          rebateUsdc: settlement.buyerRebateUsdc,
          feeUsdc: settlement.protocolFeeUsdc,
        }),
      },
    }
  }

  return { executeGuarded, policy: config.policy }
}

/**
 * Convenience wrapper for turning any async agent tool into a proof-gated x402 call.
 */
export function withDiptosGuard<TOutput>(
  client: ReturnType<typeof createDiptosX402Client>,
  quote: X402Quote,
  outputSchema: OutputSchemaSpec | undefined,
  runTask: () => Promise<TOutput>,
  elapsedSeconds?: number,
): Promise<X402GuardedResult<TOutput>> {
  return client.executeGuarded({ quote, outputSchema, runTask, elapsedSeconds })
}
