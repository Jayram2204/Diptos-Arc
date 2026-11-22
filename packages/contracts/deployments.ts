import deploymentsJson from './deployments.json'

export type ChainStatus = 'live' | 'ready'

export interface DiptosChainDeployment {
  id: number
  key: string
  name: string
  shortName: string
  status: ChainStatus
  nativeCurrency: { name: string; symbol: string; decimals: number }
  rpcUrls: readonly string[]
  explorerUrl: string
  contracts: {
    DiptosEscrow: `0x${string}` | null
    DiptosRegistry: `0x${string}` | null
    USDC: `0x${string}`
  }
  deployBlock?: number
}

export const DEFAULT_CHAIN_ID = deploymentsJson.defaultChainId as 5042002

export const DIPTOS_DEPLOYMENTS: Record<number, DiptosChainDeployment> =
  deploymentsJson.chains as unknown as Record<number, DiptosChainDeployment>

export const SUPPORTED_CHAINS: DiptosChainDeployment[] = Object.values(DIPTOS_DEPLOYMENTS)

export function getChainDeployment(chainId: number): DiptosChainDeployment | undefined {
  return DIPTOS_DEPLOYMENTS[chainId]
}
