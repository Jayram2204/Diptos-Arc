# `@diptos/sdk`

Zero-dependency (uses `viem`) TypeScript SDK for **Diptos** programmable USDC escrow links and autonomous AI agent payment guardrails on **Arc Testnet (`Chain ID: 5042002`)**.

## 10-Line Autonomous AI Agent Guardrail Example

```ts
import { createDiptosClient } from '@diptos/sdk'

const diptos = createDiptosClient({ apiBaseUrl: 'http://localhost:4000', escrowContract: process.env.ESCROW_ADDR as `0x${string}` })
const risk = await diptos.getLiveGeminiRisk()
const { escrow, shareUrl } = await diptos.createEscrowLink({
  title: 'Audit Solidity TECD math', scope: 'Submit PR passing forge test with zero reverts',
  amountUsdc: 250, deadlineHours: 24, mode: 'agent', tecdLambda: risk.recommendedLambda,
})
const audit = await diptos.verifyDeliverableWithGrok({ escrowId: escrow.id, deliverableUrl: 'https://github.com/org/repo/pull/12' })
if (audit.approved) await diptos.settleEscrowOnArc({ escrowId: escrow.id, grokSignature: audit.signature, deliverableHash: audit.deliverableHash, walletClient })
console.log('Settled via', shareUrl)
```

## Methods

- `client.createEscrowLink(params)` — Creates a shareable `diptos.xyz/pay/:id` escrow link with TECD SLA parameters.
- `client.getLiveGeminiRisk()` — Reads live Gemini Prediction Markets odds to calibrate TECD decay `lambda`.
- `client.verifyDeliverableWithGrok(params)` — Audits a GitHub PR or deliverable via xAI Grok and returns an ECDSA oracle release signature.
- `client.settleEscrowOnArc(params)` — Executes `DiptosEscrow.releaseWithOracle(...)` atomically on Arc Testnet (`5042002`).
