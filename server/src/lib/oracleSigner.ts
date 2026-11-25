import {
  type Address,
  createPublicClient,
  defineChain,
  fallback,
  type Hex,
  http,
  isAddress,
  parseAbi,
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

const LIVE_ARC_ESCROW: Address = '0xA7d2f5c4A13C75c05A73F46B49d33fD81E41646C'
const LIVE_ARC_REGISTRY: Address = '0x823480419bbC57799391e751Edb6C4CeA6b51fbB'

const LEGACY_ADDRESSES = new Set([
  '0xb49b4c64f7a162b45ef3eda11b55030a97ddfe08',
  '0xae046d40bcab56128d34588e10b6d7f166485ba5',
])

export function getEscrowContractAddress(): Address {
  const addr = (
    process.env.ARC_ESCROW_CONTRACT_ADDRESS ||
    process.env.VITE_ESCROW_CONTRACT_ADDRESS ||
    ''
  ).trim()
  if (!addr || !isAddress(addr) || LEGACY_ADDRESSES.has(addr.toLowerCase())) {
    return LIVE_ARC_ESCROW
  }
  return addr
}

export function getRegistryContractAddress(): Address {
  const addr = (
    process.env.ARC_REGISTRY_CONTRACT_ADDRESS ||
    process.env.VITE_REGISTRY_CONTRACT_ADDRESS ||
    ''
  ).trim()
  if (!addr || !isAddress(addr) || LEGACY_ADDRESSES.has(addr.toLowerCase())) {
    return LIVE_ARC_REGISTRY
  }
  return addr
}

export function getOracleAccount() {
  const pk = (process.env.GROK_ORACLE_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY || '').trim()
  if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk)) return null
  return privateKeyToAccount(pk as Hex)
}

export const RELEASE_ESCROW_TYPES = {
  ReleaseEscrow: [
    { name: 'escrowId', type: 'bytes32' },
    { name: 'deliverableHash', type: 'bytes32' },
    { name: 'nonce', type: 'uint256' },
  ],
} as const

export interface SignMilestoneInput {
  escrowId: Hex
  milestoneIndex?: bigint
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
      version: '1',
      chainId: ARC_CHAIN_ID,
      verifyingContract,
    },
    types: RELEASE_ESCROW_TYPES,
    primaryType: 'ReleaseEscrow',
    message: {
      escrowId: input.escrowId,
      deliverableHash: input.deliverableHash,
      nonce: input.nonce,
    },
  })

  sessionAttestations += 1
  return { signature, oracleSigner: account.address }
}

const ORACLE_SIGNER_ABI = parseAbi(['function oracleSigner() view returns (address)'])

export async function getOracleStatus() {
  const account = getOracleAccount()
  const escrowContract = getEscrowContractAddress()
  let latestArcBlock: number | null = null
  let onChainOracleSigner: Address | null = null
  let rpcError: string | null = null

  try {
    const [num, onChainSigner] = await Promise.all([
      arcPublicClient.getBlockNumber(),
      arcPublicClient
        .readContract({
          address: escrowContract,
          abi: ORACLE_SIGNER_ABI,
          functionName: 'oracleSigner',
        })
        .catch(() => null),
    ])
    latestArcBlock = Number(num)
    onChainOracleSigner = onChainSigner as Address | null
  } catch (e) {
    rpcError = (e as Error).message.split('\n')[0]
  }

  const signerAddress = account?.address ?? null
  const matches = Boolean(
    signerAddress &&
      onChainOracleSigner &&
      signerAddress.toLowerCase() === onChainOracleSigner.toLowerCase(),
  )

  return {
    chainId: ARC_CHAIN_ID,
    network: 'Arc Testnet',
    rpcUrl: ARC_RPC_PRIMARY,
    signerAddress,
    onChainOracleSigner,
    matches,
    oracleSigner: signerAddress ?? onChainOracleSigner,
    eip712Domain: {
      name: 'DiptosEscrow',
      version: '1',
      chainId: ARC_CHAIN_ID,
      verifyingContract: escrowContract,
    },
    latestArcBlock,
    rpcError,
    totalAttestationsSigned: sessionAttestations,
  }
}
