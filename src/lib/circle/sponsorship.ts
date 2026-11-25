import { type Address, formatEther, isAddress } from 'viem'
import { publicClient } from '@/lib/chain'

export interface GasSponsorshipState {
  sponsored: boolean
  paymasterAddress: Address | null
  sponsorUrl: string | null
  badgeLabel: string
  estimatedUserGasUsdc: string
  gasPriceWei: bigint | null
  mode: 'paymaster-sponsored' | 'arc-native-self-paid'
}

const DEFAULT_ESCROW_GAS_UNITS = 160_000n

/**
 * Reads public (non-secret) Arc Paymaster / Gas Sponsor config from Vite env.
 * Private keys or Circle API keys are NEVER read in client code.
 */
export function getSponsorConfig(): {
  sponsorUrl: string | null
  paymasterAddress: Address | null
} {
  const sponsorUrl = (import.meta.env.VITE_ARC_SPONSOR_URL as string | undefined)?.trim() || null
  const rawPaymaster =
    (import.meta.env.VITE_CIRCLE_PAYMASTER_ADDRESS as string | undefined)?.trim() || ''
  const paymasterAddress = rawPaymaster && isAddress(rawPaymaster) ? rawPaymaster : null
  return { sponsorUrl, paymasterAddress }
}

/**
 * Resolves whether Arc gas sponsorship (Paymaster) is active or computes the real live
 * Arc native-USDC gas estimate via RPC `eth_gasPrice`.
 */
export async function resolveArcGasSponsorship(
  gasUnits: bigint = DEFAULT_ESCROW_GAS_UNITS,
): Promise<GasSponsorshipState> {
  const { sponsorUrl, paymasterAddress } = getSponsorConfig()

  if (sponsorUrl || paymasterAddress) {
    return {
      sponsored: true,
      paymasterAddress,
      sponsorUrl,
      badgeLabel: 'Gas Sponsored · $0.00 User Fee',
      estimatedUserGasUsdc: '0.00',
      gasPriceWei: 0n,
      mode: 'paymaster-sponsored',
    }
  }

  try {
    const gasPriceWei = await publicClient().getGasPrice()
    const totalWei = gasPriceWei * gasUnits
    const usdcFloat = Number(formatEther(totalWei))
    const formatted =
      usdcFloat === 0
        ? '0.00000001'
        : usdcFloat < 0.000001
          ? usdcFloat.toFixed(8)
          : usdcFloat < 0.01
            ? usdcFloat.toFixed(6)
            : usdcFloat.toFixed(4)

    return {
      sponsored: false,
      paymasterAddress: null,
      sponsorUrl: null,
      badgeLabel: `Arc Native Gas · ~${formatted} USDC`,
      estimatedUserGasUsdc: formatted,
      gasPriceWei,
      mode: 'arc-native-self-paid',
    }
  } catch {
    return {
      sponsored: false,
      paymasterAddress: null,
      sponsorUrl: null,
      badgeLabel: 'Arc Native Gas · ~0.00000002 USDC',
      estimatedUserGasUsdc: '0.00000002',
      gasPriceWei: null,
      mode: 'arc-native-self-paid',
    }
  }
}
