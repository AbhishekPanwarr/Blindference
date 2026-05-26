import { useCallback, useState } from 'react'
import { useAccount, useWalletClient, usePublicClient } from 'wagmi'
import { Hex } from 'viem'
import { getReineiraSdk } from '../lib/reineiraSdk'
import { useCofheClient } from './useCofheClient'
import { encodeResolverData } from '@reineira-os/sdk'

const PAYOUT_CLAIMER_ADDRESS = (import.meta.env.VITE_PAYOUT_CLAIMER_ADDRESS || '0xEfB565c7989dd1dEDD0C5B8c95dA24Ef2d94FBbd') as Hex
const INFERENCE_GATE_ADDRESS = (import.meta.env.VITE_INFERENCE_GATE_ADDRESS || '0x6a3fA63542d0b69937949372c11348A9EE3f6459') as Hex

export interface CreateEscrowResult {
  escrowId: bigint
  createTxHash: string
  fundTxHash: string
}

export function useCreateEscrow() {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const { client: cofheClient } = useCofheClient()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CreateEscrowResult | null>(null)

  const createEscrow = useCallback(
    async (usdcAmount: number | bigint, jobId: string): Promise<CreateEscrowResult | null> => {
      if (!address || !walletClient || !publicClient) {
        setError('Connect your wallet first')
        return null
      }
      if (!cofheClient) {
        setError('CoFHE client not ready. Please wait a moment and try again.')
        return null
      }
      if (usdcAmount <= 0) {
        setError('Amount must be greater than 0')
        return null
      }
      if (!jobId || !jobId.startsWith('0x') || jobId.length !== 66) {
        setError('Job ID must be a valid bytes32 hex string (0x + 64 chars)')
        return null
      }

      setLoading(true)
      setError(null)
      setResult(null)

      try {
        const sdk = await getReineiraSdk(walletClient, publicClient, cofheClient)
        const amount = typeof usdcAmount === 'bigint' ? usdcAmount : sdk.usdc(usdcAmount)

        // Encode resolver data: InferenceGate expects abi.encode(bytes32(jobId))
        const resolverData = encodeResolverData(['bytes32'], [jobId])

        console.log(`[CreateEscrow] Building escrow: amount=${usdcAmount} USDC owner=${PAYOUT_CLAIMER_ADDRESS} resolver=${INFERENCE_GATE_ADDRESS}`)

        const escrow = await sdk.escrow
          .build()
          .amount(amount)
          .owner(PAYOUT_CLAIMER_ADDRESS)
          .condition(INFERENCE_GATE_ADDRESS, resolverData)
          .create()

        console.log(`[CreateEscrow] Escrow created: id=${escrow.id} tx=${escrow.createTx?.hash ?? 'n/a'}`)

        const fundResult = await escrow.fund(amount, { autoApprove: true })
        console.log(`[CreateEscrow] Escrow funded: tx=${fundResult.tx.hash}`)

        const res: CreateEscrowResult = {
          escrowId: escrow.id,
          createTxHash: escrow.createTx?.hash ?? '',
          fundTxHash: fundResult.tx.hash,
        }
        setResult(res)
        return res
      } catch (err: any) {
        console.error('[CreateEscrow] Error:', err)
        setError(err.message || 'Escrow creation failed')
        return null
      } finally {
        setLoading(false)
      }
    },
    [address, walletClient, publicClient, cofheClient]
  )

  return { createEscrow, loading, error, result }
}
