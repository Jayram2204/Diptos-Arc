import {
  type Address,
  createPublicClient,
  formatEther,
  formatUnits,
  http,
  parseAbi,
} from 'viem'
import { ARC_CHAIN_ID, ARC_RPC_URL } from '@/config/protocol'

export interface UnifiedSourceChain {
  chainId: number
  key: 'base-sepolia' | 'arbitrum-sepolia' | 'optimism-sepolia'
  name: string
  shortName: string
  rpcUrl: string
  usdcAddress: Address
  cctpDomain: number
}

export const UNIFIED_SOURCE_CHAINS: readonly UnifiedSourceChain[] = [
  {
    chainId: 84532,
    key: 'base-sepolia',
    name: 'Base Sepolia',
    shortName: 'Base',
    rpcUrl: 'https://sepolia.base.org',
    usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    cctpDomain: 6,
  },
  {
    chainId: 421614,
    key: 'arbitrum-sepolia',
    name: 'Arbitrum Sepolia',
    shortName: 'Arbitrum',
    rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
    usdcAddress: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
    cctpDomain: 3,
  },
  {
    chainId: 11155420,
    key: 'optimism-sepolia',
    name: 'OP Sepolia',
    shortName: 'Optimism',
    rpcUrl: 'https://sepolia.optimism.io',
    usdcAddress: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7',
    cctpDomain: 2,
  },
] as const

const ERC20_BALANCE_ABI = parseAbi(['function balanceOf(address owner) view returns (uint256)'])

export interface ChainBalanceItem {
  chainId: number
  name: string
  shortName: string
  usdcBalance: number
  formatted: string
  reachable: boolean
}

export interface UnifiedBalanceSnapshot {
  address: Address
  gatewayApiUrl: string
  totalUsdc: number
  arcNativeUsdc: number
  chains: ChainBalanceItem[]
  fetchedAt: string
}

export interface UnifiedFundingPlan {
  route: 'arc-direct' | 'circle-gateway-spend' | 'cctp-bridge-kit'
  sourceChain: UnifiedSourceChain | null
  destinationChainId: typeof ARC_CHAIN_ID
  destinationAddress: Address
  amountUsdc: number
  estimatedFinality: string
  steps: string[]
}

export function getGatewayApiUrl(): string {
  return (
    (import.meta.env.VITE_CIRCLE_GATEWAY_API_URL as string | undefined)?.trim() ||
    'https://gateway-api-testnet.circle.com/v1'
  )
}

/**
 * Fetches live multi-chain USDC balances across Arc Testnet (18-dec native USDC)
 * and Circle Gateway / CCTP source chains (6-dec ERC-20 USDC on Base, Arbitrum, OP).
 */
export async function fetchUnifiedUsdcBalance(address: Address): Promise<UnifiedBalanceSnapshot> {
  const arcClient = createPublicClient({ transport: http(ARC_RPC_URL, { timeout: 6000 }) })

  const [arcBalWei, sourceBalances] = await Promise.all([
    arcClient.getBalance({ address }).catch(() => 0n),
    Promise.all(
      UNIFIED_SOURCE_CHAINS.map(async (chain): Promise<ChainBalanceItem> => {
        try {
          const client = createPublicClient({ transport: http(chain.rpcUrl, { timeout: 5500 }) })
          const raw = await client.readContract({
            address: chain.usdcAddress,
            abi: ERC20_BALANCE_ABI,
            functionName: 'balanceOf',
            args: [address],
          })
          const num = Number(formatUnits(raw, 6))
          return {
            chainId: chain.chainId,
            name: chain.name,
            shortName: chain.shortName,
            usdcBalance: num,
            formatted: num.toFixed(2),
            reachable: true,
          }
        } catch {
          return {
            chainId: chain.chainId,
            name: chain.name,
            shortName: chain.shortName,
            usdcBalance: 0,
            formatted: '0.00',
            reachable: false,
          }
        }
      }),
    ),
  ])

  const arcNativeUsdc = Number(formatEther(arcBalWei))
  const totalUsdc = arcNativeUsdc + sourceBalances.reduce((acc, c) => acc + c.usdcBalance, 0)

  return {
    address,
    gatewayApiUrl: getGatewayApiUrl(),
    totalUsdc,
    arcNativeUsdc,
    chains: sourceBalances,
    fetchedAt: new Date().toISOString(),
  }
}

/**
 * Produces an exact, non-custodial Circle Gateway / CCTP funding plan into Arc Testnet (5042002).
 */
export function planUnifiedArcFunding(params: {
  snapshot: UnifiedBalanceSnapshot | null
  sourceChainId: number
  amountUsdc: number
  destinationAddress: Address
}): UnifiedFundingPlan {
  const source = UNIFIED_SOURCE_CHAINS.find((c) => c.chainId === params.sourceChainId) ?? UNIFIED_SOURCE_CHAINS[0]
  const arcBal = params.snapshot?.arcNativeUsdc ?? 0

  if (arcBal >= params.amountUsdc && params.amountUsdc > 0) {
    return {
      route: 'arc-direct',
      sourceChain: null,
      destinationChainId: ARC_CHAIN_ID,
      destinationAddress: params.destinationAddress,
      amountUsdc: params.amountUsdc,
      estimatedFinality: '<1s on Arc',
      steps: [
        `Arc native USDC balance (${arcBal.toFixed(2)} USDC) already covers ${params.amountUsdc.toFixed(2)} USDC.`,
        'Lock directly into DiptosEscrow.sol on Arc Testnet (5042002) in 1 click.',
      ],
    }
  }

  const sourceItem = params.snapshot?.chains.find((c) => c.chainId === source.chainId)
  const hasGatewayConfigured = Boolean(
    (import.meta.env.VITE_CIRCLE_GATEWAY_API_URL as string | undefined)?.trim(),
  )

  if (hasGatewayConfigured) {
    return {
      route: 'circle-gateway-spend',
      sourceChain: source,
      destinationChainId: ARC_CHAIN_ID,
      destinationAddress: params.destinationAddress,
      amountUsdc: params.amountUsdc,
      estimatedFinality: '<500ms via Circle Gateway',
      steps: [
        `Sign single Circle Gateway spend() intent for ${params.amountUsdc.toFixed(2)} USDC from ${source.name} (${sourceItem?.formatted ?? '0.00'} USDC detected).`,
        'Circle Gateway mints native USDC on Arc Testnet (5042002) with no manual bridge step.',
        'DiptosEscrow.sol locks native USDC under canonical keccak256 commitment.',
      ],
    }
  }

  return {
    route: 'cctp-bridge-kit',
    sourceChain: source,
    destinationChainId: ARC_CHAIN_ID,
    destinationAddress: params.destinationAddress,
    amountUsdc: params.amountUsdc,
    estimatedFinality: '~15–30s via Circle CCTP',
    steps: [
      `Burn ${params.amountUsdc.toFixed(2)} USDC on ${source.name} (CCTP Domain ${source.cctpDomain}, balance: ${sourceItem?.formatted ?? '0.00'} USDC).`,
      'Fetch Circle Iris attestation and mint native USDC on Arc Testnet (5042002).',
      'Execute 1-click lock into DiptosEscrow.sol with automatic TECD protection.',
    ],
  }
}
