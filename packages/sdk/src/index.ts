import {
  type Address,
  type Chain,
  createPublicClient,
  defineChain,
  encodeAbiParameters,
  encodeFunctionData,
  fallback,
  formatEther,
  formatGwei,
  type Hex,
  http,
  keccak256,
  parseAbi,
  parseEther,
  type PublicClient,
  stringToHex,
  type WalletClient,
} from 'viem'

export const ARC_RPC_PRIMARY = 'https://rpc.testnet.arc.network'
export const ARC_RPC_FALLBACK = 'https://rpc.solidrpc.io/public/evm/5042002'

export const ARC_TESTNET_CONFIG = {
  chainId: 5042002,
  rpcUrl: ARC_RPC_PRIMARY,
  fallbackRpcUrl: ARC_RPC_FALLBACK,
  explorerUrl: 'https://testnet.arcscan.app',
  nativeDecimals: 18,
  erc20UsdcDecimals: 6,
} as const

export const ARC_TESTNET: Chain = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: {
    default: { http: [ARC_RPC_PRIMARY, ARC_RPC_FALLBACK] },
  },
  blockExplorers: {
    default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' },
  },
  testnet: true,
})

/** Arc Testnet dual-decimal rule: native USDC (18 dec) <-> ERC-20 USDC (6 dec). */
export const NATIVE_TO_ERC20_SCALE = 10n ** 12n
export const nativeUsdcTo6Decimals = (nativeWei: bigint): bigint => nativeWei / NATIVE_TO_ERC20_SCALE
export const usdc6ToNativeWei = (usdc6: bigint): bigint => usdc6 * NATIVE_TO_ERC20_SCALE

export const DIPTOS_ESCROW_ABI = parseAbi([
  'function protocolFeeBps() view returns (uint256)',
  'function getEscrowCount() view returns (uint256)',
  'function getEscrowsPaginated(uint256 offset, uint256 limit) view returns ((bytes32 escrowId, address payer, address payee, uint256 amount, uint256 deadline, uint256 createdAt, uint256 fundedAt, uint256 lambdaBps, uint256 nonce, bool isAgentMode, uint8 status, bytes32 deliverableHash)[])',
  'function getEscrowView(bytes32 escrowId) view returns ((bytes32 escrowId, address payer, address payee, uint256 amount, uint256 deadline, uint256 createdAt, uint256 fundedAt, uint256 lambdaBps, uint256 nonce, bool isAgentMode, uint8 status, bytes32 deliverableHash))',
  'function createEscrowLink(bytes32 escrowId, address payee, uint256 deadline, uint256 lambdaBps, bool isAgentMode) payable',
  'function createMultiMilestoneEscrow(bytes32 escrowId, address payee, uint256[] amounts, uint256[] deadlines, uint256 lambdaBps, bool isAgentMode) payable',
  'function releaseWithOracle(bytes32 escrowId, uint256 milestoneIndex, bytes32 deliverableHash, uint256 expectedNonce, bytes grokSignature)',
  'function claimTimeoutRefund(bytes32 escrowId)',
  'function mutualCancel(bytes32 escrowId)',
  'function previewTECDPayout(uint256 amount, uint256 deadline, uint256 simulatedTimestamp, uint256 lambdaBps) view returns (uint256 payeePayout, uint256 payerRebate, uint256 protocolFee, uint256 decayBps)',
])

export const DIPTOS_REGISTRY_ABI = parseAbi([
  'function totalEscrows() view returns (uint256)',
  'function totalSettledMilestones() view returns (uint256)',
  'function getCounterpartyStats(address payee) view returns ((uint256 completedOnTime, uint256 completedLate, uint256 totalVolumeSettled, uint256 totalLatencySeconds, uint256 averageLatencySeconds))',
])

export type EscrowMode = 'human' | 'agent'
export type EscrowStatus = 'created' | 'funded' | 'verified' | 'settled' | 'refunded'

