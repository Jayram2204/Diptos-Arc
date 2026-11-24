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
      'Diptos is a non-custodial USDC Guaranteed Outcome Protection protocol built for Arc Native USDC (18-dec) and Base ERC-20 USDC (6-dec) + x402 autonomous AI agents.',
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
              'Build unsigned viem transactions, compute on-chain TECD payouts, integrate x402 agent guardrails.',
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
]
