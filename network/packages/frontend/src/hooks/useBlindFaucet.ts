import { useCallback, useState } from 'react'
import { useAccount, useWalletClient, usePublicClient } from 'wagmi'
import { Hex, parseAbi } from 'viem'
import { arbitrumSepolia } from 'wagmi/chains'

const FAUCET_ADDRESS = (import.meta.env.VITE_FAUCET_ADDRESS || '0xb55e8A064B9abBfFA588063e5DF69Fa1f1175616') as Hex

export function useBlindFaucet() {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [lastDripTime, setLastDripTime] = useState<bigint | null>(null)

  const fetchLastDripTime = useCallback(async () => {
    if (!address || !publicClient || !FAUCET_ADDRESS) return
    try {
      const result = await publicClient.readContract({
        address: FAUCET_ADDRESS,
        abi: parseAbi(['function lastDripTime(address) view returns (uint256)']),
        functionName: 'lastDripTime',
        args: [address],
      } as any)
      setLastDripTime(result as bigint)
    } catch {
      setLastDripTime(null)
    }
  }, [address, publicClient])

  const drip = useCallback(async () => {
    if (!address || !walletClient || !publicClient) {
      setError('Connect your wallet first')
      return
    }
    if (!FAUCET_ADDRESS) {
      setError('Faucet address not configured')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      // Dynamic EIP-1559 gas estimation (fixes "max fee per gas less than block base fee")
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

      const txHash = await walletClient.writeContract({
        account: address,
        chain: arbitrumSepolia,
        address: FAUCET_ADDRESS,
        abi: parseAbi(['function drip()']),
        functionName: 'drip',
        ...feeParams,
      })

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
      if (receipt.status !== 'success') {
        throw new Error('Faucet drip failed on-chain')
      }

      setSuccess('BLIND tokens dripped successfully!')
      await fetchLastDripTime()
    } catch (err: any) {
      setError(err.message || 'Faucet drip failed')
    } finally {
      setLoading(false)
    }
  }, [address, walletClient, publicClient, fetchLastDripTime])

  return {
    drip,
    fetchLastDripTime,
    lastDripTime,
    loading,
    error,
    success,
  }
}
