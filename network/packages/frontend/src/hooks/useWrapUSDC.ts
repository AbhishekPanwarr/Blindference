import { useCallback, useState } from 'react'
import { useAccount, useWalletClient, usePublicClient } from 'wagmi'
import { type Hex, parseAbi } from 'viem'
import { getReineiraSdk } from '../lib/reineiraSdk'
import { useCofheClient } from './useCofheClient'

const erc20BalanceAbi = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
]) as any

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
  const [balances, setBalances] = useState<{ usdc: string; cusdc: string; eth: string } | null>(null)
  const [balanceLoading, setBalanceLoading] = useState(false)
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
        console.log(`[WrapUSDC] Diag — sdk.usdc(${usdcAmount}) = ${amount}`)
        console.log(`[WrapUSDC] Diag — SDK addresses:`, (sdk as any).addresses)

        // Check USDC balance before
        const usdcBefore = await (publicClient as any).readContract({
          address: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
          abi: erc20BalanceAbi,
          functionName: 'balanceOf',
          args: [address],
        })
        console.log(`[WrapUSDC] Diag — USDC balance before: ${usdcBefore}`)

        // Check cUSDC balance before
        try {
          const cusdcAddr = (sdk as any).addresses?.confidentialUSDC
          if (cusdcAddr) {
            const cusdcBefore = await (publicClient as any).readContract({
              address: cusdcAddr,
              abi: erc20BalanceAbi,
              functionName: 'balanceOf',
              args: [address],
            })
            console.log(`[WrapUSDC] Diag — cUSDC balance BEFORE wrap: ${cusdcBefore}`)
            console.log(`[WrapUSDC] Diag — cUSDC token address: ${cusdcAddr}`)
          }
        } catch (e: any) {
          console.log(`[WrapUSDC] Diag — cUSDC balance check before failed: ${e.message}`)
        }

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

        // Check USDC balance after fund
        const usdcAfterFund = await (publicClient as any).readContract({
          address: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
          abi: erc20BalanceAbi,
          functionName: 'balanceOf',
          args: [address],
        })
        console.log(`[WrapUSDC] Diag — USDC balance after fund: ${usdcAfterFund}`)

        // Check fund tx receipt for EscrowFunded event
        if (fundResult?.tx?.hash) {
          try {
            const fundReceipt = await publicClient.waitForTransactionReceipt({ hash: fundResult.tx.hash as Hex })
            console.log(`[WrapUSDC] Diag — fund receipt:`, {
              status: fundReceipt.status,
              gasUsed: fundReceipt.gasUsed?.toString?.(),
              logs: fundReceipt.logs?.map((l: any) => ({
                addr: l.address,
                topics: l.topics?.slice(0,2),
              })),
            })
          } catch (e: any) {
            console.log(`[WrapUSDC] Diag — fund receipt fetch failed: ${e.message}`)
          }
        }

        // ── Step 3: Redeem escrow → receive cUSDC ────────────────────
        updateStep(2, 'in-progress')
        const redeemResult = await escrow.redeem()
        updateStep(2, 'done', redeemResult?.hash as Hex | undefined)
        console.log(`[WrapUSDC] Escrow redeemed: tx=${redeemResult?.hash}`)

        // Check cUSDC balance after redeem
        try {
          const cusdcAddr = (sdk as any).addresses?.confidentialUSDC
          if (cusdcAddr) {
            const cusdcAfter = await (publicClient as any).readContract({
              address: cusdcAddr,
              abi: erc20BalanceAbi,
              functionName: 'balanceOf',
              args: [address],
            })
            console.log(`[WrapUSDC] Diag — cUSDC balance AFTER redeem: ${cusdcAfter}`)
          }
        } catch (e: any) {
          console.log(`[WrapUSDC] Diag — cUSDC balance check after failed: ${e.message}`)
        }

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

  const checkBalances = useCallback(async () => {
    if (!address || !walletClient || !publicClient) {
      setError('Connect your wallet first')
      return
    }
    if (!cofheClient) {
      setError('CoFHE client not ready. Please wait a moment and try again.')
      return
    }
    setBalanceLoading(true)
    setError(null)
    try {
      const sdk = await getReineiraSdk(walletClient, publicClient, cofheClient)
      const bal = await (sdk as any).balances(address)
      // bal.usdc and bal.confidentialUSDC are ethers BigNumberish
      const usdcRaw = bal.usdc?.toString?.() ?? bal.usdc ?? '0'
      const cusdcRaw = bal.confidentialUSDC?.toString?.() ?? bal.confidentialUSDC ?? '0'
      const ethRaw = bal.eth?.toString?.() ?? bal.eth ?? '0'
      setBalances({
        usdc: (Number(usdcRaw) / 1e6).toFixed(2),
        cusdc: cusdcRaw === '0' ? 'None' : `Encrypted (handle: ${cusdcRaw.slice(0, 12)}…)`,
        eth: (Number(ethRaw) / 1e18).toFixed(4),
      })
    } catch (err: any) {
      console.error('[WrapUSDC] Balance check error:', err)
      setError(err.message || 'Balance check failed')
    } finally {
      setBalanceLoading(false)
    }
  }, [address, walletClient, publicClient, cofheClient])

  return { wrap, steps, loading, error, success, resetSteps, checkBalances, balances, balanceLoading }
}
