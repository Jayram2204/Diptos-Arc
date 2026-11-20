# Diptos — Programmable USDC Escrow & Latency-Aware Settlement on Arc

**Diptos** is a programmable USDC escrow protocol and TypeScript SDK (`@diptos/sdk`) built for **Arc Testnet (`Chain ID: 5042002`)**. It turns non-custodial smart-contract escrow into shareable checkout links (`diptos.xyz/pay/:id`) with automated deliverable auditing, live prediction-market risk calibration, and on-chain **Time-Entropic Collateral Decay (`TECD`)**.

### Active Working Instances
- **Freelancer & Agency Escrow Links:** A client creates a link (`diptos.xyz/pay/:id`) with scope, USDC principal, and SLA deadline, funds it in native Arc USDC, and settles atomically once the deliverable PR or URL passes Grok AI review—with a flat `0.50%` fee and automatic buyer rebates if delivery is late.
- **Autonomous AI Agent Task Guardrails:** An AI agent uses `@diptos/sdk` (`prepareAgentEscrowCalldata`) to query live Gemini Prediction Markets volatility and on-chain `DiptosRegistry` counterparty reliability stats before locking USDC into `DiptosEscrow.sol`.

*Potential* future applications of the same canonical commitment and latency-decay primitives include commercial milestone billing and trade-receivable settlement; those workflows are exploratory and not implemented in this repository.

---

## User & Agent Flow

1. **Compose Escrow Link:** A payer or agent submits title, acceptance scope, USDC amount, and SLA window (`src/site/Hero.tsx` or `POST /api/escrows`), receiving a deterministic `bytes32` escrow ID, pre-encoded `createEscrowLink` calldata, and a shareable `/pay/:id` checkout link calibrated with live Gemini $\lambda$ risk.
2. **Lock Native USDC on Arc:** The payer funds `DiptosEscrow.createEscrowLink` with native 18-decimal Arc USDC (`msg.value`). `DiptosRegistry.recordCommitment` stores the canonical `keccak256` hash to prevent duplicate origination.
3. **Optional Spoken Risk Brief:** Either party requests an executive audio summary via `POST /api/voice/brief`, streaming live `audio/mpeg` from ElevenLabs combining on-chain terms and current Gemini macro odds.
4. **Deliverable Audit & EIP-712 Attestation:** The payee submits a GitHub PR URL, repository URL, or live deployment URL to `POST /api/verify/grok`. The backend fetches real PR diffs/commits or HTTP metadata, evaluates compliance via xAI Grok, hashes the canonical evidence into `bytes32 deliverableHash`, and signs a nonce-bound EIP-712 `ReleaseMilestone` payload.
5. **Atomic DvP & TECD Settlement (or Timeout Refund):** Calling `DiptosEscrow.releaseWithOracle` verifies the EIP-712 signature and settles `99.5%` to the payee if on-time, or computes exponential WAD decay $V(t) = V_0 \cdot e^{-\lambda (\Delta t / T)^{1.5}}$ to rebate the buyer automatically if late. If the payee or oracle stalls past `deadline + gracePeriod`, the payer reclaims `100%` permissionlessly via `claimTimeoutRefund`.

---

## What You Can Verify Yourself

