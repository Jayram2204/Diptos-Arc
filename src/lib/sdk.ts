import { DiptosClient } from '@diptos/sdk'
import {
  ARC_CHAIN_ID,
  ARC_FALLBACK_RPC_URL,
  ARC_RPC_URL,
  ESCROW_CONTRACT_ADDRESS,
  REGISTRY_CONTRACT_ADDRESS,
} from '@/config/protocol'

export const diptos = new DiptosClient({
  rpcUrl: ARC_RPC_URL,
  fallbackRpcUrl: ARC_FALLBACK_RPC_URL,
  chainId: ARC_CHAIN_ID,
  escrowAddress: ESCROW_CONTRACT_ADDRESS,
  registryAddress: REGISTRY_CONTRACT_ADDRESS,
  apiBaseUrl: '',
})

export type {
  ArcTelemetryResult,
  BuiltTxPayload,
  BytecodeVerificationResult,
  CalculateTECDResult,
  EscrowMode,
  EscrowRecord,
  EscrowStatus,
  GeminiContractSnapshot,
  GeminiRiskResult,
  GrokAuditRecord,
  GrokMilestoneReceipt,
  OnChainTECDPreview,
  OracleStatusResult,
  ProtocolEvent,
} from '@diptos/sdk'
