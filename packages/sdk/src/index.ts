import {
  type Address,
  type Chain,
  createPublicClient,
  defineChain,
  type Hex,
  http,
  keccak256,
  parseAbi,
  stringToHex,
  type WalletClient,
} from 'viem'

export const ARC_TESTNET: Chain = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.io'] },
  },
  blockExplorers: {
    default: { name: 'Arc Explorer', url: 'https://explorer.testnet.arc.io' },
  },
  testnet: true,
})

export const DIPTOS_ESCROW_ABI = parseAbi([
  'function createEscrowLink(bytes32 escrowId, address payee, uint256 deadline, uint256 lambdaBps, bool isAgentMode) payable',
  'function createMultiMilestoneEscrow(bytes32 escrowId, address payee, uint256[] amounts, uint256[] deadlines, uint256 lambdaBps, bool isAgentMode) payable',
  'function releaseWithOracle(bytes32 escrowId, uint256 milestoneIndex, bytes32 deliverableHash, uint256 expectedNonce, bytes grokSignature)',
  'function claimTimeoutRefund(bytes32 escrowId)',
  'function mutualCancel(bytes32 escrowId)',
  'function previewTECD(bytes32 escrowId, uint256 atTimestamp) view returns (uint256 payeePayout, uint256 payerRebate, uint256 protocolFee, uint256 decayBps)',
])

export const DIPTOS_REGISTRY_ABI = parseAbi([
  'function getCounterpartyStats(address payee) view returns ((uint256 completedOnTime, uint256 completedLate, uint256 totalVolumeSettled, uint256 totalLatencySeconds, uint256 averageLatencySeconds))',
])

export interface DiptosClientConfig {
  apiBaseUrl?: string
  rpcUrl?: string
  escrowContract?: Address
  registryContract?: Address
}

export interface CreateEscrowParams {
  title: string
  scope: string
  amountUsdc: number
  deadlineHours?: number
  mode?: 'human' | 'agent'
  payee?: Address
  tecdLambda?: number
}

export interface EscrowLinkResult {
  escrow: {
    id: string
    escrowIdBytes32: Hex
    title: string
    scope: string
    amountUsdc: number
    deadline: string
    deadlineUnix: number
    deadlineHours: number
    mode: 'human' | 'agent'
    payee: Address
    tecdLambda: number
    tecdLambdaBps: number
    status: string
  }
  checkoutPath: string
  shareUrl: string
}

export interface GeminiRiskResult {
  source: 'gemini-prediction-markets'
  fetchedAt: string
  volatilityIndex: number
  recommendedLambda: number
  recommendedLambdaBps: number
  contracts: {
    instrumentSymbol: string
    title: string
    yesProbability: number
    noProbability: number
    status: string
  }[]
}

export interface CounterpartyReputation {
  payee: Address
  completedOnTime: bigint
  completedLate: bigint
  totalVolumeSettled: bigint
  totalLatencySeconds: bigint
  averageLatencySeconds: bigint
}

export interface PrepareAgentEscrowParams {
  payee: Address
  amountUsdc: number
  deadlineHours?: number
  scope: string
  escrowId?: string
}

export interface PreparedAgentEscrowCalldata {
  chainId: 5042002
  to: Address | null
  valueWei: string
  calldata: Hex
  escrowId: string
  escrowIdBytes32: Hex
  deadlineUnix: number
  recommendedLambda: number
  recommendedLambdaBps: number
  counterpartyTrustScore: number
}

export interface VerifyMilestoneParams {
  escrowId: string
  milestoneIndex?: number
  deliverableUrl?: string
  deliverableNotes?: string
}

export interface GrokMilestoneReceipt {
  approved: boolean
  confidence: number
  summary: string
  auditReasoning: string
  grokModel: string
  milestoneIndex: number
  nonce: number
  deliverableHash: Hex
  evidenceHash: Hex
  evidenceSummary: string
  eip712Signature?: Hex
  signature?: Hex
  oracleSigner?: Address
  auditedAt: string
}

export interface SettleOnArcParams {
  escrowId: string
  milestoneIndex?: number
  deliverableHash: Hex
  nonce: number
  grokSignature: Hex
  walletClient: WalletClient
  escrowContract?: Address
}

export interface ClaimTimeoutRefundParams {
  escrowId: string
  walletClient: WalletClient
  escrowContract?: Address
}

function toEscrowBytes32(escrowId: string): Hex {
  return escrowId.startsWith('0x') && escrowId.length === 66
    ? (escrowId as Hex)
    : keccak256(stringToHex(`diptos:arc:5042002:${escrowId}`))
}

export class DiptosClient {
  private readonly apiBaseUrl: string
  private readonly rpcUrl: string
  private readonly escrowContract?: Address
  private readonly registryContract?: Address

