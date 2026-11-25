import { calculateTecdSettlement, type TecdSettlementOutput } from '../tecd.js'
import { type OutputSchemaSpec, validateOutputSchema } from '../x402Client.js'

export type ModelVerifierVerdict = 'SAME' | 'DIFF'

export interface ExternalModelReceipt {
  /** Reference adapter: AntSeed Model Verifier returns "SAME" (authentic) or "DIFF" (mismatch/spoofed). */
  verdict: ModelVerifierVerdict
  ipfsCid: string
  onChainProofHash: string
  verifierName?: string
}

export interface ComputeProofAttestation {
  jobId: string
  escrowId: string
  provider: string
  principalUsdc: number
  lambda: number
  slaWindowSeconds: number
  elapsedSeconds: number
  outputSha256: string
  expectedOutputSha256?: string
  outputPayload?: unknown
  outputSchema?: OutputSchemaSpec
  modelVerification: ExternalModelReceipt
}

export interface ComputeSlaCheck {
  label: string
  passed: boolean
  detail: string
}

export interface ComputeSlaEvaluation {
  action: 'release' | 'refund'
  verdict: ModelVerifierVerdict
  escrowId: string
  jobId: string
  delaySeconds: number
  settlement: TecdSettlementOutput
  checks: ComputeSlaCheck[]
  reason: string
}

function normalizeSha256(raw: string): string | null {
  const clean = raw.trim().replace(/^0x/i, '').toLowerCase()
  return /^[0-9a-f]{64}$/.test(clean) ? clean : null
}

/**
 * Provider-agnostic Distributed Compute SLA Verifier (AntSeed reference adapter).
 * - Releases ONLY when `modelVerification.verdict === "SAME"` AND output SHA-256 + schema pass.
 * - Triggers automatic `refund` if `verdict === "DIFF"` or output hash/schema fails.
 * - Feeds exact latency (`elapsedSeconds - slaWindowSeconds`) into WAD-parity TECD rebate math.
 */
export function verifyComputeSlaAttestation(
  attestation: ComputeProofAttestation,
): ComputeSlaEvaluation {
  const checks: ComputeSlaCheck[] = []

  const actualSha = normalizeSha256(attestation.outputSha256)
  checks.push({
    label: 'Output SHA-256 Format',
    passed: actualSha !== null,
    detail: actualSha ? `0x${actualSha.slice(0, 16)}…` : 'Invalid 64-char hex SHA-256',
  })

  if (attestation.expectedOutputSha256) {
    const expectedSha = normalizeSha256(attestation.expectedOutputSha256)
    const matched = actualSha !== null && expectedSha !== null && actualSha === expectedSha
    checks.push({
      label: 'Expected Output SHA-256 Match',
      passed: matched,
      detail: matched ? 'Exact digest match' : 'Output SHA-256 mismatch',
    })
  }

  if (attestation.outputSchema) {
    const schemaCheck = validateOutputSchema(attestation.outputPayload, attestation.outputSchema)
    checks.push({
      label: 'Output Schema Validation',
      passed: schemaCheck.valid,
      detail: schemaCheck.valid ? 'All required fields present' : (schemaCheck.reason ?? 'Schema invalid'),
    })
  }

  const mv = attestation.modelVerification
  const verdictOk = mv.verdict === 'SAME'
  checks.push({
    label: `${mv.verifierName || 'AntSeed Model Verifier'} Verdict`,
    passed: verdictOk,
    detail: verdictOk
      ? `SAME (CID: ${mv.ipfsCid.slice(0, 16)}…)`
      : `DIFF — model output diverged from deterministic reference`,
  })

  const proofAnchored = Boolean(mv.ipfsCid.trim()) && Boolean(mv.onChainProofHash.trim())
  checks.push({
    label: 'IPFS CID & On-Chain Proof Anchor',
    passed: proofAnchored,
    detail: proofAnchored ? mv.onChainProofHash.slice(0, 18) : 'Missing ipfsCid or onChainProofHash',
  })

  const delaySeconds = Math.max(0, attestation.elapsedSeconds - attestation.slaWindowSeconds)
  const settlement = calculateTecdSettlement({
    principalUsdc: attestation.principalUsdc,
    lambda: attestation.lambda,
    delaySeconds,
    slaWindowSeconds: attestation.slaWindowSeconds,
  })

  const allPassed = checks.every((c) => c.passed)

  if (!allPassed) {
    const failedReasons = checks
      .filter((c) => !c.passed)
      .map((c) => `${c.label}: ${c.detail}`)
      .join('; ')
    return {
      action: 'refund',
      verdict: mv.verdict,
      escrowId: attestation.escrowId,
      jobId: attestation.jobId,
      delaySeconds,
      settlement: {
        principalUsdc: attestation.principalUsdc,
        payeePayoutUsdc: 0,
        buyerRebateUsdc: attestation.principalUsdc,
        protocolFeeUsdc: 0,
        decayPercent: 100,
        retentionRatio: 0,
      },
      checks,
      reason: `Auto-refund triggered: ${failedReasons}`,
    }
  }

  return {
    action: 'release',
    verdict: 'SAME',
    escrowId: attestation.escrowId,
    jobId: attestation.jobId,
    delaySeconds,
    settlement,
    checks,
    reason:
      delaySeconds > 0
        ? `Verified SAME with +${delaySeconds}s SLA delay — releasing ${settlement.payeePayoutUsdc.toFixed(2)} USDC & rebating ${settlement.buyerRebateUsdc.toFixed(2)} USDC via TECD.`
        : `Verified SAME on-time — releasing ${settlement.payeePayoutUsdc.toFixed(2)} USDC (0.50% flat fee).`,
  }
}
