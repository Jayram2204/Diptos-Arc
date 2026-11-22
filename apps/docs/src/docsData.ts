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
      'Diptos is a non-custodial USDC escrow and proof-of-work settlement protocol built for both human counterparties and autonomous AI agents.',
    sections: [
      {
        id: 'what-is-diptos',
        heading: 'What is Diptos?',
        paragraphs: [
          'Traditional freelance marketplaces charge 10–15% take rates and resolve late delivery with binary, subjective disputes. On-chain escrows solve custody, but still freeze funds in all-or-nothing multisigs.',
          'Diptos replaces binary disputes with continuous Time-Entropic Collateral Decay (TECD), real-time macro risk calibration from Gemini Prediction Markets, and cryptographic EIP-712 deliverable attestation via Grok AI—settling atomically in native USDC on Arc Testnet (Chain ID 5042002).',
        ],
      },
      {
        id: 'execution-surfaces',
        heading: 'Two Execution Surfaces',
        table: {
          headers: ['Surface', 'Domain / Package', 'Primary Audience', 'Capabilities'],
          rows: [
            [
              'Escrow App',
              'app.diptos.xyz',
              'Payers, contractors, DAOs',
              'Originate escrow links, lock native USDC, monitor SLA countdowns, verify deliverables, settle or refund.',
            ],
            [
              'TypeScript SDK',
              '@diptos/sdk',
              'Autonomous AI agents & apps',
              'Build unsigned viem transactions, compute TECD payouts, read live Gemini λ, and request Grok EIP-712 release signatures.',
            ],
          ],
        },
      },
      {
        id: 'monorepo-layout',
        heading: 'Monorepo Architecture',
        code: {
          filename: 'workspace-structure.txt',
          language: 'text',
          code: `diptos-arc-protocol/
├── packages/
│   ├── contracts/   # @diptos/contracts — Multi-chain manifests & Foundry ABIs
│   └── sdk/         # @diptos/sdk       — Dual ESM/CJS TypeScript SDK (viem)
├── apps/
│   ├── app/         # @diptos/app       — app.diptos.xyz Escrow Lifecycle Engine
│   └── docs/        # @diptos/docs      — sdk.diptos.xyz Developer Documentation
├── contracts/       # Foundry Solidity sources (DiptosEscrow.sol, DiptosRegistry.sol)
└── server/          # Hono verification & Gemini risk API`,
        },
      },
    ],
  },
  {
    id: 'quickstart',
    group: 'Getting Started',
    title: 'Quickstart',
    description:
      'Install @diptos/sdk, query live Arc Testnet telemetry, calibrate TECD λ from Gemini Prediction Markets, and construct an escrow funding transaction in under 2 minutes.',
    sections: [
      {
        id: 'install-package',
        heading: '1. Install the SDK',
        paragraphs: [
          'Diptos requires viem v2 as a peer dependency. Both ESM and CommonJS entrypoints ship with full TypeScript declarations.',
        ],
        code: {
          filename: 'terminal',
          language: 'bash',
          code: `pnpm add @diptos/sdk viem`,
        },
      },
      {
        id: 'initialize-client',
        heading: '2. Instantiate DiptosClient',
        paragraphs: [
          'Point the client at the Arc Testnet RPC and verified DiptosEscrow / DiptosRegistry contract addresses.',
        ],
        code: {
          filename: 'src/diptos.ts',
          language: 'typescript',
          code: `import { DiptosClient } from '@diptos/sdk'

export const diptos = new DiptosClient({
  rpcUrl: 'https://rpc.testnet.arc.network',
  apiBaseUrl: 'https://diptos.xyz',
  escrowContract: '${ESCROW_CONTRACT_ADDRESS}',
  registryContract: '${REGISTRY_CONTRACT_ADDRESS}',
})

const [telemetry, risk] = await Promise.all([
  diptos.getArcTelemetry(),
  diptos.getLiveGeminiRisk(),
])

console.log('Arc Block:', telemetry.blockNumber)
console.log('Recommended TECD λ:', risk.recommendedLambda)`,
        },
      },
      {
        id: 'fund-first-escrow',
        heading: '3. Create & Fund an Escrow',
        paragraphs: [
          'On Arc Testnet, USDC is the native 18-decimal gas currency. Deposit principal directly via msg.value without a separate ERC-20 approve() transaction.',
        ],
        code: {
          filename: 'src/create-escrow.ts',
          language: 'typescript',
          code: `import { keccak256, toHex } from 'viem'
import { diptos } from './diptos'

const escrowId = keccak256(toHex('diptos:arc:5042002:deliverable-001'))

const tx = diptos.buildFundEscrowTx({
  escrowId,
  payee: '0x000000000000000000000000000000000000dEaD',
  amountUsdc: 250,
  deadlineUnix: Math.floor(Date.now() / 1000) + 86_400,
  lambdaBps: 3500, // λ = 0.35
  isAgentMode: true,
})

const hash = await walletClient.sendTransaction(tx)
console.log('Funded on Arc:', hash)`,
        },
        callout: {
          tone: 'note',
          title: 'Native 18-Decimal USDC on Arc',
          body: 'Arc Testnet uses native 18-decimal USDC for msg.value and gas fees, while the ERC-20 precompile at 0x3600…0000 exposes 6 decimals. The SDK automatically scales values using NATIVE_TO_ERC20_SCALE (10^12).',
        },
      },
    ],
  },
  {
    id: 'installation',
    group: 'Getting Started',
    title: 'Installation & Configuration',
    description: 'Environment variables, TypeScript configuration, and network RPC settings for local development and production deployments.',
    sections: [
      {
        id: 'requirements',
        heading: 'Requirements',
        bullets: [
          'Node.js 20.x or newer',
          'pnpm 9+ (for monorepo development)',
          'viem ^2.21.0 peer dependency',
          'Foundry (forge / cast) if compiling or deploying Solidity contracts locally',
        ],
      },
      {
        id: 'env-vars',
        heading: 'Environment Variables',
        table: {
          headers: ['Variable', 'Required', 'Description'],
          rows: [
            ['ARC_RPC_URL', 'No', 'Primary Arc Testnet JSON-RPC URL (defaults to https://rpc.testnet.arc.network)'],
            ['VITE_ESCROW_CONTRACT_ADDRESS', 'No', `Overrides default DiptosEscrow (${ESCROW_CONTRACT_ADDRESS})`],
            ['VITE_REGISTRY_CONTRACT_ADDRESS', 'No', `Overrides default DiptosRegistry (${REGISTRY_CONTRACT_ADDRESS})`],
            ['XAI_API_KEY', 'Server', 'xAI Grok API key for automated deliverable auditing'],
            ['ORACLE_PRIVATE_KEY', 'Server', 'ECDSA signing key matching DiptosEscrow.oracleSigner()'],
          ],
        },
      },
    ],
  },
  {
    id: 'protocol-overview',
    group: 'Protocol Specification',
    title: 'Protocol Overview',
    description: 'End-to-end state machine and architecture of DiptosEscrow.sol and DiptosRegistry.sol.',
    sections: [
      {
        id: 'lifecycle-states',
        heading: 'Escrow State Machine',
        paragraphs: [
          'Every escrow is uniquely identified by a deterministic bytes32 escrowId registered in DiptosRegistry.sol to prevent replay or double-funding.',
        ],
        table: {
          headers: ['Status', 'Enum Value', 'Allowed Transitions'],
          rows: [
            ['None', '0', 'Created via createEscrowLink() with msg.value > 0'],
            ['Funded', '1', 'releaseWithOracle(), releaseByPayer(), claimTimeoutRefund(), mutualCancel()'],
            ['Settled', '2', 'Terminal — 99.5% payee (or TECD-decayed split) + 0.5% protocol fee distributed'],
            ['Refunded', '3', 'Terminal — 100% principal returned to payer after deadline + gracePeriod'],
            ['Cancelled', '4', 'Terminal — mutual cancellation prior to settlement'],
          ],
        },
      },
      {
        id: 'anti-double-spend',
        heading: 'Canonical Registry Guard',
        paragraphs: [
          'DiptosRegistry.sol maintains a mapping of canonical keccak256 escrow IDs. Once registered by the authorized DiptosEscrow contract, an ID can never be re-used or re-registered across subsequent transactions.',
        ],
      },
    ],
  },
  {
    id: 'multi-chain',
    group: 'Protocol Specification',
    title: 'Multi-Chain Architecture',
    description: 'Unified chain manifest in @diptos/contracts and @diptos/sdk supporting Arc Testnet (Live) and EVM L2 testnets.',
    sections: [
      {
        id: 'supported-networks',
        heading: 'Supported Networks',
        table: {
          headers: ['Network', 'Chain ID', 'Status', 'Settlement Asset', 'DiptosEscrow'],
          rows: [
            ['Arc Testnet', '5042002', 'Live', 'Native USDC (18 dec)', ESCROW_CONTRACT_ADDRESS],
            ['Base Sepolia', '84532', 'Ready', 'ERC-20 USDC (6 dec)', 'Pending deployment'],
            ['Ethereum Sepolia', '11155111', 'Ready', 'ERC-20 USDC (6 dec)', 'Pending deployment'],
            ['Arbitrum Sepolia', '421614', 'Ready', 'ERC-20 USDC (6 dec)', 'Pending deployment'],
          ],
        },
      },
      {
        id: 'reading-chain-manifest',
        heading: 'Accessing the Chain Registry',
        code: {
          filename: 'src/chains.ts',
          language: 'typescript',
          code: `import { DIPTOS_SUPPORTED_CHAINS } from '@diptos/sdk'

const liveChains = DIPTOS_SUPPORTED_CHAINS.filter((c) => c.status === 'live')
console.log(liveChains[0].name, liveChains[0].escrowContract)`,
        },
      },
    ],
  },
  {
    id: 'tecd-math',
    group: 'Protocol Specification',
    title: 'TECD Decay Math',
    description: 'Continuous Time-Entropic Collateral Decay replaces binary late-delivery disputes with deterministic fixed-point on-chain math.',
    sections: [
      {
        id: 'formula',
        heading: 'Continuous Decay Function',
        paragraphs: [
          'When a deliverable is settled on or before the SLA deadline T (Δt = 0), the payee receives 99.5% of the locked principal and the protocol collects a flat 0.5% settlement fee.',
          'When delivery occurs Δt seconds past deadline T, the effective payout decays smoothly according to V(t) = V₀ · e^(−λ · (Δt / T)^γ), with γ = 1.5 and λ calibrated in basis points by Gemini Prediction Markets. The decayed difference is refunded atomically to the payer as an automatic SLA rebate.',
        ],
        code: {
          filename: 'tecd-preview.ts',
          language: 'typescript',
          code: `const split = diptos.calculateTECD({
  principalUsdc: 5000,
  lambda: 0.38,
  delaySeconds: 6 * 3600,        // 6 hours overdue
  totalDurationSeconds: 24 * 3600,
  gamma: 1.5,
})

console.log({
  payeePayoutUsdc: split.payeePayoutUsdc,
  buyerRebateUsdc: split.buyerRebateUsdc,
  protocolFeeUsdc: split.protocolFeeUsdc,
})`,
        },
      },
      {
        id: 'on-chain-verification',
        heading: 'On-Chain WAD Parity',
        paragraphs: [
          'DiptosEscrow.sol exposes a pure view function previewTECDPayout(amount, deadline, simulatedTimestamp, lambdaBps) using 18-decimal fixed-point WAD arithmetic so frontends, agents, and auditors can verify exact wei outputs prior to settlement.',
        ],
      },
    ],
  },
  {
    id: 'atomic-dvp',
    group: 'Protocol Specification',
    title: 'Atomic DvP & Settlement',
    description: 'Single-transaction delivery-versus-payment settlement, payer instant release, and permissionless timeout recovery.',
    sections: [
      {
        id: 'settlement-paths',
        heading: 'Three Settlement Paths',
        bullets: [
          'Oracle-Verified Release (releaseWithOracle): Verifies the Grok AI EIP-712 signature and expectedNonce, computes TECD split, and transfers payee payout, buyer rebate (if overdue), and 0.5% protocol fee atomically.',
          'Direct Payer Release (releaseByPayer): Payer can unilaterally release funds to the payee at any time without waiting for an oracle signature.',
          'Permissionless Timeout Refund (claimTimeoutRefund): If no delivery is settled before deadline + gracePeriod, the payer recovers 100% of locked principal with zero oracle dependency.',
        ],
      },
    ],
  },
  {
    id: 'gemini-oracle',
    group: 'Oracles & Verification',
    title: 'Gemini Risk Oracle (λ)',
    description: 'Dynamic calibration of the TECD decay rate λ from live Gemini Prediction Markets event probabilities.',
    sections: [
      {
        id: 'calibration-model',
        heading: 'Macro Volatility Mapping',
        paragraphs: [
          'The risk endpoint aggregates active event contracts from Gemini Prediction Markets, computes a normalized volatility index in [0, 1], and maps it to a recommended TECD decay parameter λ ∈ [0.18, 0.95]. Higher macro uncertainty tightens SLA enforcement automatically.',
        ],
        code: {
          filename: 'gemini-risk.ts',
          language: 'typescript',
          code: `const risk = await diptos.getLiveGeminiRisk()
console.log('Volatility Index:', risk.volatilityIndex)
console.log('Recommended λ:', risk.recommendedLambda)
console.log('Contracts sampled:', risk.contracts.length)`,
        },
      },
    ],
  },
  {
    id: 'grok-verifier',
    group: 'Oracles & Verification',
    title: 'Grok AI Deliverable Verifier',
    description: 'Automated inspection of GitHub pull requests, commits, and live URLs against the on-chain acceptance scope.',
    sections: [
      {
        id: 'verification-flow',
        heading: 'Audit & Attestation Flow',
        paragraphs: [
          'When a payee submits a deliverable URL, the verification service fetches the live artifact (GitHub PR diff/metadata or HTTP response), evaluates it against the on-chain title and acceptanceScope via Grok AI, and—if approved—signs an EIP-712 ReleaseEscrow digest bound to the escrow’s current on-chain nonce.',
        ],
        code: {
          filename: 'verify-deliverable.ts',
          language: 'typescript',
          code: `const receipt = await diptos.verifyDeliverableWithGrok({
  escrowId,
  title: 'Arc Native USDC Checkout & Foundry Suite',
  scope: 'All Foundry tests pass and contract verified on ArcScan',
  amountUsdc: 1250,
  deliverableUrl: 'https://github.com/Jayram2204/Diptos-Arc/pull/1',
})

if (receipt.approved && receipt.eip712Signature) {
  const settleTx = diptos.buildSettleEscrowTx({
    escrowId,
    deliverableHash: receipt.deliverableHash,
    expectedNonce: receipt.nonce,
    grokSignature: receipt.eip712Signature,
  })
  await walletClient.sendTransaction(settleTx)
}`,
        },
      },
    ],
  },
  {
    id: 'eip712-signatures',
    group: 'Oracles & Verification',
    title: 'EIP-712 Release Signatures',
    description: 'Exact typed-data domain and struct definition verified by DiptosEscrow.sol on Arc Testnet.',
    sections: [
      {
        id: 'domain-struct',
        heading: 'Typed Data Specification',
        code: {
          filename: 'eip712-domain.ts',
          language: 'typescript',
          code: `const domain = {
  name: 'DiptosEscrow',
  version: '1',
  chainId: 5042002,
  verifyingContract: '${ESCROW_CONTRACT_ADDRESS}',
} as const

const types = {
  ReleaseEscrow: [
    { name: 'escrowId', type: 'bytes32' },
    { name: 'deliverableHash', type: 'bytes32' },
    { name: 'nonce', type: 'uint256' },
  ],
} as const`,
        },
        callout: {
          tone: 'warning',
          title: 'Strict Nonce Binding',
          body: 'Every signature is bound to the escrow’s live on-chain nonce (DiptosEscrow.nonces(escrowId)). Replaying an old signature reverts with InvalidNonce().',
        },
      },
    ],
  },
  {
    id: 'sdk-api',
    group: 'Reference',
    title: 'DiptosClient API',
    description: 'Complete method reference for @diptos/sdk v1.0.0.',
    sections: [
      {
        id: 'methods',
        heading: 'Client Methods',
        table: {
          headers: ['Method', 'Returns', 'Description'],
          rows: [
            ['getArcTelemetry()', 'Promise<ArcTelemetry>', 'Reads live block height, gas price, and RPC latency from Arc Testnet.'],
            ['getLiveGeminiRisk()', 'Promise<GeminiRiskResponse>', 'Fetches live Gemini Prediction Markets contracts and calibrated λ.'],
            ['listEscrows()', 'Promise<EscrowRecord[]>', 'Reads paginated on-chain escrows directly from DiptosEscrow.sol.'],
            ['getEscrow(id)', 'Promise<EscrowRecord | null>', 'Fetches full on-chain state, title, and acceptance scope for a single escrow.'],
            ['calculateTECD(input)', 'TecdCalculation', 'Deterministic local WAD calculation for payee payout, buyer rebate, and protocol fee.'],
            ['buildFundEscrowTx(params)', 'PreparedTx', 'Constructs unsigned native USDC createEscrowLink transaction payload.'],
            ['buildSettleEscrowTx(params)', 'PreparedTx', 'Constructs unsigned releaseWithOracle transaction payload.'],
            ['verifyDeliverableWithGrok(req)', 'Promise<GrokAuditResult>', 'Requests Grok AI audit and EIP-712 ReleaseEscrow signature.'],
          ],
        },
      },
    ],
  },
  {
    id: 'contracts-reference',
    group: 'Reference',
    title: 'Deployed Contracts',
    description: 'Verified live smart contract addresses on Arc Testnet (Chain ID 5042002).',
    sections: [
      {
        id: 'arc-addresses',
        heading: 'Arc Testnet (5042002)',
        table: {
          headers: ['Contract', 'Address', 'Verification'],
          rows: [
            ['DiptosEscrow.sol', ESCROW_CONTRACT_ADDRESS, 'Live (13,245 bytes bytecode, Block #73188305)'],
            ['DiptosRegistry.sol', REGISTRY_CONTRACT_ADDRESS, 'Live (1,757 bytes bytecode, Block #73188305)'],
            ['ArcUSDC Precompile', '0x3600000000000000000000000000000000000000', 'Native Arc Testnet USDC interface'],
          ],
        },
      },
    ],
  },
  {
    id: 'rest-api',
    group: 'Reference',
    title: 'REST API Endpoints',
    description: 'HTTP endpoints exposed by the Diptos verification & telemetry backend.',
    sections: [
      {
        id: 'endpoints',
        heading: 'Endpoints',
        table: {
          headers: ['Method & Path', 'Purpose'],
          rows: [
            ['GET /api/health', 'Health check and configured Arc contract addresses.'],
            ['GET /api/gemini/risk', 'Live Gemini Prediction Markets feed and calibrated TECD λ.'],
            ['GET /api/escrows', 'Indexed view of active and settled on-chain escrows.'],
            ['POST /api/grok/verify', 'Runs Grok AI deliverable audit and returns signed EIP-712 release digest.'],
            ['POST /api/voice/briefing', 'Generates ElevenLabs audio settlement summary for an escrow.'],
          ],
        },
      },
    ],
  },
  {
    id: 'security',
    group: 'Reference',
    title: 'Security & Trust Boundaries',
    description: 'Custody guarantees, oracle scope, and testnet disclosures.',
    sections: [
      {
        id: 'boundaries',
        heading: 'Trust Model',
        bullets: [
          'Non-Custodial Custody: Funds are held exclusively by DiptosEscrow.sol; neither the frontend nor backend can sweep or redirect locked USDC.',
          'Oracle Scope: A valid EIP-712 signature proves authorization by oracleSigner(), not absolute cryptographic truth of off-chain work. Payers retain unilateral permissionless refund rights via claimTimeoutRefund() after deadline + gracePeriod.',
          'Testnet Status: Contracts pass 17/17 Foundry unit and fuzz tests, but are currently deployed for Arc Testnet evaluation and have not undergone a formal third-party mainnet audit.',
        ],
      },
    ],
  },
]