export interface GrokAuditRecord {
  approved: boolean
  confidence: number
  summary: string
  auditReasoning?: string
  grokModel?: string
  milestoneIndex?: number
  nonce?: number
  deliverableUrl?: string
  deliverableHash: Hex
  evidenceHash?: Hex
  evidenceSummary?: string
  eip712Signature?: Hex
  signature?: string
  oracleSigner?: string
  auditedAt: string
}

export interface EscrowRecord {
  id: string
  escrowIdBytes32: Hex
  title: string
  scope: string
  amountUsdc: number
  deadline: string
  deadlineUnix: number
  deadlineHours: number
  mode: EscrowMode
  payer?: string
  payee: string
  nonce?: number
  txHash?: string
  settleTxHash?: string
  tecdLambda: number
  tecdLambdaBps: number
  status: EscrowStatus
  grokAudit?: GrokAuditRecord
  createdAt: string
  onChain?: boolean
}

export interface GeminiContractSnapshot {
  instrumentSymbol: string
  title: string
  yesProbability: number
  noProbability: number
  status: string
}

export interface GeminiRiskResult {
  source: 'gemini-prediction-markets'
  fetchedAt: string
  volatilityIndex: number
  recommendedLambda: number
  recommendedLambdaBps: number
  contracts: GeminiContractSnapshot[]
}

export interface ArcTelemetryResult {
  chainId: 5042002
  rpcUrl: string
  blockNumber: bigint
  timestamp: bigint
  blockTimestamp: bigint
  baseFeePerGas: bigint | null
  gasPrice: bigint
  baseFeeGwei: string
  latencyMs: number
}

export interface OnChainTECDPreview {
  payeePayoutUsdc: number
  buyerRebateUsdc: number
  protocolFeeUsdc: number
  decayPercent: number
  source: 'arc-eth-call' | 'sdk-wad-fallback'
}

export interface ProtocolEvent {
  id: string
  source: 'quicknode' | 'arc-rpc'
  eventName:
    | 'EscrowCreated'
    | 'MilestoneSettled'
    | 'EscrowSettled'
    | 'TECDPenaltyApplied'
    | 'TimeoutRefunded'
    | 'ArcBlock'
  chainId: 5042002
  blockNumber: number
  logIndex?: number
  txHash?: string
  escrowId?: string
  summary: string
  receivedAt: string
}

export interface BytecodeVerificationResult {
  address: Address
  hasCode: boolean
  byteLength: number
}

export interface OracleStatusResult {
  chainId: 5042002
  network: string
  rpcUrl: string
  oracleSigner: Address | null
  eip712Domain: {
    name: string
    version: string
    chainId: number
    verifyingContract: Address | null
  }
  latestArcBlock: number | null
  rpcError: string | null
  totalAttestationsSigned: number
}

export interface CalculateTECDResult {
  retentionRatio: number
  decayPercent: number
  payeePayout: number
  payeePayoutUsdc: number
  sellerPayout: number
  buyerRebate: number
  buyerRebateUsdc: number
  protocolFee: number
  protocolFeeUsdc: number
}

export interface BuiltTxPayload {
  to: Address
  functionName: string
  args: readonly unknown[]
  data: Hex
  value?: bigint
}

export interface CounterpartyReputation {
  payee: Address
  completedOnTime: bigint
  completedLate: bigint
  totalVolumeSettled: bigint
  totalLatencySeconds: bigint
  averageLatencySeconds: bigint
}

export interface DiptosClientConfig {
  apiBaseUrl?: string
  rpcUrl?: string
  fallbackRpcUrl?: string
  chainId?: number
  escrowContract?: Address
  escrowAddress?: Address
  registryContract?: Address
  registryAddress?: Address
}

export interface CreateEscrowParams {
  title: string
  scope: string
  amountUsdc: number
  deadlineHours?: number
  mode?: EscrowMode
  payee?: Address
  tecdLambda?: number
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
  notes?: string
  title?: string
  scope?: string
  amountUsdc?: number
}

