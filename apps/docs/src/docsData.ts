import { ESCROW_CONTRACT_ADDRESS, REGISTRY_CONTRACT_ADDRESS } from '@/config/protocol'

export interface DocCallout {
  tone: 'note' | 'warning'
  title: string
  body: string
}

export interface DocCodeBlock {
  filename?: string
  language: string
  code: string
  variants?: {
    typescript?: string
    curl?: string
    solidity?: string
  }
}

export interface DocTable {
  headers: string[]
  rows: string[][]
}

export interface DocSection {
  id: string
  heading: string
  paragraphs?: string[]
  bullets?: string[]
  callout?: DocCallout
  code?: DocCodeBlock
  table?: DocTable
  diagram?: 'tecd-curve' | 'trust-boundaries'
  playground?: boolean
}

export interface DocPage {
  id: string
  group: 'Getting Started' | 'Protocol Specification' | 'Oracles & Verification' | 'Reference'
  title: string
  description: string
  sections: DocSection[]
}

export const DOC_GROUPS: DocPage['group'][] = [
  'Getting Started',
  'Protocol Specification',
  'Oracles & Verification',
  'Reference',
]

export const DOC_PAGES: DocPage[] = [
  {
    id: 'introduction',
    group: 'Getting Started',
    title: 'Introduction',
    description:
      'Diptos is a non-custodial Condition-Verified USDC Settlement protocol built for Arc Native USDC (18-dec) and Base ERC-20 USDC (6-dec) + x402 autonomous AI agents.',
    sections: [
      {
        id: 'what-is-diptos',
        heading: 'What is Diptos?',
        paragraphs: [
          'Traditional freelance marketplaces charge 10–15% take rates and resolve late delivery with binary, subjective disputes. On-chain escrows solve custody, but still freeze funds in all-or-nothing multisigs.',
          'Diptos replaces binary disputes with continuous Time-Entropic Collateral Decay (TECD) and hardware-pinned deterministic proof—releasing 99.5% instantly on time, or rebating the buyer mathematically if delivery is late.',
        ],
      },
      {
        id: 'execution-surfaces',
        heading: 'Execution Surfaces',
        table: {
          headers: ['Surface', 'Domain / Package', 'Primary Audience', 'Capabilities'],
          rows: [
            [
              'Settlement Engine',
              'app.diptos.xyz',
              'Freelancers, DAOs, AI teams',
              'Create protection links, lock native USDC, inspect SLA countdowns, verify proof, settle or recover.',
            ],
            [
              'TypeScript SDK',
              '@diptos/sdk',
              'Apps & autonomous AI agents',
              'Build unsigned viem transactions, compute on-chain TECD payouts, query Arc telemetry.',
            ],
            [
              'Dipto Agent Guardrails',
              'agent.diptos.xyz / @diptos/agent-guard',
              'AI Agent & x402 Builders',
              'PolicyGuard spend caps, DAG sub-agent budgets, proof-gated x402, AntSeed compute SLA adapter.',
            ],
          ],
        },
      },
    ],
  },
  {
    id: 'quickstart',
    group: 'Getting Started',
    title: 'Quickstart: Arc Native USDC (18-dec)',
    description:
      'Install @diptos/sdk, query live Arc Testnet (5042002) telemetry, and lock native 18-decimal USDC in DiptosEscrow.sol in one transaction.',
    sections: [
      {
        id: 'install-package',
        heading: '1. Install @diptos/sdk',
        paragraphs: [
          'Diptos ships dual ESM/CJS bundles with full TypeScript definitions and uses viem v2 as its sole peer dependency.',
        ],
        code: {
          filename: 'terminal',
          language: 'bash',
          code: `pnpm add @diptos/sdk viem`,
        },
      },
      {
        id: 'arc-fund-escrow',
        heading: '2. Lock Native 18-Decimal USDC on Arc',
        paragraphs: [
          'On Arc Testnet (5042002), USDC is the native 18-decimal gas currency. Lock principal directly via msg.value without a separate ERC-20 approve() transaction.',
        ],
        code: {
          filename: 'arc-escrow.ts',
          language: 'typescript',
          code: `import { DiptosClient } from '@diptos/sdk'
import { keccak256, toHex } from 'viem'

const diptos = new DiptosClient({
  rpcUrl: 'https://rpc.testnet.arc.network',
  apiBaseUrl: 'https://diptos.xyz',
  escrowContract: '${ESCROW_CONTRACT_ADDRESS}',
  registryContract: '${REGISTRY_CONTRACT_ADDRESS}',
})

const escrowId = keccak256(toHex('diptos:arc:5042002:deliverable-001'))
const tx = diptos.buildFundEscrowTx({
  escrowId,
  payee: '0x000000000000000000000000000000000000dEaD',
  amountUsdc: 250,
  deadlineUnix: Math.floor(Date.now() / 1000) + 86_400,
  lambdaBps: 5000, // Standard Milestone λ = 0.50
  isAgentMode: false,
})

const txHash = await walletClient.sendTransaction(tx)`,
          variants: {
            typescript: `import { DiptosClient } from '@diptos/sdk'
import { keccak256, toHex } from 'viem'

const diptos = new DiptosClient({
  rpcUrl: 'https://rpc.testnet.arc.network',
  apiBaseUrl: 'https://diptos.xyz',
  escrowContract: '${ESCROW_CONTRACT_ADDRESS}',
  registryContract: '${REGISTRY_CONTRACT_ADDRESS}',
})

const escrowId = keccak256(toHex('diptos:arc:5042002:deliverable-001'))
const tx = diptos.buildFundEscrowTx({
  escrowId,
  payee: '0x000000000000000000000000000000000000dEaD',
  amountUsdc: 250,
  deadlineUnix: Math.floor(Date.now() / 1000) + 86_400,
  lambdaBps: 5000, // Standard Milestone λ = 0.50
  isAgentMode: false,
})

const txHash = await walletClient.sendTransaction(tx)`,
            curl: `curl -X POST https://rpc.testnet.arc.network \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "eth_call",
    "params": [{
      "to": "${ESCROW_CONTRACT_ADDRESS}",
      "data": "0x27d1c87a"
    }, "latest"]
  }'`,
            solidity: `// Direct native 18-dec USDC deposit on Arc Testnet (5042002)
IDiptosEscrow(${ESCROW_CONTRACT_ADDRESS}).createEscrowLink{ value: 250 ether }(
    keccak256("diptos:arc:5042002:deliverable-001"),
    payeeAddress,
    block.timestamp + 24 hours,
    5000, // λ = 0.50
    false,
    "Smart Contract Audit",
    "All Foundry unit & fuzz tests pass in PR"
);`,
          },
        },
      },
    ],
  },
  {
    id: 'base-x402-quickstart',
    group: 'Getting Started',
    title: 'Quickstart: Base USDC (6-dec) + x402',
    description:
      'Protect autonomous AI agent budgets on Base (Chain ID 8453) using 6-decimal ERC-20 USDC, HTTP 402 conditional verification (@diptos/agent-guard), and Base Builder Codes attribution.',
    sections: [
      {
        id: 'base-erc20-flow',
        heading: '1. Base 6-Decimal ERC-20 USDC + Base Builder Code',
        paragraphs: [
          'On Base (Chain ID 8453), USDC is a 6-decimal ERC-20 token (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913). Append ERC-8021 Base Builder Code calldata suffix for on-chain attribution.',
        ],
        code: {
          filename: 'base-x402-guard.ts',
          language: 'typescript',
          code: `import { parseUnits, concatHex, toHex } from 'viem'

const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const BASE_BUILDER_CODE = toHex('diptos_base_v1')

// 1. Agent intercepts HTTP 402 Payment Required with conditional proof header
const res = await fetch('https://api.agent-provider.xyz/v1/generate', {
  method: 'POST',
  headers: {
    'X-Diptos-Rail': 'base-8453',
    'X-Agent-Budget-Cap': parseUnits('50', 6).toString(), // 50.00 USDC (6 dec)
    'X-Base-Builder-Code': BASE_BUILDER_CODE,
  },
})

if (res.status === 402) {
  const challenge = await res.json()
  // challenge = { escrowId, amountUsdc6: "25000000", proofSchema: "json-schema-v1" }
  console.log('Locking conditional x402 escrow on Base:', challenge.escrowId)
}`,
          variants: {
            typescript: `import { parseUnits, toHex } from 'viem'

const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const BASE_BUILDER_CODE = toHex('diptos_base_v1')

// Agent intercepts HTTP 402 Payment Required with conditional proof header
const res = await fetch('https://api.agent-provider.xyz/v1/generate', {
  method: 'POST',
  headers: {
    'X-Diptos-Rail': 'base-8453',
    'X-Agent-Budget-Cap': parseUnits('50', 6).toString(), // 50.00 USDC (6 dec)
    'X-Base-Builder-Code': BASE_BUILDER_CODE,
  },
})

if (res.status === 402) {
  const challenge = await res.json()
  console.log('Locking conditional x402 escrow on Base:', challenge.escrowId)
}`,
            curl: `# Request x402 conditional settlement challenge on Base (6-dec USDC)
curl -i -X POST https://diptos.xyz/api/agent/guardrail \\
  -H "Content-Type: application/json" \\
  -H "X-Diptos-Rail: base-8453" \\
  -d '{
    "agentAddress": "0x000000000000000000000000000000000000dEaD",
    "maxBudgetUsdc": 50,
    "slaWindowSeconds": 1800,
    "baseBuilderCode": "diptos_base_v1"
  }'

# Example 402 Response Payload:
# {
#   "status": 402,
#   "rail": "base-8453",
#   "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
#   "decimals": 6,
#   "amountAtomic": "25000000",
#   "proofGate": "deterministic-eip712"
# }`,
            solidity: `// Base 6-dec ERC-20 USDC approval + conditional lock
IERC20(0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913).approve(
    baseEscrowAddress,
    25_000_000 // 25.00 USDC (6 decimals)
);`,
          },
        },
        callout: {
          tone: 'note',
          title: 'Arc 18-dec vs. Base 6-dec Precision',
          body: 'Arc Testnet native USDC uses 18 decimals (msg.value), whereas Base ERC-20 USDC uses 6 decimals. @diptos/sdk exports nativeUsdcTo6Decimals() and usdc6ToNativeWei() to keep cross-chain accounting exact.',
        },
      },
    ],
  },
  {
    id: 'tecd-math',
    group: 'Protocol Specification',
    title: 'TECD Decay Math & Live Playground',
    description:
      'Continuous Time-Entropic Collateral Decay replaces binary late-delivery disputes with deterministic fixed-point WAD math verified live via Arc Testnet eth_call.',
    sections: [
      {
        id: 'formula-diagram',
        heading: 'Continuous Decay Curve',
        paragraphs: [
          'On-time proof (Δt = 0) settles 99.5% to the payee and 0.5% flat protocol fee. Late delivery decays smoothly via V(t) = V₀ · e^(−λ · (Δt/T)^1.5), returning the exact decayed balance to the buyer atomically.',
        ],
        diagram: 'tecd-curve',
      },
      {
        id: 'live-playground',
        heading: 'Live RPC & TECD Playground (Arc 5042002)',
        paragraphs: [
          'Execute a real read-only eth_call against DiptosEscrow.previewTECDPayout() on Arc Testnet (5042002) right from this page.',
        ],
        playground: true,
      },
    ],
  },
  {
    id: 'security',
    group: 'Protocol Specification',
    title: 'Zero-Key Trust Boundaries',
    description:
      'Non-custodial custody invariants, hardware-pinned verification scope, and permissionless timeout recovery.',
    sections: [
      {
        id: 'trust-diagram',
        heading: 'Trust Boundary Architecture',
        paragraphs: [
          'Neither the frontend nor the verification API ever holds user private keys or custody of funds. Payers retain unilateral permissionless timeout refund rights if delivery stalls.',
        ],
        diagram: 'trust-boundaries',
      },
      {
        id: 'boundaries',
        heading: 'Core Security Invariants',
        bullets: [
          'Zero Platform Custody: USDC stays inside DiptosEscrow.sol until on-chain settlement or permissionless timeout refund.',
          'Single-Use EIP-712 Nonces: Every cryptographic release digest binds strictly to DiptosEscrow.nonces(escrowId) to prevent replay.',
          'HttpOnly SIWE Sessions: Optional sign-in uses server-issued HttpOnly, Secure, SameSite=Lax cookies (diptos_sid) with zero key material in cookies or localStorage.',
        ],
      },
    ],
  },
  {
    id: 'sdk-api',
    group: 'Reference',
    title: 'DiptosClient API & Contracts',
    description: 'Complete method reference and verified Arc Testnet (5042002) contract addresses.',
    sections: [
      {
        id: 'arc-addresses',
        heading: 'Verified Arc Testnet Contracts (5042002)',
        table: {
          headers: ['Contract', 'Address', 'Status'],
          rows: [
            ['DiptosEscrow.sol', ESCROW_CONTRACT_ADDRESS, 'Live (13,245 bytes bytecode, Block #73188305)'],
            ['DiptosRegistry.sol', REGISTRY_CONTRACT_ADDRESS, 'Live (1,757 bytes bytecode, Block #73188305)'],
            ['ArcUSDC Precompile', '0x3600000000000000000000000000000000000000', 'Native Arc Testnet USDC'],
          ],
        },
      },
      {
        id: 'methods',
        heading: 'SDK Methods',
        table: {
          headers: ['Method', 'Returns', 'Description'],
          rows: [
            ['getArcTelemetry()', 'Promise<ArcTelemetry>', 'Live block height, native USDC gas price, and RPC latency.'],
            ['listEscrows()', 'Promise<EscrowRecord[]>', 'Reads paginated on-chain escrows from DiptosEscrow.sol.'],
            ['previewTECDPayoutOnChain(p)', 'Promise<OnChainTECD>', 'Direct eth_call to DiptosEscrow.previewTECDPayout().'],
            ['buildFundEscrowTx(p)', 'PreparedTx', 'Unsigned native USDC createEscrowLink transaction payload.'],
            ['buildSettleEscrowTx(p)', 'PreparedTx', 'Unsigned releaseWithOracle transaction payload.'],
          ],
        },
      },
    ],
  },
  {
    id: 'diptos-verified',
    group: 'Oracles & Verification',
    title: 'DIPTOS VERIFIED ✓ & DevSpark Payouts',
    description:
      'Deterministic, non-custodial proof verification via POST /api/verify/deliverable (GitHub PR, Artifact SHA-256, URL Digest) issuing single-use EIP-712 attestations and shareable receipts.',
    sections: [
      {
        id: 'deterministic-verify-api',
        heading: 'Deterministic Deliverable Verification',
        paragraphs: [
          'Every DevSpark hackathon bounty, agency sprint, or milestone payout can be gated by reproducible checks—merged GitHub PRs, exact SHA-256 artifact hashes anchored in DiptosRegistry.sol, or live URL content digests.',
          'The verification API never holds funds. It reads DiptosEscrow.nonces(escrowId) on Arc Testnet (5042002) and returns a single-use EIP-712 attestation that unlocks native USDC atomically and emits DiptosVerified on-chain.',
        ],
        code: {
          filename: 'verify-deliverable.ts',
          language: 'typescript',
          code: `const res = await fetch('https://diptos.xyz/api/verify/deliverable', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    escrowId: '0x...',
    proofType: 'github_pr',
    payload: {
      prUrl: 'https://github.com/Jayram2204/Diptos-Arc/pull/12',
      requireCi: true,
    },
  }),
})
const { approved, proofHash, eip712Signature, nonce } = await res.json()`,
          variants: {
            typescript: `const res = await fetch('https://diptos.xyz/api/verify/deliverable', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    escrowId: '0x...',
    proofType: 'github_pr', // 'github_pr' | 'artifact_hash' | 'url_digest'
    payload: {
      prUrl: 'https://github.com/Jayram2204/Diptos-Arc/pull/12',
      requireCi: true,
    },
  }),
})
const { approved, proofHash, eip712Signature, nonce } = await res.json()`,
            curl: `curl -X POST https://diptos.xyz/api/verify/deliverable \\
  -H "Content-Type: application/json" \\
  -d '{
    "escrowId": "esc_devspark_bounty_01",
    "proofType": "artifact_hash",
    "payload": {
      "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "expectedSha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    }
  }'`,
            solidity: `// Emitted on every verified settlement in DiptosEscrow.sol
event DiptosVerified(
    bytes32 indexed escrowId,
    bytes32 indexed proofHash,
    address indexed verifier,
    uint256 settledAt
);

// Atomic on-chain verification & native USDC release
escrow.releaseWithOracle(escrowId, 0, proofHash, nonce, eip712Signature);`,
          },
        },
      },
    ],
  },
  {
    id: 'circle-onramp-gateway',
    group: 'Protocol Specification',
    title: 'Circle Onramp, Gas Sponsorship & Unified Balance',
    description:
      'Embed zero-crypto-setup card/bank checkout with @circle-fin/onramp-kit, Arc Paymaster gas sponsorship, and Circle Gateway / CCTP unified USDC balances.',
    sections: [
      {
        id: 'onramp-kit-flow',
        heading: '1. Circle Onramp Kit Session & Iframe Mount',
        paragraphs: [
          'Server route POST /api/onramp/sessions reads CIRCLE_API_KEY strictly from server env (never exposed to client bundles), sets Cache-Control: no-store, and mints a short-lived Arc USDC session.',
          'On the client, /pay/:id mounts the widget inline via createOnrampKit().mountIframe({ session, container }) and cleanly tears down with widget.close().',
        ],
        code: {
          filename: 'onramp-checkout.ts',
          language: 'typescript',
          code: `import { createOnrampKit } from '@circle-fin/onramp-kit'

const res = await fetch('/api/onramp/sessions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'buyer-001',
    destinationAddress: '${ESCROW_CONTRACT_ADDRESS}',
    amountUsdc: 250,
    escrowId: 'esc_arc_001',
  }),
})
const { configured, session, widgetBaseUrl } = await res.json()
if (configured && session) {
  const kit = createOnrampKit({ widgetBaseUrl })
  const widget = kit.mountIframe({ session, container })
}`,
          variants: {
            typescript: `import { createOnrampKit } from '@circle-fin/onramp-kit'

const res = await fetch('/api/onramp/sessions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'buyer-001',
    destinationAddress: '${ESCROW_CONTRACT_ADDRESS}',
    amountUsdc: 250,
    escrowId: 'esc_arc_001',
  }),
})
const { configured, session, widgetBaseUrl } = await res.json()
if (configured && session) {
  const kit = createOnrampKit({ widgetBaseUrl })
  const widget = kit.mountIframe({ session, container })
}`,
            curl: `curl -X POST https://diptos.xyz/api/onramp/sessions \\
  -H "Content-Type: application/json" \\
  -d '{
    "userId": "buyer-001",
    "destinationAddress": "${ESCROW_CONTRACT_ADDRESS}",
    "amountUsdc": 250,
    "escrowId": "esc_arc_001"
  }'`,
            solidity: `// Arc Testnet (5042002) Dual-Decimal Scaling in DiptosEscrow.sol
// Native USDC (msg.value / gas) = 18 decimals; ArcUSDC ERC-20 Precompile = 6 decimals
uint256 public constant NATIVE_TO_ERC20_SCALE = 1e12;
function fromUsdc6(uint256 usdc6) external pure returns (uint256) {
    return usdc6 * NATIVE_TO_ERC20_SCALE;
}`,
          },
        },
      },
    ],
  },
  {
    id: 'dipto-agent-guard',
    group: 'Oracles & Verification',
    title: 'Dipto (@diptos/agent-guard & agent.diptos.xyz)',
    description:
      'Runtime PolicyGuard spend caps, Parent-to-Sub-Agent DAG budgets, and 4-step proof-gated HTTP 402 (x402) middleware built for the Circle Agent Stack.',
    sections: [
      {
        id: 'policy-guard-x402',
        heading: 'PolicyGuard + Proof-Gated x402 Execution',
        paragraphs: [
          'Agents never see private keys. PolicyGuard enforces maxPerTaskUsdc, dailyBudgetUsdc, approvalThresholdUsdc, allowedProviders, maxLatencySeconds, and hierarchical DAG sub-agent caps before locking USDC.',
          'If returned agent output violates outputSchema, withDiptosGuard automatically triggers refundEscrow and restores the agent budget.',
        ],
        code: {
          filename: 'dipto-agent.ts',
          language: 'typescript',
          code: `import { PolicyGuard, createDiptosX402Client, withDiptosGuard } from '@diptos/agent-guard'

const policy = new PolicyGuard({
  maxPerTaskUsdc: 50,
  dailyBudgetUsdc: 250,
  approvalThresholdUsdc: 35,
  allowedProviders: ['api.diptos.xyz', 'compute.arc.io'],
  maxLatencySeconds: 3600,
})
policy.allocateSubBudget('agent-parent', 'sub-agent-b', 40)

const client = createDiptosX402Client({ policy, lockEscrow, settleEscrow, refundEscrow })
const result = await withDiptosGuard(client, quote, { requiredKeys: ['deliverableHash'] }, runTask)`,
          variants: {
            typescript: `import { PolicyGuard, createDiptosX402Client, withDiptosGuard } from '@diptos/agent-guard'

const policy = new PolicyGuard({
  maxPerTaskUsdc: 50,
  dailyBudgetUsdc: 250,
  approvalThresholdUsdc: 35,
  allowedProviders: ['api.diptos.xyz', 'compute.arc.io'],
  maxLatencySeconds: 3600,
})
policy.allocateSubBudget('agent-parent', 'sub-agent-b', 40)

const client = createDiptosX402Client({ policy, lockEscrow, settleEscrow, refundEscrow })
const result = await withDiptosGuard(client, quote, { requiredKeys: ['deliverableHash'] }, runTask)`,
            curl: `# Standard HTTP 402 challenge upgraded with Dipto proof-gate headers
curl -i https://api.diptos.xyz/v1/agent-task \\
  -H "X-Diptos-Rail: arc-5042002" \\
  -H "X-Agent-Budget-Cap: 50.00 USDC" \\
  -H "X-Proof-Gate: deterministic-eip712"`,
            solidity: `// Modular Phase 2 Verifier Hook in DiptosEscrow.sol
interface IDiptosVerifier {
    function verifyRelease(
        bytes32 escrowId,
        uint256 milestoneIndex,
        bytes32 deliverableHash,
        uint256 nonce,
        bytes calldata proof
    ) external view returns (bool);
}`,
          },
        },
      },
    ],
  },
  {
    id: 'compute-sla-adapter',
    group: 'Oracles & Verification',
    title: 'Distributed Compute SLA & Base Builder Codes',
    description:
      'Provider-agnostic P2P inference & GPU SLA verification (AntSeed SAME/DIFF reference adapter), Base Builder Codes attribution suffix, and optional zero-custody Local AI scope linting.',
    sections: [
      {
        id: 'antseed-compute-sla',
        heading: 'AntSeed SAME/DIFF Compute SLA + Base Builder Codes',
        paragraphs: [
          'verifyComputeSlaAttestation validates output SHA-256, schema, elapsed latency vs. SLA window, and external model verification receipts (AntSeed verdict: "SAME" | "DIFF" with IPFS CID & on-chain proof hash).',
          'appendBaseBuilderCode appends a Base Builder Code attribution suffix to Base (8453 / 84532) transaction calldata while leaving Arc (5042002) calldata untouched.',
        ],
        code: {
          filename: 'compute-sla.ts',
          language: 'typescript',
          code: `import {
  verifyComputeSlaAttestation,
  appendBaseBuilderCode,
  lintDeliverableScope,
} from '@diptos/agent-guard'

const evalResult = verifyComputeSlaAttestation({
  jobId: 'antseed-job-101',
  escrowId: 'esc_compute_01',
  provider: 'antseed',
  principalUsdc: 100,
  lambda: 0.5,
  slaWindowSeconds: 3600,
  elapsedSeconds: 1800,
  outputSha256: 'c'.repeat(64),
  modelVerification: {
    verdict: 'SAME', // 'SAME' releases; 'DIFF' auto-refunds
    ipfsCid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
    onChainProofHash: '0x' + 'd'.repeat(64),
  },
})

const attributedData = appendBaseBuilderCode('0xdeadbeef', 'base-mainnet', 'diptos-v1')
const lint = await lintDeliverableScope({ acceptanceScope, deliverableSummary })`,
          variants: {
            typescript: `import {
  verifyComputeSlaAttestation,
  appendBaseBuilderCode,
  lintDeliverableScope,
} from '@diptos/agent-guard'

const evalResult = verifyComputeSlaAttestation({
  jobId: 'antseed-job-101',
  escrowId: 'esc_compute_01',
  provider: 'antseed',
  principalUsdc: 100,
  lambda: 0.5,
  slaWindowSeconds: 3600,
  elapsedSeconds: 1800,
  outputSha256: 'c'.repeat(64),
  modelVerification: {
    verdict: 'SAME', // 'SAME' releases; 'DIFF' auto-refunds
    ipfsCid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
    onChainProofHash: '0x' + 'd'.repeat(64),
  },
})

const attributedData = appendBaseBuilderCode('0xdeadbeef', 'base-mainnet', 'diptos-v1')
const lint = await lintDeliverableScope({ acceptanceScope, deliverableSummary })`,
            curl: `# Optional advisory local AI pre-submission linter (zero custody, never unlocks funds)
export LOCAL_AI_ENDPOINT="http://127.0.0.1:11434"
curl -X POST "$LOCAL_AI_ENDPOINT/v1/chat/completions" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"llama3.2","messages":[{"role":"user","content":"Check deliverable completeness"}]}'`,
            solidity: `// Zero-dust multi-decimal TECD math for both Arc (18-dec) & Base (6-dec)
(uint256 payeePayout, uint256 payerRebate, uint256 protocolFee, uint256 decayBps) =
    escrow.calculateTECDForDecimals(amount, 6, delaySeconds, windowSeconds, lambdaBps);
assert(payeePayout + payerRebate + protocolFee == amount);`,
          },
        },
      },
    ],
  },
]
