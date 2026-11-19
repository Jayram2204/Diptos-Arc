import { parseAbi } from 'viem'
import type { ContractKey } from './protocol'

export const DIPTOS_ESCROW_ABI = parseAbi([
  'function protocolFeeBps() view returns (uint256)',
  'function getEscrowCount() view returns (uint256)',
  'function getEscrowsPaginated(uint256 offset, uint256 limit) view returns ((bytes32 escrowId, address payer, address payee, uint256 amount, uint256 deadline, uint256 createdAt, uint256 fundedAt, uint256 lambdaBps, uint256 nonce, bool isAgentMode, uint8 status, bytes32 deliverableHash)[])',
  'function getEscrowView(bytes32 escrowId) view returns ((bytes32 escrowId, address payer, address payee, uint256 amount, uint256 deadline, uint256 createdAt, uint256 fundedAt, uint256 lambdaBps, uint256 nonce, bool isAgentMode, uint8 status, bytes32 deliverableHash))',
  'function createEscrowLink(bytes32 escrowId, address payee, uint256 deadline, uint256 lambdaBps, bool isAgentMode) payable',
  'function createMultiMilestoneEscrow(bytes32 escrowId, address payee, uint256[] amounts, uint256[] deadlines, uint256 lambdaBps, bool isAgentMode) payable',
  'function fundTestEscrow(bytes32 escrowId, address payee, uint256 deadline, uint256 lambdaBps, bool isAgentMode) payable',
  'function releaseWithOracle(bytes32 escrowId, uint256 milestoneIndex, bytes32 deliverableHash, uint256 expectedNonce, bytes grokSignature)',
  'function claimTimeoutRefund(bytes32 escrowId)',
  'function mutualCancel(bytes32 escrowId)',
  'function faucetMint()',
  'function previewTECDPayout(uint256 amount, uint256 deadline, uint256 simulatedTimestamp, uint256 lambdaBps) view returns (uint256 payeePayout, uint256 payerRebate, uint256 protocolFee, uint256 decayBps)',
  'function previewTECD(bytes32 escrowId, uint256 atTimestamp) view returns (uint256 payeePayout, uint256 payerRebate, uint256 protocolFee, uint256 decayBps)',
  'function oracleSigner() view returns (address)',
  'function PROTOCOL_FEE_BPS() view returns (uint256)',
  'event EscrowCreated(bytes32 indexed escrowId, address indexed payer, address indexed payee, uint256 amount, uint256 deadline, uint256 lambdaBps, uint256 milestoneCount, bool isAgentMode)',
  'event MilestoneSettled(bytes32 indexed escrowId, uint256 indexed milestoneIndex, address indexed payee, uint256 payeePayout, uint256 payerRebate, uint256 protocolFee, bytes32 deliverableHash, uint256 nonceUsed)',
  'event TECDPenaltyApplied(bytes32 indexed escrowId, uint256 indexed milestoneIndex, uint256 delaySeconds, uint256 decayBps, uint256 payerRebate, uint256 payeePayout)',
  'event FloatYieldSettled(bytes32 indexed escrowId, uint256 indexed milestoneIndex, uint256 lockDurationSeconds, uint256 accruedYieldBps, uint256 notionalYieldWei)',
  'event TimeoutRefunded(bytes32 indexed escrowId, address indexed payer, uint256 refundedAmount, uint256 milestonesRefunded)',
])

export const DIPTOS_REGISTRY_ABI = parseAbi([
  'function totalEscrows() view returns (uint256)',
  'function totalSettledMilestones() view returns (uint256)',
  'function totalVolumeWei() view returns (uint256)',
  'function canonicalHashes(bytes32) view returns (bool)',
  'function computeCanonicalHash(bytes32 escrowId, address payer, address payee, uint256 amount, uint256 deadline) pure returns (bytes32)',
  'function getCounterpartyStats(address payee) view returns ((uint256 completedOnTime, uint256 completedLate, uint256 totalVolumeSettled, uint256 totalLatencySeconds, uint256 averageLatencySeconds))',
  'event CanonicalCommitmentRecorded(bytes32 indexed escrowId, bytes32 indexed canonicalHash, address indexed payer, address payee, uint256 amount, uint256 deadline)',
  'event CounterpartySettlementRecorded(bytes32 indexed escrowId, address indexed payee, uint256 volumeSettled, uint256 latencySeconds, bool onTime, uint256 averageLatencySeconds)',
])

export const ARC_USDC_ABI = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
])

export const ABIS: Record<ContractKey, readonly unknown[]> = {
  DiptosEscrow: DIPTOS_ESCROW_ABI,
  DiptosRegistry: DIPTOS_REGISTRY_ABI,
  ArcUSDC: ARC_USDC_ABI,
}