export interface GrokMilestoneReceipt extends GrokAuditRecord {}

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
    this.apiBaseUrl = (config.apiBaseUrl ?? '').replace(/\/$/, '')
    this.rpcUrl = config.rpcUrl ?? ARC_RPC_PRIMARY
    this.escrowContract = config.escrowContract ?? config.escrowAddress
    this.registryContract = config.registryContract ?? config.registryAddress
  }

  public getPublicClient(): PublicClient {
    return createPublicClient({
      chain: ARC_TESTNET,
      transport: fallback([http(this.rpcUrl), http(ARC_RPC_FALLBACK)]),
    }) as PublicClient
  }

  computeEscrowHash(params: {
    payer: Address
    payee: Address
    amountUsdc: number | string
    deadline: number | bigint
    salt?: Hex | string
  }): { escrowIdBytes32: Hex; canonicalHash: Hex; amountWei: bigint; deadlineUnix: bigint } {
    const escrowIdBytes32: Hex =
      params.salt && typeof params.salt === 'string' && params.salt.startsWith('0x') && params.salt.length === 66
        ? (params.salt as Hex)
        : keccak256(stringToHex(String(params.salt ?? 'diptos:arc:5042002')))
    const cleanAmt = Number(params.amountUsdc) > 0 ? String(params.amountUsdc) : '0'
    const amountWei = parseEther(cleanAmt)
    const deadlineUnix = BigInt(params.deadline)
    const canonicalHash = keccak256(
      encodeAbiParameters(
        [
          { type: 'bytes32' },
          { type: 'address' },
          { type: 'address' },
          { type: 'uint256' },
          { type: 'uint256' },
        ],
        [escrowIdBytes32, params.payer, params.payee, amountWei, deadlineUnix],
      ),
    )
    return { escrowIdBytes32, canonicalHash, amountWei, deadlineUnix }
  }

  calculateTECD(params: {
    principalUsdc: number
    lambda: number
    delaySeconds: number
    totalDurationSeconds: number
    gamma?: number
  }): CalculateTECDResult {
    const { principalUsdc, lambda, delaySeconds, totalDurationSeconds, gamma = 1.5 } = params
    const feeRate = 0.005
    if (delaySeconds <= 0) {
      const protocolFee = principalUsdc * feeRate
      const payeePayout = principalUsdc - protocolFee
      return {
        retentionRatio: 1,
        decayPercent: 0,
        payeePayout,
        payeePayoutUsdc: payeePayout,
        sellerPayout: payeePayout,
        buyerRebate: 0,
        buyerRebateUsdc: 0,
        protocolFee,
        protocolFeeUsdc: protocolFee,
      }
    }
    const window = Math.max(3600, totalDurationSeconds)
    const ratio = delaySeconds / window
    const retentionRatio = Math.exp(-lambda * Math.pow(ratio, gamma))
    const grossPayee = principalUsdc * retentionRatio
    const protocolFee = grossPayee * feeRate
    const payeePayout = grossPayee - protocolFee
    const buyerRebate = principalUsdc - grossPayee
    return {
      retentionRatio,
      decayPercent: (1 - retentionRatio) * 100,
      payeePayout,
      payeePayoutUsdc: payeePayout,
      sellerPayout: payeePayout,
      buyerRebate,
      buyerRebateUsdc: buyerRebate,
      protocolFee,
      protocolFeeUsdc: protocolFee,
    }
  }

  buildFundEscrowTx(params: {
    escrowId: string
    payee: string
    amountUsdc: number
    deadlineUnix: number
    lambdaBps: number
    isAgentMode: boolean
  }): BuiltTxPayload {
    const to = this.escrowContract ?? '0x0000000000000000000000000000000000000000'
    const args = [
      toEscrowBytes32(params.escrowId),
      params.payee as Address,
      BigInt(params.deadlineUnix),
      BigInt(params.lambdaBps),
      params.isAgentMode,
    ] as const
    const data = encodeFunctionData({
      abi: DIPTOS_ESCROW_ABI,
      functionName: 'createEscrowLink',
      args,
    })
    return {
      to,
      functionName: 'createEscrowLink',
      args,
      data,
      value: parseEther(String(params.amountUsdc)),
    }
  }

  buildCreateEscrowTx(params: {
    escrowId: string
    payee: string
    amountUsdc: number
    deadlineUnix: number
    lambdaBps: number
    isAgentMode: boolean
  }): BuiltTxPayload {
    return this.buildFundEscrowTx(params)
  }

  buildReleaseWithOracleTx(params: {
    escrowId: string
    milestoneIndex?: number
    deliverableHash: Hex
    nonce?: number
    expectedNonce?: number
    grokSignature: string
  }): BuiltTxPayload {
    const to = this.escrowContract ?? '0x0000000000000000000000000000000000000000'
    const args = [
      toEscrowBytes32(params.escrowId),
      BigInt(params.milestoneIndex ?? 0),
      params.deliverableHash,
      BigInt(params.expectedNonce ?? params.nonce ?? 0),
      params.grokSignature as Hex,
    ] as const
    const data = encodeFunctionData({
      abi: DIPTOS_ESCROW_ABI,
      functionName: 'releaseWithOracle',
      args,
    })
    return {
      to,
      functionName: 'releaseWithOracle',
      args,
      data,
    }
  }

  buildClaimTimeoutRefundTx(params: { escrowId: string }): BuiltTxPayload {
    const to = this.escrowContract ?? '0x0000000000000000000000000000000000000000'
    const args = [toEscrowBytes32(params.escrowId)] as const
    const data = encodeFunctionData({
      abi: DIPTOS_ESCROW_ABI,
      functionName: 'claimTimeoutRefund',
      args,
    })
    return {
      to,
      functionName: 'claimTimeoutRefund',
      args,
      data,
    }
  }

  async getArcTelemetry(): Promise<ArcTelemetryResult> {
    const t0 = performance.now()
    const client = this.getPublicClient()
    const [block, gasPrice] = await Promise.all([
      client.getBlock({ blockTag: 'latest' }),
      client.getGasPrice().catch(() => 0n),
    ])
    const baseFee = block.baseFeePerGas ?? gasPrice
    return {
      chainId: 5042002,
      rpcUrl: this.rpcUrl,
      blockNumber: block.number ?? 0n,
      timestamp: block.timestamp,
      blockTimestamp: block.timestamp,
      baseFeePerGas: block.baseFeePerGas ?? null,
      gasPrice,
      baseFeeGwei: Number(formatGwei(baseFee)).toFixed(4),
      latencyMs: Math.round(performance.now() - t0),
    }
  }

  async verifyContractBytecode(address: Address): Promise<BytecodeVerificationResult> {
    const code = await this.getPublicClient().getCode({ address })
    const byteLength = code && code !== '0x' ? (code.length - 2) / 2 : 0
    return { address, hasCode: byteLength > 0, byteLength }
  }

  async getOracleStatus(): Promise<OracleStatusResult> {
    const res = await fetch(`${this.apiBaseUrl}/api/oracle/status`)
    if (!res.ok) throw new Error(`getOracleStatus failed (${res.status})`)
    return (await res.json()) as OracleStatusResult
  }

  async listEscrows(offset = 0, limit = 25): Promise<EscrowRecord[]> {
    if (this.escrowContract) {
      try {
        const items = (await this.getPublicClient().readContract({
          address: this.escrowContract,
          abi: DIPTOS_ESCROW_ABI,
          functionName: 'getEscrowsPaginated',
          args: [BigInt(offset), BigInt(limit)],
        })) as readonly {
          escrowId: Hex
          payer: Address
          payee: Address
          amount: bigint
          deadline: bigint
          createdAt: bigint
          fundedAt: bigint
          lambdaBps: bigint
          nonce: bigint
          isAgentMode: boolean
          status: number
          deliverableHash: Hex
        }[]
        const statusMap: EscrowStatus[] = ['created', 'funded', 'verified', 'settled', 'refunded']
        return items
          .filter((v) => v.payer !== '0x0000000000000000000000000000000000000000')
          .map((v) => {
            const deadlineUnix = Number(v.deadline)
            const createdUnix = Number(v.createdAt || v.fundedAt)
            const deadlineHours =
              deadlineUnix > createdUnix ? Math.max(1, Math.round((deadlineUnix - createdUnix) / 3600)) : 24
            const lambdaBps = Number(v.lambdaBps)
            return {
              id: v.escrowId,
              escrowIdBytes32: v.escrowId,
              title: v.isAgentMode
                ? `AI Agent Escrow ${v.escrowId.slice(0, 10)}`
                : `Arc USDC Escrow ${v.escrowId.slice(0, 10)}`,
              scope: 'On-chain non-custodial escrow settled via Grok EIP-712 Oracle on Arc Testnet (5042002).',
              amountUsdc: Number(formatEther(v.amount)),
              deadline: deadlineUnix > 0 ? new Date(deadlineUnix * 1000).toISOString() : new Date().toISOString(),
              deadlineUnix,
              deadlineHours,
              mode: v.isAgentMode ? 'agent' : 'human',
              payer: v.payer,
              payee: v.payee,
              nonce: Number(v.nonce),
              tecdLambda: Number((lambdaBps / 10_000).toFixed(4)),
              tecdLambdaBps: lambdaBps,
              status: statusMap[v.status] ?? 'created',
              createdAt: createdUnix > 0 ? new Date(createdUnix * 1000).toISOString() : new Date().toISOString(),
              onChain: true,
            }
          })
      } catch {
        // Fall through to REST endpoint
      }
    }
    const res = await fetch(`${this.apiBaseUrl}/api/escrows?offset=${offset}&limit=${limit}`)
    if (!res.ok) throw new Error(`listEscrows failed (${res.status}): ${await res.text()}`)
    const data = (await res.json()) as { escrows?: EscrowRecord[] }
    return data.escrows ?? []
  }

  async getEvents(limit = 25): Promise<{ events: ProtocolEvent[]; latestBlock: number }> {
    const res = await fetch(`${this.apiBaseUrl}/api/events?limit=${limit}`)
    if (!res.ok) throw new Error(`getEvents failed (${res.status}): ${await res.text()}`)
    return (await res.json()) as { events: ProtocolEvent[]; latestBlock: number }
  }

  async getEscrow(escrowId: string): Promise<EscrowRecord> {
    if (this.escrowContract) {
      try {
        const escrowIdBytes32 = toEscrowBytes32(escrowId)
        const v = (await this.getPublicClient().readContract({
          address: this.escrowContract,
          abi: DIPTOS_ESCROW_ABI,
          functionName: 'getEscrowView',
          args: [escrowIdBytes32],
        })) as {
          escrowId: Hex
          payer: Address
          payee: Address
          amount: bigint
          deadline: bigint
          createdAt: bigint
          fundedAt: bigint
          lambdaBps: bigint
          nonce: bigint
          isAgentMode: boolean
          status: number
          deliverableHash: Hex
        }
        if (v && v.payer !== '0x0000000000000000000000000000000000000000') {
          const statusMap: EscrowStatus[] = ['created', 'funded', 'verified', 'settled', 'refunded']
          const deadlineUnix = Number(v.deadline)
          const createdUnix = Number(v.createdAt || v.fundedAt)
          const deadlineHours =
            deadlineUnix > createdUnix ? Math.max(1, Math.round((deadlineUnix - createdUnix) / 3600)) : 24
          const lambdaBps = Number(v.lambdaBps)
          return {
            id: v.escrowId,
            escrowIdBytes32: v.escrowId,
            title: v.isAgentMode
              ? `AI Agent Escrow ${v.escrowId.slice(0, 10)}`
              : `Arc USDC Escrow ${v.escrowId.slice(0, 10)}`,
            scope: 'On-chain non-custodial escrow settled via Grok EIP-712 Oracle on Arc Testnet (5042002).',
            amountUsdc: Number(formatEther(v.amount)),
            deadline: deadlineUnix > 0 ? new Date(deadlineUnix * 1000).toISOString() : new Date().toISOString(),
            deadlineUnix,
            deadlineHours,
            mode: v.isAgentMode ? 'agent' : 'human',
            payer: v.payer,
            payee: v.payee,
            nonce: Number(v.nonce),
            tecdLambda: Number((lambdaBps / 10_000).toFixed(4)),
            tecdLambdaBps: lambdaBps,
            status: statusMap[v.status] ?? 'created',
            createdAt: createdUnix > 0 ? new Date(createdUnix * 1000).toISOString() : new Date().toISOString(),
            onChain: true,
          }
        }
      } catch {
        // Fall through to REST API
      }
    }
    const res = await fetch(`${this.apiBaseUrl}/api/escrows/${encodeURIComponent(escrowId)}`)
    if (!res.ok) throw new Error(`getEscrow failed (${res.status}): ${await res.text()}`)
    const data = (await res.json()) as { escrow: EscrowRecord }
    return data.escrow
  }

  async createEscrowLink(params: CreateEscrowParams): Promise<
    EscrowRecord & {
      escrow: EscrowRecord
      txIntent: {
        chainId: 5042002
        to: Address | null
        valueWei: string
        calldata: Hex
      }
      checkoutPath: string
      shareUrl: string
    }
  > {
    const title = params.title.trim()
    const scope = params.scope.trim()
    const amountUsdc = Number(params.amountUsdc)
    const deadlineHours = Math.max(0.03, Math.min(720, Number(params.deadlineHours ?? 24)))
    const mode: EscrowMode = params.mode === 'agent' ? 'agent' : 'human'
    const payee: Address =
      params.payee && /^0x[0-9a-fA-F]{40}$/.test(params.payee.trim())
        ? (params.payee.trim() as Address)
        : ('0x742d35Cc6634C0532925a3b844Bc454e4438f44e' as Address)
    const tecdLambda = Number.isFinite(Number(params.tecdLambda))
      ? Math.min(2.0, Math.max(0.05, Number(params.tecdLambda)))
      : 0.35

    const randHex = Array.from({ length: 10 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
    const slug = `esc_${randHex}`
    const escrowIdBytes32 = toEscrowBytes32(slug)
    const now = Date.now()
    const deadlineMs = now + Math.round(deadlineHours * 3600 * 1000)
    const deadlineUnix = Math.floor(deadlineMs / 1000)
    const tecdLambdaBps = Math.round(tecdLambda * 10_000)

    const calldata = encodeFunctionData({
      abi: DIPTOS_ESCROW_ABI,
      functionName: 'createEscrowLink',
      args: [escrowIdBytes32, payee, BigInt(deadlineUnix), BigInt(tecdLambdaBps), mode === 'agent'],
    })

    const qs = new URLSearchParams({
      title,
      scope,
      amount: String(amountUsdc),
      hours: String(deadlineHours),
      mode,
      payee,
      lambda: String(Number(tecdLambda.toFixed(4))),
    })
    const checkoutPath = `/pay/${escrowIdBytes32}?${qs.toString()}`
    const shareUrl = `https://app.diptos.xyz${checkoutPath}`

    const escrow: EscrowRecord = {
      id: escrowIdBytes32,
      escrowIdBytes32,
      title,
      scope,
      amountUsdc,
      deadline: new Date(deadlineMs).toISOString(),
      deadlineUnix,
      deadlineHours,
      mode,
      payee,
      tecdLambda: Number(tecdLambda.toFixed(4)),
      tecdLambdaBps,
      status: 'created',
      createdAt: new Date(now).toISOString(),
      onChain: false,
    }

    const txIntent = {
      chainId: 5042002 as const,
      to: this.escrowContract ?? null,
      valueWei: parseEther(String(amountUsdc)).toString(),
      calldata,
    }

    // Fire-and-forget notification to API endpoint without blocking instant link generation
    void fetch(`${this.apiBaseUrl}/api/escrows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    }).catch(() => {})

    return {
      ...escrow,
      escrow,
      txIntent,
      checkoutPath,
      shareUrl,
    }
  }

  async getLiveGeminiRisk(): Promise<GeminiRiskResult> {
    const res = await fetch(`${this.apiBaseUrl}/api/risk/gemini`)
    if (!res.ok) throw new Error(`getLiveGeminiRisk failed (${res.status}): ${await res.text()}`)
    return (await res.json()) as GeminiRiskResult
  }

  async previewTECDOnChain(params: {
    principalUsdc: number
    slaWindowSeconds: number
    delaySeconds: number
    lambda: number
    escrowContract?: Address
  }): Promise<OnChainTECDPreview> {
    const target = params.escrowContract ?? this.escrowContract
    if (!target) {
      const local = this.calculateTECD({
        principalUsdc: params.principalUsdc,
        lambda: params.lambda,
        delaySeconds: params.delaySeconds,
        totalDurationSeconds: params.slaWindowSeconds,
      })
      return {
        payeePayoutUsdc: local.payeePayoutUsdc,
        buyerRebateUsdc: local.buyerRebateUsdc,
        protocolFeeUsdc: local.protocolFeeUsdc,
        decayPercent: local.decayPercent,
        source: 'sdk-wad-fallback',
      }
    }
    const nowSec = BigInt(Math.floor(Date.now() / 1000))
    const deadlineUnix = nowSec + BigInt(Math.max(3600, Math.floor(params.slaWindowSeconds)))
    const simulatedTimestamp = deadlineUnix + BigInt(Math.max(0, Math.floor(params.delaySeconds)))
    const lambdaBps = BigInt(Math.round(params.lambda * 10_000))
    const amountWei = parseEther(String(params.principalUsdc))

    const [payeePayout, payerRebate, protocolFee, decayBps] = (await this.getPublicClient().readContract({
      address: target,
      abi: DIPTOS_ESCROW_ABI,
      functionName: 'previewTECDPayout',
      args: [amountWei, deadlineUnix, simulatedTimestamp, lambdaBps],
    })) as readonly [bigint, bigint, bigint, bigint]

    return {
      payeePayoutUsdc: Number(formatEther(payeePayout)),
      buyerRebateUsdc: Number(formatEther(payerRebate)),
      protocolFeeUsdc: Number(formatEther(protocolFee)),
      decayPercent: Number(decayBps) / 100,
      source: 'arc-eth-call',
    }
  }

  async previewTECDPayoutOnChain(params: {
    amountWei: bigint
    deadlineUnix: bigint
    simulatedTimestamp: bigint
    lambdaBps: bigint
    escrowContract?: Address
  }) {
    const target = params.escrowContract ?? this.escrowContract
    if (!target) throw new Error('escrowContract address is required')
    const [payeePayout, payerRebate, protocolFee, decayBps] = (await this.getPublicClient().readContract({
      address: target,
      abi: DIPTOS_ESCROW_ABI,
      functionName: 'previewTECDPayout',
      args: [params.amountWei, params.deadlineUnix, params.simulatedTimestamp, params.lambdaBps],
    })) as readonly [bigint, bigint, bigint, bigint]
    return { payeePayout, payerRebate, protocolFee, decayBps }
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
      body: JSON.stringify({
        ...params,
        deliverableNotes: params.deliverableNotes ?? params.notes,
      }),
    })
    if (!res.ok) {
      throw new Error(`verifyAndSignMilestone failed (${res.status}): ${await res.text()}`)
    }
    return (await res.json()) as GrokMilestoneReceipt
  }

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

export type TECDResult = CalculateTECDResult
export type GeminiRiskResponse = GeminiRiskResult
export type GrokAuditResponse = GrokMilestoneReceipt
export type ArcTelemetry = ArcTelemetryResult

export function createDiptosClient(config?: DiptosClientConfig): DiptosClient {
  return new DiptosClient(config)
}
