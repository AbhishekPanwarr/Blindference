import { useCallback, useState } from 'react'
import { useAccount, useWalletClient, usePublicClient } from 'wagmi'
import { type Hex } from 'viem'
import { getReineiraSdk } from '../lib/reineiraSdk'
import { useCofheClient } from './useCofheClient'

export interface WrapStep {
  label: string
  status: 'pending' | 'in-progress' | 'done' | 'error'
  txHash?: Hex
}

export function useWrapUSDC() {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const { client: cofheClient } = useCofheClient()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [steps, setSteps] = useState<WrapStep[]>([
    { label: 'Create unconditional escrow', status: 'pending' },
    { label: 'Approve & fund escrow', status: 'pending' },
    { label: 'Redeem escrow (receive cUSDC)', status: 'pending' },
  ])

  const updateStep = useCallback((index: number, status: WrapStep['status'], txHash?: Hex) => {
    setSteps((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], status, txHash }
      return next
    })
  }, [])

  const resetSteps = useCallback(() => {
    setSteps([
      { label: 'Create unconditional escrow', status: 'pending' },
      { label: 'Approve & fund escrow', status: 'pending' },
      { label: 'Redeem escrow (receive cUSDC)', status: 'pending' },
    ])
  }, [])

  const wrap = useCallback(
    async (usdcAmount: number) => {
      if (!address || !walletClient || !publicClient) {
        setError('Connect your wallet first')
        return
      }
      if (!cofheClient) {
        setError('CoFHE client not ready. Please wait a moment and try again.')
        return
      }
      if (usdcAmount <= 0) {
        setError('Amount must be greater than 0')
        return
      }

      setLoading(true)
      setError(null)
      setSuccess(null)
      resetSteps()

      try {
        const sdk = await getReineiraSdk(walletClient, publicClient, cofheClient)
        const amount = sdk.usdc(usdcAmount)

        // ── Step 1: Create unconditional escrow ────────────────────────
        updateStep(0, 'in-progress')
        const escrow = await sdk.escrow
          .build()
          .amount(amount)
          .owner(address)
          .create()
        updateStep(0, 'done', escrow.createTx?.hash as Hex | undefined)
        console.log(`[WrapUSDC] Escrow created: id=${escrow.id} tx=${escrow.createTx?.hash}`)

        // ── Step 2: Fund escrow (SDK auto-approves USDC) ─────────────
        updateStep(1, 'in-progress')
        const fundResult = await escrow.fund(amount, { autoApprove: true })
        updateStep(1, 'done', fundResult?.tx?.hash as Hex | undefined)
        console.log(`[WrapUSDC] Escrow funded: tx=${fundResult?.tx?.hash}`)

        // ── Step 3: Redeem escrow → receive cUSDC ────────────────────
        updateStep(2, 'in-progress')
        const redeemResult = await escrow.redeem()
        updateStep(2, 'done', redeemResult?.hash as Hex | undefined)
        console.log(`[WrapUSDC] Escrow redeemed: tx=${redeemResult?.hash}`)

        setSuccess(`${usdcAmount} USDC wrapped to cUSDC successfully!`)
      } catch (err: any) {
        console.error('[WrapUSDC] Error:', err)
        setError(err.message || 'Wrap failed')
        setSteps((prev) => {
          const next = [...prev]
          const currentIdx = next.findIndex((s) => s.status === 'in-progress')
          if (currentIdx !== -1) next[currentIdx] = { ...next[currentIdx], status: 'error' }
          return next
        })
      } finally {
        setLoading(false)
      }
    },
    [address, walletClient, publicClient, cofheClient, updateStep, resetSteps]
  )

  return { wrap, steps, loading, error, success, resetSteps }
}