  constructor(config: DiptosClientConfig = {}) {
    this.apiBaseUrl = (config.apiBaseUrl ?? 'https://diptos.xyz').replace(/\/$/, '')
    this.rpcUrl = config.rpcUrl ?? 'https://rpc.testnet.arc.io'
    this.escrowContract = config.escrowContract
    this.registryContract = config.registryContract
  }

  private getPublicClient() {
    return createPublicClient({
      chain: ARC_TESTNET,
      transport: http(this.rpcUrl),
    })
  }

  async createEscrowLink(params: CreateEscrowParams): Promise<EscrowLinkResult> {
    const res = await fetch(`${this.apiBaseUrl}/api/escrows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    if (!res.ok) throw new Error(`createEscrowLink failed (${res.status}): ${await res.text()}`)
    return (await res.json()) as EscrowLinkResult
  }

  async getLiveGeminiRisk(): Promise<GeminiRiskResult> {
    const res = await fetch(`${this.apiBaseUrl}/api/risk/gemini`)
    if (!res.ok) throw new Error(`getLiveGeminiRisk failed (${res.status}): ${await res.text()}`)
    return (await res.json()) as GeminiRiskResult
  }

  async getCounterpartyReputation(
    payee: Address,
    registryContract?: Address,
  ): Promise<CounterpartyReputation> {
    const target = registryContract ?? this.registryContract
    if (!target) throw new Error('registryContract address is required to query reputation on Arc')

    const stats = (await this.getPublicClient().readContract({
      address: target,
      abi: DIPTOS_REGISTRY_ABI,
      functionName: 'getCounterpartyStats',
      args: [payee],
    })) as {
      completedOnTime: bigint
      completedLate: bigint
      totalVolumeSettled: bigint
      totalLatencySeconds: bigint
      averageLatencySeconds: bigint
    }

    return { payee, ...stats }
  }

  async prepareAgentEscrowCalldata(
    params: PrepareAgentEscrowParams,
  ): Promise<PreparedAgentEscrowCalldata> {
    const res = await fetch(`${this.apiBaseUrl}/api/agent/quote-and-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    if (!res.ok) {
      throw new Error(`prepareAgentEscrowCalldata failed (${res.status}): ${await res.text()}`)
    }
    return (await res.json()) as PreparedAgentEscrowCalldata
  }

  async verifyAndSignMilestone(params: VerifyMilestoneParams): Promise<GrokMilestoneReceipt> {
    const res = await fetch(`${this.apiBaseUrl}/api/verify/grok`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    if (!res.ok) {
      throw new Error(`verifyAndSignMilestone failed (${res.status}): ${await res.text()}`)
    }
    return (await res.json()) as GrokMilestoneReceipt
  }

  /** Alias for backward compatibility */
  async verifyDeliverableWithGrok(params: VerifyMilestoneParams): Promise<GrokMilestoneReceipt> {
    return this.verifyAndSignMilestone(params)
  }

  async settleEscrowOnArc(params: SettleOnArcParams): Promise<{ txHash: Hex; blockNumber: bigint }> {
    const contract = params.escrowContract ?? this.escrowContract
    if (!contract) throw new Error('escrowContract address is required to settle on Arc Testnet')
    const account = params.walletClient.account
    if (!account) throw new Error('walletClient must have an active account')

    const txHash = await params.walletClient.writeContract({
      account,
      chain: ARC_TESTNET,
      address: contract,
      abi: DIPTOS_ESCROW_ABI,
      functionName: 'releaseWithOracle',
      args: [
        toEscrowBytes32(params.escrowId),
        BigInt(params.milestoneIndex ?? 0),
        params.deliverableHash,
        BigInt(params.nonce),
        params.grokSignature,
      ],
    })

    const receipt = await this.getPublicClient().waitForTransactionReceipt({ hash: txHash })
    return { txHash, blockNumber: receipt.blockNumber }
  }

  async claimTimeoutRefund(
    params: ClaimTimeoutRefundParams,
  ): Promise<{ txHash: Hex; blockNumber: bigint }> {
    const contract = params.escrowContract ?? this.escrowContract
    if (!contract) throw new Error('escrowContract address is required to claim timeout refund')
    const account = params.walletClient.account
    if (!account) throw new Error('walletClient must have an active account')

    const txHash = await params.walletClient.writeContract({
      account,
      chain: ARC_TESTNET,
      address: contract,
      abi: DIPTOS_ESCROW_ABI,
      functionName: 'claimTimeoutRefund',
      args: [toEscrowBytes32(params.escrowId)],
    })

    const receipt = await this.getPublicClient().waitForTransactionReceipt({ hash: txHash })
    return { txHash, blockNumber: receipt.blockNumber }
  }
}

export function createDiptosClient(config?: DiptosClientConfig): DiptosClient {
  return new DiptosClient(config)
}
