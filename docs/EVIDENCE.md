# Diptos Protocol — Verification & Evidence Log

Repository: https://github.com/Jayram2204/Diptos-Arc

This document records reproducible build, test, and architectural evidence for **Diptos** on **Arc Testnet (`Chain ID: 5042002`)**.

---

## 1. Arc Testnet (`5042002`) Contract Addresses & Deployment Status

| Contract | File | Configured Address (`src/config/protocol.ts`) | Status | Explorer Link |
| :--- | :--- | :--- | :--- | :--- |
| **ArcUSDC** | Precompile | `0x3600000000000000000000000000000000000000` | Live Arc Testnet native USDC interface | https://testnet.arcscan.app/address/0x3600000000000000000000000000000000000000 |
| **DiptosEscrow** | `contracts/src/DiptosEscrow.sol` | `VITE_ESCROW_CONTRACT_ADDRESS` (default fallback `0x742d35Cc6634C0532925a3b844Bc454e4438f44e`) | Compiled & tested (15/15 Foundry tests); **awaiting live Arc broadcast via `DeployArc.s.sol`** | https://testnet.arcscan.app |
| **DiptosRegistry** | `contracts/src/DiptosRegistry.sol` | `VITE_REGISTRY_CONTRACT_ADDRESS` (default fallback `0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed`) | Compiled & tested (15/15 Foundry tests); **awaiting live Arc broadcast via `DeployArc.s.sol`** | https://testnet.arcscan.app |

> **Disclosure:** The fallback addresses in `src/config/protocol.ts` and `.env.example` are placeholder EIP-55 addresses used until `contracts/script/DeployArc.s.sol` is broadcast with a funded Arc Testnet `DEPLOYER_PRIVATE_KEY`. `src/site/Registry.tsx` queries `eth_getCode` live and displays `DEPLOYARC.S.SOL READY` whenever a target address has 0 bytes of deployed code.

### Broadcast Command (Arc Testnet)
```bash
cd contracts && forge script script/DeployArc.s.sol:DeployArc \
  --rpc-url https://rpc.testnet.arc.network \
  --broadcast
```

---

## 2. Exact Reproduction Commands & Observed Outputs

### A. Smart Contract Unit & Fuzz Suite (`contracts/`)
Command:
```bash
cd contracts && forge test -vvv
```
Observed output (Solc `0.8.24`, `via_ir = true`, optimizer `200` runs):
```text
Ran 15 tests for test/DiptosEscrow.t.sol:DiptosEscrowTest
[PASS] testFuzz_TECDConservationZeroDust(uint256,uint256,uint256) (runs: 256, μ: 19409, ~: 19677)
[PASS] testFuzz_TECDDecayMonotonicity(uint256,uint256) (runs: 256, μ: 36043, ~: 35242)
[PASS] test_CounterpartyReputationTelemetryOnRegistry() (gas: 1311814)
[PASS] test_FaucetMintAndCooldown() (gas: 64023)
[PASS] test_LateReleaseTECDDecayAndConservation() (gas: 829404)
[PASS] test_MultiMilestonePartialAndFullSettlement() (gas: 898406)
[PASS] test_MutualCancellationByPayee() (gas: 544634)
[PASS] test_OnChainEnumerationAndPagination() (gas: 1391700)
[PASS] test_PermissionlessTimeoutRefund() (gas: 545865)
[PASS] test_PreviewTECDPayoutAndDualDecimals() (gas: 25136)
[PASS] test_RevertOnDoubleSpendEscrowId() (gas: 544291)
[PASS] test_RevertOnSignatureReplay() (gas: 816757)
[PASS] test_RevertOnWrongOracleSigner() (gas: 545988)
[PASS] test_RevertTimeoutRefundBeforeGracePeriod() (gas: 535952)
[PASS] test_SingleShotOnTimeRelease() (gas: 747856)
Suite result: ok. 15 passed; 0 failed; 0 skipped
```

### B. Full Workspace Typecheck & Production Bundle
Command:
```bash
pnpm build:all
```
Observed output:
```text
> pnpm --filter @diptos/sdk build && tsc --noEmit && tsc -p server/tsconfig.json --noEmit && vite build
✓ 2533 modules transformed.
✓ built in 277ms
```

### C. `@diptos/sdk` Package Verification
Command:
```bash
pnpm --filter @diptos/sdk pack --dry-run
```
Observed output:
```text
@diptos/sdk@1.0.0
Tarball Contents:
dist/index.cjs
dist/index.cjs.map
dist/index.d.cts
dist/index.d.ts
dist/index.js
dist/index.js.map
LICENSE
package.json
README.md
```
- `packages/sdk/package.json` contains zero `workspace:*` specifiers (`peerDependencies: { "viem": "^2.0.0" }`).
- Built via `tsup` (`packages/sdk/tsup.config.ts`) emitting dual ESM (`dist/index.js`), CJS (`dist/index.cjs`), and TypeScript declarations (`dist/index.d.ts`, `dist/index.d.cts`) with `"files": ["dist", "README.md"]`.

---

## 3. On-Chain vs. Off-Chain Trust Boundary

| Function | Execution Layer | Enforcement Mechanism | Residual Trust Assumption |
| :--- | :--- | :--- | :--- |
| **Native USDC Custody** | On-chain (`DiptosEscrow.sol`) | Non-custodial `msg.value` lock | Smart contract correctness (unaudited testnet code) |
| **Anti-Double-Spend** | On-chain (`DiptosRegistry.sol`) | `escrowIds` + `canonicalHashes` revert `CommitmentAlreadyExists()` | None beyond Arc EVM consensus |
| **TECD Decay & Conservation** | On-chain (`DiptosEscrow.sol`) | Fixed-point WAD `calculateTECD` (256-run fuzz verified, 0 wei dust) | `lambdaBps` parameter is supplied at escrow creation time |
| **Deliverable Auditing** | Off-chain (`server/src/routes/verifyGrok.ts`) | GitHub/URL fetch + xAI Grok API + EIP-712 `signTypedData` | Signature proves authorization by `GROK_ORACLE_SIGNER`, not cryptographic proof of off-chain truth |
| **Macro Risk Calibration** | Off-chain (`server/src/routes/riskGemini.ts`) | Live `GET https://api.gemini.com/v1/prediction-markets/events?status=active&limit=6` | Passed into `createEscrowLink` off-chain; not an on-chain price oracle |
| **Stall / Abandonment Recovery** | On-chain (`DiptosEscrow.sol`) | Permissionless `claimTimeoutRefund(escrowId)` after `deadline + gracePeriod` | Payer can always recover 100% if payee or oracle stalls |
| **Voice Deal Briefs** | Off-chain (`server/src/routes/voiceBrief.ts`) | Live ElevenLabs TTS (`audio/mpeg`) | Informational audio only; does not alter contract state |
| **Event Indexing** | Off-chain (`server/src/routes/quicknode.ts`) | HMAC-SHA256 `x-qn-signature` + stateless `viem` `getLogs` ordered by `blockNumber` | In-memory webhook buffer resets on serverless cold starts; `getLogs` remains authoritative |
