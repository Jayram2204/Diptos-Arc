import {
  type Address,
  createPublicClient,
  defineChain,
  encodeAbiParameters,
  fallback,
  type Hex,
  http,
  keccak256,
  type PublicClient,
  stringToHex,
} from 'viem'
import { ABIS } from '@/config/abis'
import {
  ARC_CHAIN_ID,
  ARC_EXPLORER_URL,
  ARC_FALLBACK_RPC_URL,
  ARC_NATIVE_DECIMALS,
  ARC_NATIVE_SYMBOL,
  ARC_RPC_URL,
  type ContractKey,
  contractAddress,
} from '@/config/protocol'

export const arcTestnet = defineChain({
  id: ARC_CHAIN_ID,
  name: 'Arc Testnet',
  nativeCurrency: {
    name: 'USDC',
    symbol: ARC_NATIVE_SYMBOL,
    decimals: ARC_NATIVE_DECIMALS,
  },
  rpcUrls: {
    default: { http: [ARC_RPC_URL, ARC_FALLBACK_RPC_URL] },
  },
  blockExplorers: {
    default: { name: 'ArcScan', url: ARC_EXPLORER_URL },
  },
  testnet: true,
})

let cachedClient: PublicClient | null = null

export function publicClient(): PublicClient {
  if (!cachedClient) {
    cachedClient = createPublicClient({
      chain: arcTestnet,
      transport: fallback([
        http(ARC_RPC_URL, { timeout: 6000 }),
        http(ARC_FALLBACK_RPC_URL, { timeout: 6000 }),
      ]),
    }) as PublicClient
  }
  return cachedClient
}

export const explorerUrl = (kind: 'address' | 'tx' | 'block', value: string | bigint) =>
  `${ARC_EXPLORER_URL}/${kind}/${value.toString()}`

export async function readProtocol<T>(
  key: ContractKey,
  functionName: string,
  args: readonly unknown[] = [],
): Promise<T> {
  const address = contractAddress(key)
  return (await publicClient().readContract({
    address,
    abi: ABIS[key],
    functionName,
    args,
  } as never)) as T
}

export function canonicalEscrowHash(
  escrowId: string,
  payer: Address,
  payee: Address,
  amountWei: bigint,
  deadlineUnix: bigint,
): Hex {
  const idBytes32 =
    escrowId.startsWith('0x') && escrowId.length === 66
      ? (escrowId as Hex)
      : keccak256(stringToHex(`diptos:arc:5042002:${escrowId}`))

  return keccak256(
    encodeAbiParameters(
      [
        { type: 'bytes32' },
        { type: 'address' },
        { type: 'address' },
        { type: 'uint256' },
        { type: 'uint256' },
      ],
      [idBytes32, payer, payee, amountWei, deadlineUnix],
    ),
  )
}

export const shortHex = (h?: string | null, head = 6, tail = 4) => {
  if (!h || typeof h !== 'string') return ''
  return h.length <= head + tail + 2 ? h : `${h.slice(0, head)}…${h.slice(-tail)}`
}

export const fmtAmount = (n: number, digits = 2) =>
  n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