| Claim | Enforced By | Exact Code / Test Reference |
| :--- | :--- | :--- |
| Zero-dust TECD conservation (`payee + rebate + fee == amount`) & monotonic decay | On-chain WAD fixed-point math in `DiptosEscrow.sol` | `contracts/src/DiptosEscrow.sol` (`calculateTECD`) & `contracts/test/DiptosEscrow.t.sol` (`testFuzz_TECDConservationZeroDust`, `testFuzz_TECDDecayMonotonicity` — 256 runs each) |
| Replay protection across chains, milestones, and nonces | On-chain EIP-712 `DOMAIN_SEPARATOR`, per-escrow `nonce`, EIP-2 `s` check | `contracts/src/DiptosEscrow.sol` (`releaseWithOracle`) & `contracts/test/DiptosEscrow.t.sol` (`test_RevertOnSignatureReplay`, `test_RevertOnWrongOracleSigner`) |
| Anti-double-spend canonical commitment ledger | On-chain `escrowIds` + `canonicalHashes` in `DiptosRegistry.sol` | `contracts/src/DiptosRegistry.sol` (`recordCommitment`) & `contracts/test/DiptosEscrow.t.sol` (`test_RevertOnDoubleSpendEscrowId`) |
| Permissionless payer recovery on abandonment | On-chain `claimTimeoutRefund` past `deadline + gracePeriod` | `contracts/src/DiptosEscrow.sol` (`claimTimeoutRefund`) & `contracts/test/DiptosEscrow.t.sol` (`test_PermissionlessTimeoutRefund`, `test_RevertTimeoutRefundBeforeGracePeriod`) |
| On-chain escrow enumeration & counterparty reliability stats | On-chain `getEscrowsPaginated` & `getCounterpartyStats` | `contracts/src/DiptosEscrow.sol` (`getEscrowsPaginated`), `contracts/src/DiptosRegistry.sol` (`getCounterpartyStats`), `contracts/test/DiptosEscrow.t.sol` |
| Live Gemini Prediction Markets $\lambda$ calibration | Off-chain Hono route querying Gemini public REST API | `server/src/routes/riskGemini.ts` (`GET /api/risk/gemini`) |
| Deep GitHub/URL evidence fetch + Grok audit + EIP-712 signing | Off-chain Hono route + `viem` `signTypedData` | `server/src/routes/verifyGrok.ts` & `server/src/lib/oracleSigner.ts` |
| QuickNode HMAC-SHA256 webhook verification + block-ordered logs | Off-chain `timingSafeEqual` + `viem` `getLogs` sorted by `blockNumber` | `server/src/routes/quicknode.ts` (`POST /api/webhooks/quicknode`, `GET /api/events`) |
| ElevenLabs executive audio brief streaming | Off-chain Hono route streaming `audio/mpeg` | `server/src/routes/voiceBrief.ts` (`POST /api/voice/brief`) |

---

## Demonstrated vs. Intended Status

| Component | Status | Code & Test Evidence | Residual Trust / Remaining Work |
| :--- | :--- | :--- | :--- |
| **Smart Contracts (`DiptosEscrow` + `DiptosRegistry`)** | **Demonstrated** (Foundry) / **Intended** (Live Arc Broadcast) | 15/15 unit & fuzz tests pass (`forge test -vvv`) | Broadcast `contracts/script/DeployArc.s.sol` with a funded Arc Testnet key and update `VITE_ESCROW_CONTRACT_ADDRESS` & `VITE_REGISTRY_CONTRACT_ADDRESS`. |
| **Consumer Checkout & Live UI (`src/`)** | **Demonstrated** | `pnpm build:all` passes; Lenis smooth scroll, SVG TECD simulator, live Arc RPC telemetry | Requires live contract addresses and Vercel env vars for end-to-end mainnet-like settlement. |
| **Stateless Serverless API (`server/` + `api/[[...route]].ts`)** | **Demonstrated** | Deployed on Vercel Functions; zero `fs.writeFileSync` state storage | Requires `XAI_API_KEY`, `GROK_ORACLE_PRIVATE_KEY`, `ELEVENLABS_API_KEY`, and `QUICKNODE_WEBHOOK_SECRET` in Vercel settings. |
| **`@diptos/sdk` (`packages/sdk/`)** | **Demonstrated** (ESM + `.d.ts`) | `pnpm --filter @diptos/sdk pack --dry-run` passes with zero `workspace:*` leaks | Add CJS (`dist/index.cjs`) build target and `"files"` allowlist before publishing to npm. |
| **Broader Commercial / Invoice Workflows** | **Potential** | N/A | Exploratory extension of canonical hash + TECD primitives; not built in this repo. |

---

## Architecture

