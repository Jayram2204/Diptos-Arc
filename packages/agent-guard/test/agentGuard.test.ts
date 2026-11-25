import assert from 'node:assert/strict'
import test from 'node:test'
import {
  appendBaseBuilderCode,
  calculateTecdSettlement,
  createDiptosX402Client,
  lintDeliverableScope,
  PolicyGuard,
  toRailUsdcUnits,
  verifyComputeSlaAttestation,
  withDiptosGuard,
} from '../src/index.js'

test('PolicyGuard enforces maxPerTaskUsdc, dailyBudgetUsdc, allowedProviders, maxLatencySeconds, and approvalThresholdUsdc', () => {
  const guard = new PolicyGuard({
    maxPerTaskUsdc: 50,
    dailyBudgetUsdc: 100,
    approvalThresholdUsdc: 25,
    allowedProviders: ['api.diptos.xyz', 'compute.arc.io'],
    maxLatencySeconds: 3600,
  })

  // Allowed quote
  const ok = guard.evaluateQuote({
    agentId: 'agent-alpha',
    provider: 'https://api.diptos.xyz/v1/audit',
    amountUsdc: 20,
    estimatedLatencySeconds: 600,
  })
  assert.equal(ok.allowed, true)
  assert.equal(ok.decision, 'approve')

  // Exceeds approvalThresholdUsdc -> requires human sign-off
  const needsHuman = guard.evaluateQuote({
    agentId: 'agent-alpha',
    provider: 'api.diptos.xyz',
    amountUsdc: 40,
    estimatedLatencySeconds: 600,
  })
  assert.equal(needsHuman.allowed, false)
  assert.equal(needsHuman.decision, 'require_human_approval')

  // Exceeds maxPerTaskUsdc -> denied
  const tooBig = guard.evaluateQuote({
    agentId: 'agent-alpha',
    provider: 'api.diptos.xyz',
    amountUsdc: 75,
    estimatedLatencySeconds: 600,
  })
  assert.equal(tooBig.allowed, false)
  assert.equal(tooBig.decision, 'deny')

  // Unapproved provider -> denied
  const badProvider = guard.evaluateQuote({
    agentId: 'agent-alpha',
    provider: 'evil.example.com',
    amountUsdc: 10,
    estimatedLatencySeconds: 600,
  })
  assert.equal(badProvider.allowed, false)
  assert.equal(badProvider.decision, 'deny')

  // Exceeds latency bound -> denied
  const tooSlow = guard.evaluateQuote({
    agentId: 'agent-alpha',
    provider: 'compute.arc.io',
    amountUsdc: 10,
    estimatedLatencySeconds: 7200,
  })
  assert.equal(tooSlow.allowed, false)
  assert.equal(tooSlow.decision, 'deny')
})

test('PolicyGuard enforces Parent-to-Sub-Agent DAG budgets and prevents cap overflow', () => {
  const guard = new PolicyGuard({
    maxPerTaskUsdc: 100,
    dailyBudgetUsdc: 100,
    approvalThresholdUsdc: 100,
    allowedProviders: ['compute.arc.io'],
    maxLatencySeconds: 3600,
  })

  guard.allocateSubBudget('agent-parent', 'sub-agent-b', 40)
  guard.allocateSubBudget('agent-parent', 'compute-node-c', 30)

  // Over-allocating beyond parent budget throws
  assert.throws(() => guard.allocateSubBudget('agent-parent', 'sub-agent-d', 35), /DAG budget overflow/)

  // Sub-agent B spends 25 USDC (within 40 cap)
  const q1 = guard.evaluateQuote({
    agentId: 'sub-agent-b',
    provider: 'compute.arc.io',
    amountUsdc: 25,
    estimatedLatencySeconds: 300,
  })
  assert.equal(q1.allowed, true)
  guard.recordSpend('sub-agent-b', 25)
  assert.equal(guard.getSubAgentRemainingUsdc('sub-agent-b'), 15)

  // Sub-agent B trying 20 USDC more -> denied (only 15 remaining)
  const q2 = guard.evaluateQuote({
    agentId: 'sub-agent-b',
    provider: 'compute.arc.io',
    amountUsdc: 20,
    estimatedLatencySeconds: 300,
  })
  assert.equal(q2.allowed, false)
  assert.equal(q2.decision, 'deny')
})

test('withDiptosGuard automatically refunds escrow & restores budget on output schema failure', async () => {
  const guard = new PolicyGuard({
    maxPerTaskUsdc: 50,
    dailyBudgetUsdc: 100,
    approvalThresholdUsdc: 50,
    allowedProviders: ['api.diptos.xyz'],
    maxLatencySeconds: 3600,
  })

  let refunded = false
  let settled = false

  const client = createDiptosX402Client({
    policy: guard,
    lockEscrow: async (q) => ({ escrowId: q.escrowId, locked: true }),
    settleEscrow: async () => {
      settled = true
      return { txHash: '0xsettle' }
    },
    refundEscrow: async () => {
      refunded = true
      return { txHash: '0xrefund' }
    },
  })

  const res = await withDiptosGuard(
    client,
    {
      escrowId: 'esc_schema_fail',
      agentId: 'agent-1',
      provider: 'api.diptos.xyz',
      payee: '0x2222222222222222222222222222222222222222',
      amountUsdc: 15,
      slaWindowSeconds: 3600,
      lambda: 0.5,
      chain: 'arc-5042002',
    },
    { requiredKeys: ['reportHash', 'findings'] },
    async () => ({ reportHash: '0xabc' }), // missing 'findings'
  )

  assert.equal(res.status, 'refunded')
  assert.equal(refunded, true)
  assert.equal(settled, false)
  assert.equal(guard.getRemainingDailyBudgetUsdc(), 100)
})

