# `@diptos/sdk`

Programmable USDC escrow links, Time-Entropic Collateral Decay (**TECD**) math, **Grok AI** deliverable auditing, and **Gemini Prediction Markets** risk pricing SDK for **Arc Testnet (`Chain ID: 5042002`)**.

Dual **ESM + CJS** bundle with full TypeScript declarations (`.d.ts`) and zero workspace-only dependencies.

---

## Installation

```bash
npm install @diptos/sdk viem
# or
pnpm add @diptos/sdk viem
```

---

## Quickstart 1: Human Consumer Checkout Links

```ts
import { ARC_TESTNET_CONFIG, DiptosClient } from '@diptos/sdk'

const diptos = new DiptosClient({
  rpcUrl: ARC_TESTNET_CONFIG.rpcUrl,
  chainId: ARC_TESTNET_CONFIG.chainId,
  escrowAddress: process.env.DIPTOS_ESCROW_ADDRESS as `0x${string}`,
  registryAddress: process.env.DIPTOS_REGISTRY_ADDRESS as `0x${string}`,
  apiBaseUrl: 'https://diptos.xyz',
})

const { escrow, shareUrl } = await diptos.createEscrowLink({
  title: 'Design System Sprint & React Checkout',
  scope: 'Deliver responsive React components with passing Vite production build',
  amountUsdc: 2500,
  deadlineHours: 72,
  mode: 'human',
})

console.log('Send checkout link to client:', shareUrl, 'ID:', escrow.escrowIdBytes32)
```

---

## Quickstart 2: Autonomous AI Agent USDC Escrow Guardrails (12 Lines)

```ts
import { ARC_TESTNET_CONFIG, DiptosClient } from '@diptos/sdk'

const diptos = new DiptosClient({
  rpcUrl: ARC_TESTNET_CONFIG.rpcUrl,
  escrowAddress: process.env.DIPTOS_ESCROW_ADDRESS as `0x${string}`,
  apiBaseUrl: 'https://diptos.xyz',
})
const risk = await diptos.getLiveGeminiRisk()
const { escrow } = await diptos.createEscrowLink({
  title: 'Audit Solidity TECD invariant bounds',
  scope: 'Merged GitHub PR passing forge test -vvv with zero reverts',
  amountUsdc: 0.05, deadlineHours: 24, mode: 'agent', tecdLambda: risk.recommendedLambda,
})
const fundTx = diptos.buildCreateEscrowTx({ escrowId: escrow.escrowIdBytes32, payee: escrow.payee, amountUsdc: 0.05, deadlineUnix: escrow.deadlineUnix, lambdaBps: escrow.tecdLambdaBps, isAgentMode: true })
const audit = await diptos.verifyDeliverableWithGrok({ escrowId: escrow.escrowIdBytes32, scope: escrow.scope, deliverableUrl: 'https://github.com/Jayram2204/diptos-arc-protocol/pull/1' })
if (audit.approved && audit.eip712Signature) {
  await diptos.settleEscrowOnArc({ escrowId: escrow.escrowIdBytes32, deliverableHash: audit.deliverableHash, nonce: audit.nonce ?? 0, grokSignature: audit.eip712Signature, walletClient })
}
console.log('Funded & settled atomically on Arc:', fundTx.to)
```

---

## API Reference

| Method / Export | Description |
| :--- | :--- |
| `ARC_TESTNET_CONFIG` | Arc Testnet (`5042002`) primary/fallback RPC, ArcScan URL, native (`18`) & ERC-20 (`6`) USDC decimals. |
| `new DiptosClient(config)` | Initializes the typed Arc RPC + Diptos API client. |
| `createEscrowLink(params)` | Originates a stateless escrow intent and returns `escrow`, `txIntent`, `checkoutPath`, and `shareUrl`. |
| `getEscrow(escrowId)` / `listEscrows()` | Reads live on-chain escrow records from Arc Testnet (`DiptosEscrow.sol`). |
| `computeEscrowHash(params)` | Computes canonical `keccak256(abi.encode(...))` commitment matching `DiptosRegistry.sol` byte-for-byte. |
| `calculateTECD(params)` | Evaluates $V(t) = V_0 \cdot e^{-\lambda(\Delta t / T)^{1.5}}$ with `0.5%` protocol fee math locally. |
| `previewTECDOnChain(params)` | Calls `DiptosEscrow.previewTECDPayout` via `eth_call` on Arc Testnet (with WAD fallback). |
| `getLiveGeminiRisk()` | Fetches active Gemini Prediction Markets odds and calibrated TECD `recommendedLambda`. |
| `verifyDeliverableWithGrok(params)` | Audits a GitHub PR / URL via xAI Grok and returns an EIP-712 `ReleaseMilestone` signature. |
| `buildCreateEscrowTx(params)` | Encodes payable `createEscrowLink` calldata + 18-decimal `value` for Arc Testnet. |
| `buildReleaseWithOracleTx(params)` | Encodes `releaseWithOracle` calldata using Grok's EIP-712 attestation. |
| `buildClaimTimeoutRefundTx(params)` | Encodes permissionless `claimTimeoutRefund` calldata after `deadline + 24h`. |
| `getArcTelemetry()` | Fetches live Arc block number, gas price, and RPC round-trip latency. |
| `verifyContractBytecode(address)` | Runs `eth_getCode` against Arc Testnet and returns `{ address, hasCode, byteLength }`. |
| `getCounterpartyReputation(address)` | Reads on-chain reliability telemetry from `DiptosRegistry.getCounterpartyStats`. |

---

## License

MIT — [https://diptos.xyz](https://diptos.xyz)