```mermaid
flowchart TB
  subgraph Client["Client & SDK (Browser / AI Agent)"]
    UI["diptos.xyz Web UI (src/)"]
    SDK["@diptos/sdk (packages/sdk/)"]
  end

  subgraph OffChain["Off-Chain Serverless API (Vercel Functions: api/[[...route]].ts -> server/)"]
    EscrowAPI["/api/escrows & /api/agent/quote-and-verify"]
    GeminiAPI["/api/risk/gemini -> api.gemini.com"]
    GrokAPI["/api/verify/grok -> GitHub/URL + api.x.ai + EIP-712 Signer"]
    VoiceAPI["/api/voice/brief -> api.elevenlabs.io (audio/mpeg)"]
    EventsAPI["/api/events & /api/webhooks/quicknode (HMAC-SHA256)"]
  end

  subgraph OnChain["On-Chain Arc Testnet (Chain ID: 5042002, Native 18-dec USDC)"]
    EscrowSol["DiptosEscrow.sol (Custody, EIP-712 Verify, WAD TECD, Timeout Refund)"]
    RegistrySol["DiptosRegistry.sol (Canonical Hash Anti-Double-Spend, Counterparty Stats)"]
  end

  UI --> EscrowAPI
  SDK --> EscrowAPI
  EscrowAPI --> GeminiAPI
  EscrowAPI -.->|readContract: getEscrowsPaginated / getCounterpartyStats| EscrowSol
  EscrowAPI -.->|readContract: getCounterpartyStats| RegistrySol
  UI -->|1. Fund Native USDC (createEscrowLink)| EscrowSol
  UI -->|2. Audio Brief| VoiceAPI
  UI -->|3. Submit Deliverable URL| GrokAPI
  GrokAPI -->|EIP-712 ReleaseMilestone Sig| UI
  UI -->|4. Settle On-Chain (releaseWithOracle)| EscrowSol
  EscrowSol -->|recordCommitment & recordSettlement| RegistrySol
  EscrowSol -->|Logs / QuickNode Streams| EventsAPI
```

---

## Local Development & Verification

```bash
pnpm install
cp .env.example .env
pnpm dev
```

`pnpm dev` starts the Vite client and Hono API server locally with API requests proxied automatically. To run the full smart-contract and workspace verification suite:

```bash
cd contracts && forge test -vvv
pnpm build:all
```

---

## Durable Links

- **Live Web App:** https://diptos.xyz
- **Verification & Evidence Log:** [docs/EVIDENCE.md](docs/EVIDENCE.md)
- **TypeScript SDK Documentation:** [packages/sdk/README.md](packages/sdk/README.md)
- **Arc Testnet Explorer:** https://testnet.arcscan.app
- **ArcUSDC Precompile:** https://testnet.arcscan.app/address/0x3600000000000000000000000000000000000000

---

## Known Limitations & Trust Assumptions

1. **Off-Chain Auditing vs. On-Chain Enforcement:** Grok deliverable auditing (`server/src/routes/verifyGrok.ts`) and Gemini risk fetching (`server/src/routes/riskGemini.ts`) execute off-chain on the application server. Fund custody, TECD decay math, EIP-712 signature verification, anti-double-spend checks, and permissionless timeout refunds are enforced on-chain by `DiptosEscrow.sol` and `DiptosRegistry.sol`.
2. **Oracle Key Authorization Scope:** A valid EIP-712 signature proves authorization by the configured `GROK_ORACLE_SIGNER` key, not cryptographic proof of off-chain deliverable truth. If the oracle or payee stalls past `deadline + gracePeriod`, payers retain permissionless recovery of `100%` of locked funds via `claimTimeoutRefund`.
3. **Arc Testnet Broadcast Pending:** Until `contracts/script/DeployArc.s.sol` is broadcast with a funded Arc Testnet key, `src/config/protocol.ts` falls back to placeholder EIP-55 addresses and `Registry.tsx` reports `DEPLOYARC.S.SOL READY` via live `eth_getCode`.
4. **Serverless Webhook Ephemerality:** QuickNode webhook pushes stored in the in-memory `webhookBuffer` reset on Vercel serverless cold starts; `GET /api/events` compensates by querying authoritative `viem` `getLogs` directly from Arc Testnet ordered by `blockNumber` descending.
5. **Unaudited Testnet Software:** Smart contracts have not undergone an independent third-party security audit and are intended for Arc Testnet demonstration only.