test('TECD latency rebate calculation preserves zero-dust conservation on-time and late', () => {
  const onTime = calculateTecdSettlement({
    principalUsdc: 1000,
    lambda: 0.5,
    delaySeconds: 0,
    slaWindowSeconds: 86400,
  })
  assert.equal(onTime.buyerRebateUsdc, 0)
  assert.equal(onTime.protocolFeeUsdc, 5)
  assert.equal(onTime.payeePayoutUsdc, 995)
  assert.equal(
    Number((onTime.payeePayoutUsdc + onTime.buyerRebateUsdc + onTime.protocolFeeUsdc).toFixed(6)),
    1000,
  )

  const late = calculateTecdSettlement({
    principalUsdc: 5000,
    lambda: 0.5,
    delaySeconds: 12 * 3600,
    slaWindowSeconds: 24 * 3600,
  })
  assert.ok(late.buyerRebateUsdc > 0, 'Late delivery must trigger automatic buyer rebate')
  assert.ok(late.decayPercent > 0, 'Decay percent must be positive')
  assert.equal(
    Number((late.payeePayoutUsdc + late.buyerRebateUsdc + late.protocolFeeUsdc).toFixed(6)),
    5000,
  )
})

test('Distributed Compute SLA Adapter releases on AntSeed SAME and auto-refunds on DIFF', () => {
  const validSha = 'c'.repeat(64)

  const sameRes = verifyComputeSlaAttestation({
    jobId: 'antseed-job-101',
    escrowId: 'esc_compute_1',
    provider: 'antseed',
    principalUsdc: 100,
    lambda: 0.5,
    slaWindowSeconds: 3600,
    elapsedSeconds: 1800,
    outputSha256: validSha,
    expectedOutputSha256: validSha,
    outputPayload: { tokens: 1024, sha256: validSha },
    outputSchema: { requiredKeys: ['tokens', 'sha256'] },
    modelVerification: {
      verdict: 'SAME',
      ipfsCid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
      onChainProofHash: '0x' + 'd'.repeat(64),
      verifierName: 'AntSeed Model Verifier',
    },
  })
  assert.equal(sameRes.action, 'release')
  assert.equal(sameRes.verdict, 'SAME')
  assert.equal(sameRes.settlement.payeePayoutUsdc, 99.5)

  const diffRes = verifyComputeSlaAttestation({
    jobId: 'antseed-job-102',
    escrowId: 'esc_compute_2',
    provider: 'antseed',
    principalUsdc: 100,
    lambda: 0.5,
    slaWindowSeconds: 3600,
    elapsedSeconds: 1200,
    outputSha256: validSha,
    modelVerification: {
      verdict: 'DIFF',
      ipfsCid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
      onChainProofHash: '0x' + 'e'.repeat(64),
      verifierName: 'AntSeed Model Verifier',
    },
  })
  assert.equal(diffRes.action, 'refund')
  assert.equal(diffRes.settlement.buyerRebateUsdc, 100)
  assert.equal(diffRes.settlement.payeePayoutUsdc, 0)
})

test('Dual-Rail USDC units and Base Builder Code attribution suffix work cleanly', () => {
  assert.equal(toRailUsdcUnits(10, 'arc-testnet'), 10n * 10n ** 18n)
  assert.equal(toRailUsdcUnits(10, 'base-mainnet'), 10n * 10n ** 6n)

  const baseCall = appendBaseBuilderCode('0xdeadbeef', 'base-mainnet', 'diptos-v1')
  assert.ok(baseCall.startsWith('0xdeadbeef6263'))
  const arcCall = appendBaseBuilderCode('0xdeadbeef', 'arc-testnet', 'diptos-v1')
  assert.equal(arcCall, '0xdeadbeef')
})

test('Local AI pre-submission scopeLinter skips gracefully when LOCAL_AI_ENDPOINT is unset', async () => {
  const prev = process.env.LOCAL_AI_ENDPOINT
  delete process.env.LOCAL_AI_ENDPOINT
  const res = await lintDeliverableScope({
    acceptanceScope: 'Ship audited smart contract',
    deliverableSummary: 'PR merged with 30 passing Foundry tests',
  })
  if (prev !== undefined) process.env.LOCAL_AI_ENDPOINT = prev
  assert.equal(res.advisoryOnly, true)
  assert.equal(res.skipped, true)
})
