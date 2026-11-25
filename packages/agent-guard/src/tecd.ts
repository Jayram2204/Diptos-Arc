export interface TecdSettlementInput {
  principalUsdc: number
  lambda: number
  delaySeconds: number
  slaWindowSeconds: number
  feeBps?: number
}

export interface TecdSettlementOutput {
  principalUsdc: number
  payeePayoutUsdc: number
  buyerRebateUsdc: number
  protocolFeeUsdc: number
  decayPercent: number
  retentionRatio: number
}

const DEFAULT_FEE_BPS = 50 // 0.50% flat protocol fee

/**
 * Deterministic TECD settlement calculator matching DiptosEscrow.sol:
 * V(t) = V0 * exp(-lambda * (delay / window)^1.5)
 * Uses integer micro-USDC (6-decimal) conservation so payee + rebate + fee == principal ALWAYS.
 */
export function calculateTecdSettlement(input: TecdSettlementInput): TecdSettlementOutput {
  const principal = Math.max(0, input.principalUsdc)
  const principalMicro = Math.round(principal * 1_000_000)
  const feeBps = Math.min(100, Math.max(0, input.feeBps ?? DEFAULT_FEE_BPS))

  if (principalMicro === 0) {
    return {
      principalUsdc: 0,
      payeePayoutUsdc: 0,
      buyerRebateUsdc: 0,
      protocolFeeUsdc: 0,
      decayPercent: 0,
      retentionRatio: 1,
    }
  }

  const delay = Math.max(0, input.delaySeconds)
  const lambda = Math.min(5, Math.max(0, input.lambda))

  if (delay === 0 || lambda === 0) {
    const feeMicro = Math.floor((principalMicro * feeBps) / 10_000)
    const payeeMicro = principalMicro - feeMicro
    return {
      principalUsdc: principalMicro / 1_000_000,
      payeePayoutUsdc: payeeMicro / 1_000_000,
      buyerRebateUsdc: 0,
      protocolFeeUsdc: feeMicro / 1_000_000,
      decayPercent: 0,
      retentionRatio: 1,
    }
  }

  const windowSec = Math.max(3600, input.slaWindowSeconds)
  const ratio = Math.min(100, delay / windowSec)
  const exponent = lambda * Math.pow(ratio, 1.5)
  const retention = Math.exp(-exponent)

  const grossPayeeMicro = Math.floor(principalMicro * retention)
  const feeMicro = Math.floor((grossPayeeMicro * feeBps) / 10_000)
  const payeeMicro = grossPayeeMicro - feeMicro
  // Zero-dust conservation: buyerRebate absorbs any rounding dust
  const rebateMicro = principalMicro - payeeMicro - feeMicro

  return {
    principalUsdc: principalMicro / 1_000_000,
    payeePayoutUsdc: payeeMicro / 1_000_000,
    buyerRebateUsdc: rebateMicro / 1_000_000,
    protocolFeeUsdc: feeMicro / 1_000_000,
    decayPercent: Number(((1 - retention) * 100).toFixed(2)),
    retentionRatio: retention,
  }
}
