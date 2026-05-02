import { parseAbi, type Hex, type PublicClient, type WalletClient } from 'viem'

import type { EncryptedItemInput } from '../lib/cofhe'

const promptKeyStoreAbi = parseAbi([
  'function storeKey(bytes32 jobId, (uint256 ctHash, uint8 securityZone, uint8 utype, bytes signature) encHigh, (uint256 ctHash, uint8 securityZone, uint8 utype, bytes signature) encLow, address[] allowedNodes)',
])

type StorePromptKeyArgs = {
  taskId: Hex
  encryptedHighInput: EncryptedItemInput
  encryptedLowInput: EncryptedItemInput
  allowedNodes: Hex[]
  promptKeyStoreAddress: Hex
  publicClient: PublicClient
  walletClient: WalletClient
}

export async function storePromptKeyForTextRequest({
  taskId,
  encryptedHighInput,
  encryptedLowInput,
  allowedNodes,
  promptKeyStoreAddress,
  publicClient,
  walletClient,
}: StorePromptKeyArgs): Promise<Hex> {
  if (!walletClient.account) {
    throw new Error('Wallet client is missing the active account.')
  }

  const toContractInput = (item: EncryptedItemInput) => ({
    ctHash: item.ctHash,
    securityZone: item.securityZone ?? 0,
    utype: Number(item.utype),
    signature: item.signature as Hex,
  })

  const latestBlock = await publicClient.getBlock({ blockTag: 'latest' })
  const fallbackPriorityFeePerGas = 2_000_000n
  const maxPriorityFeePerGas = await publicClient
    .estimateMaxPriorityFeePerGas()
    .catch(() => fallbackPriorityFeePerGas)
  const priorityFeePerGas = maxPriorityFeePerGas > 0n ? maxPriorityFeePerGas : fallbackPriorityFeePerGas
  const baseFeePerGas = latestBlock.baseFeePerGas
  const feeParams =
    baseFeePerGas != null
      ? {
          maxPriorityFeePerGas: priorityFeePerGas,
          maxFeePerGas: baseFeePerGas * 2n + priorityFeePerGas + 1_000_000n,
        }
      : {
          gasPrice: await publicClient.getGasPrice(),
        }

  const hash = await walletClient.writeContract({
    account: walletClient.account,
    address: promptKeyStoreAddress,
    abi: promptKeyStoreAbi,
    chain: walletClient.chain,
    functionName: 'storeKey',
    args: [
      taskId,
      toContractInput(encryptedHighInput),
      toContractInput(encryptedLowInput),
      allowedNodes,
    ],
    ...feeParams,
  })

  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') {
    throw new Error(`PromptKeyStore transaction failed for task ${taskId}.`)
  }

  return hash
}
