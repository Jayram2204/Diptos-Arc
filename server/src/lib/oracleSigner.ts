import {
  type Address,
  createPublicClient,
  defineChain,
  fallback,
  type Hex,
  http,
  isAddress,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

export const ARC_CHAIN_ID = 5042002 as const
export const ARC_RPC_PRIMARY = process.env.ARC_RPC_URL?.trim() || 'https://rpc.testnet.arc.network'
export const ARC_RPC_FALLBACK = 'https://rpc.solidrpc.io/public/evm/5042002'

export const arcTestnetChain = defineChain({
  id: ARC_CHAIN_ID,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: [ARC_RPC_PRIMARY, ARC_RPC_FALLBACK] } },
  blockExplorers: { default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' } },
  testnet: true,
})

export const arcPublicClient = createPublicClient({
  chain: arcTestnetChain,
  transport: fallback([
    http(ARC_RPC_PRIMARY, { timeout: 6000 }),
    http(ARC_RPC_FALLBACK, { timeout: 6000 }),
  ]),
})

const LIVE_ARC_ESCROW: Address = '0xb49B4C64f7A162B45eF3eDA11B55030A97ddfE08'
const LIVE_ARC_REGISTRY: Address = '0xAe046d40bcAb56128D34588e10b6D7F166485bA5'

export function getEscrowContractAddress(): Address {
  const addr = (
    process.env.ARC_ESCROW_CONTRACT_ADDRESS ||
    process.env.VITE_ESCROW_CONTRACT_ADDRESS ||
    ''
  ).trim()
  return isAddress(addr) ? addr : LIVE_ARC_ESCROW
}

export function getRegistryContractAddress(): Address {
  const addr = (
    process.env.ARC_REGISTRY_CONTRACT_ADDRESS ||
    process.env.VITE_REGISTRY_CONTRACT_ADDRESS ||
    ''
  ).trim()
  return isAddress(addr) ? addr : LIVE_ARC_REGISTRY
}

export function getOracleAccount() {
  const pk = process.env.GROK_ORACLE_PRIVATE_KEY?.trim()
  if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk)) return null
  return privateKeyToAccount(pk as Hex)
}

export const RELEASE_MILESTONE_TYPES = {
  ReleaseMilestone: [
    { name: 'escrowId', type: 'bytes32' },
    { name: 'milestoneIndex', type: 'uint256' },
    { name: 'deliverableHash', type: 'bytes32' },
    { name: 'nonce', type: 'uint256' },
    { name: 'chainId', type: 'uint256' },
  ],
} as const

export interface SignMilestoneInput {
  escrowId: Hex
  milestoneIndex: bigint
  deliverableHash: Hex
  nonce: bigint
}

let sessionAttestations = 0

export async function signMilestoneReleaseEIP712(
  input: SignMilestoneInput,
): Promise<{ signature: Hex; oracleSigner: Address } | null> {
  const account = getOracleAccount()
  const verifyingContract = getEscrowContractAddress()
  if (!account || !verifyingContract) return null

  const signature = await account.signTypedData({
    domain: {
      name: 'DiptosEscrow',
      version: '2',
      chainId: ARC_CHAIN_ID,
      verifyingContract,
    },
    types: RELEASE_MILESTONE_TYPES,
    primaryType: 'ReleaseMilestone',
    message: {
      escrowId: input.escrowId,
      milestoneIndex: input.milestoneIndex,
      deliverableHash: input.deliverableHash,
      nonce: input.nonce,
      chainId: BigInt(ARC_CHAIN_ID),
    },
  })

  sessionAttestations += 1
  return { signature, oracleSigner: account.address }
}

export async function getOracleStatus() {
  const account = getOracleAccount()
  let latestArcBlock: number | null = null
  let rpcError: string | null = null

  try {
    const num = await arcPublicClient.getBlockNumber()
    latestArcBlock = Number(num)
  } catch (e) {
    rpcError = (e as Error).message.split('\n')[0]
  }

  return {
    chainId: ARC_CHAIN_ID,
    network: 'Arc Testnet',
    rpcUrl: ARC_RPC_PRIMARY,
    oracleSigner: account?.address ?? null,
    eip712Domain: {
      name: 'DiptosEscrow',
      version: '2',
      chainId: ARC_CHAIN_ID,
      verifyingContract: getEscrowContractAddress(),
    },
    latestArcBlock,
    rpcError,
    totalAttestationsSigned: sessionAttestations,
  }
}
