import { type Address, isAddress } from 'viem'

export const ARC_CHAIN_ID = 5042002 as const
export const ARC_RPC_URL = 'https://rpc.testnet.arc.network'
export const ARC_FALLBACK_RPC_URL = 'https://rpc.solidrpc.io/public/evm/5042002'
export const ARC_EXPLORER_URL = 'https://testnet.arcscan.app'
export const ARC_NATIVE_SYMBOL = 'USDC'
export const ARC_NATIVE_DECIMALS = 18

export type ContractKey = 'DiptosEscrow' | 'DiptosRegistry'

export interface ContractMeta {
  key: ContractKey
  file: string
  role: string
  standard: string
  address: Address
}

const DEFAULT_ESCROW_ADDRESS: Address = '0xb49B4C64f7A162B45eF3eDA11B55030A97ddfE08'
const DEFAULT_REGISTRY_ADDRESS: Address = '0xAe046d40bcAb56128D34588e10b6D7F166485bA5'

function resolveAddress(envValue: string | undefined, fallbackAddr: Address): Address {
  const trimmed = envValue?.trim()
  return trimmed && isAddress(trimmed) ? trimmed : fallbackAddr
}

export const ESCROW_CONTRACT_ADDRESS: Address = resolveAddress(
  import.meta.env.VITE_ESCROW_CONTRACT_ADDRESS,
  DEFAULT_ESCROW_ADDRESS,
)

export const REGISTRY_CONTRACT_ADDRESS: Address = resolveAddress(
  import.meta.env.VITE_REGISTRY_CONTRACT_ADDRESS,
  DEFAULT_REGISTRY_ADDRESS,
)

/** Legitimate smart contracts authored and deployed by Diptos on Arc Testnet (5042002). */
export const CONTRACTS: ContractMeta[] = [
  {
    key: 'DiptosEscrow',
    file: 'DiptosEscrow.sol',
    role: 'Non-custodial native 18-dec USDC escrow, EIP-712 Grok oracle release & WAD TECD decay',
    standard: 'DvP + TECD',
    address: ESCROW_CONTRACT_ADDRESS,
  },
  {
    key: 'DiptosRegistry',
    file: 'DiptosRegistry.sol',
    role: 'Canonical keccak256 commitment ledger & on-chain counterparty reliability telemetry',
    standard: 'Anti-Double-Spend',
    address: REGISTRY_CONTRACT_ADDRESS,
  },
]

export function contractAddress(key: ContractKey): Address {
  return key === 'DiptosEscrow' ? ESCROW_CONTRACT_ADDRESS : REGISTRY_CONTRACT_ADDRESS
}

export const ARC_NETWORK = {
  chainId: ARC_CHAIN_ID,
  label: 'Arc Testnet',
  short: 'Arc Testnet • 5042002',
  rpcUrl: ARC_RPC_URL,
  fallbackRpcUrl: ARC_FALLBACK_RPC_URL,
  explorerUrl: ARC_EXPLORER_URL,
  nativeCurrency: ARC_NATIVE_SYMBOL,
} as const

export const LINKS = {
  explorer: ARC_EXPLORER_URL,
  circleFaucet: 'https://faucet.circle.com',
  sdkDocs: 'https://sdk.diptos.xyz',
} as const
