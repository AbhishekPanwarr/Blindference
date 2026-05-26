import { ReineiraSDK, walletClientToSigner, publicClientToProvider, injectCofhe } from '@reineira-os/sdk'
import type { WalletClient, PublicClient } from 'viem'
import type { CofheClient } from '../lib/cofhe'

let cachedSdk: ReineiraSDK | null = null

/**
 * Compute aggressive EIP-1559 gas parameters to avoid
 * `maxFeePerGas < baseFee` failures on Arbitrum Sepolia.
 */
async function getFeeParams(signer: any) {
  try {
    const provider = signer.provider
    if (!provider) {
      return { maxFeePerGas: 1000000000n, maxPriorityFeePerGas: 2000000n }
    }
    const block = await provider.getBlock('latest')
    const baseFee = block?.baseFeePerGas ?? 0n
    let priorityFee = 2000000n
    try {
      const feeData = await provider.getFeeData()
      if (feeData.maxPriorityFeePerGas != null && feeData.maxPriorityFeePerGas > 0n) {
        priorityFee = feeData.maxPriorityFeePerGas
      }
    } catch {}
    if (baseFee != null && baseFee > 0n) {
      const maxFee = baseFee * 10n + priorityFee + 1000000n
      return { maxFeePerGas: maxFee, maxPriorityFeePerGas: priorityFee }
    }
    return { maxFeePerGas: 1000000000n, maxPriorityFeePerGas: 2000000n }
  } catch (e) {
    return { maxFeePerGas: 1000000000n, maxPriorityFeePerGas: 2000000n }
  }
}

/**
 * Monkey-patch an ethers signer so every transaction carries our
 * own EIP-1559 gas overrides. This bypasses any stale SDK gas logic.
 */
function patchSigner(signer: any) {
  const original = signer.sendTransaction.bind(signer)
  signer.sendTransaction = async function (tx: any) {
    const gas = await getFeeParams(signer)
    const patched = {
      ...tx,
      maxFeePerGas: gas.maxFeePerGas,
      maxPriorityFeePerGas: gas.maxPriorityFeePerGas,
      type: 2,
    }
    return original(patched)
  }
  return signer
}

/**
 * Create a Reineira SDK instance from wagmi viem clients.
 * Injects an existing CoFHE client to skip redundant FHE initialization.
 */
export async function getReineiraSdk(
  walletClient: WalletClient,
  publicClient: PublicClient,
  cofheClient: CofheClient | null,
): Promise<ReineiraSDK> {
  if (cachedSdk) {
    return cachedSdk
  }

  const signer = await walletClientToSigner(walletClient as any)
  patchSigner(signer)

  const provider = publicClientToProvider(publicClient as any)

  const sdk = ReineiraSDK.create({
    network: 'testnet',
    signer,
    provider,
  })

  // Inject existing CoFHE client to bypass the SDK's own (node-targeted) init
  if (cofheClient) {
    injectCofhe(cofheClient)
  }

  // Still call initialize so the SDK marks itself ready
  await sdk.initialize()

  cachedSdk = sdk
  return sdk
}

export function clearReineiraSdkCache() {
  cachedSdk = null
}
