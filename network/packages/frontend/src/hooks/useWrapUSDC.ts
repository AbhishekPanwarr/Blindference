import { useCallback, useState } from 'react'
import { useAccount, useWalletClient, usePublicClient } from 'wagmi'
import { parseAbi, decodeEventLog, type Hex } from 'viem'
import { Encryptable, type CofheClient } from '../lib/cofhe'
import { useCofheClient } from './useCofheClient'

const CONFIDENTIAL_ESCROW_ADDRESS: Hex = '0xbe1eEB78504B71beEE1b33D3E3D367A2F9a549A6'
const USDC_ADDRESS: Hex = '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d'

export interface WrapStep {
  label: string
  status: 'pending' | 'in-progress' | 'done' | 'error'
  txHash?: Hex
}

const confidentialEscrowAbi = parseAbi([
  'function create(uint256 encOwner, uint256 encAmount, address resolver, bytes resolverData) external returns (uint256)',
  'function fund(uint256 escrowId, uint256 amount) external',
  'function redeem(uint256 escrowId) external',
  'event EscrowCreated(uint256 indexed escrowId)',
  'event EscrowFunded(uint256 indexed escrowId, address indexed payer)',
  'event EscrowRedeemed(uint256 indexed escrowId)',
])

const usdcAbi = parseAbi([
  'function approve(address spender, uint256 amount) external returns (bool)',
])

async function getFeeParams(publicClient: any) {
  const latestBlock = await publicClient.getBlock({ blockTag: 'latest' })
  const fallbackPriorityFeePerGas = 2_000_000n
  const maxPriorityFeePerGas = await publicClient
    .estimateMaxPriorityFeePerGas()
    .catch(() => fallbackPriorityFeePerGas)
  const priorityFeePerGas = maxPriorityFeePerGas > 0n ? maxPriorityFeePerGas : fallbackPriorityFeePerGas
  const baseFeePerGas = latestBlock.baseFeePerGas
  return baseFeePerGas != null
    ? {
        maxPriorityFeePerGas: priorityFeePerGas,
        maxFeePerGas: baseFeePerGas * 2n + priorityFeePerGas + 1_000_000n,
      }
    : {
        gasPrice: await publicClient.getGasPrice(),
      }
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
        const amountWei = BigInt(Math.floor(usdcAmount * 1_000_000))

        // Verify contracts exist on-chain before spending gas
        const escrowCode = await publicClient.getBytecode({ address: CONFIDENTIAL_ESCROW_ADDRESS })
        if (!escrowCode || escrowCode === '0x') {
          throw new Error(`No contract found at ConfidentialEscrow address ${CONFIDENTIAL_ESCROW_ADDRESS}`)
        }
        console.log('[WrapUSDC] Diag — escrow contract exists, size:', escrowCode.length)

        // ── Step 1: Encrypt owner & amount with CoFHE ──────────────────
        updateStep(0, 'in-progress')
        const encryptedItems = await (cofheClient as CofheClient)
          .encryptInputs([
            Encryptable.address(address), // encOwner (FHE-encrypted address)
            Encryptable.uint64(amountWei),  // encAmount
          ])
          .execute()

        const encOwner = BigInt(encryptedItems[0].ctHash)
        const encAmount = BigInt(encryptedItems[1].ctHash)

        const feeParams = await getFeeParams(publicClient)

        // Log exact args for debugging
        console.log('[WrapUSDC] Diag — create args:', {
          encOwner: encOwner.toString(),
          encAmount: encAmount.toString(),
          resolver: '0x0000000000000000000000000000000000000000',
          resolverData: '0x',
          gas: 500000,
          feeParams,
        })

        // Call ConfidentialEscrow.create(encOwner, encAmount, address(0), "0x")
        const createTxHash = await walletClient.writeContract({
          account: walletClient.account,
          chain: walletClient.chain,
          address: CONFIDENTIAL_ESCROW_ADDRESS,
          abi: confidentialEscrowAbi,
          functionName: 'create',
          args: [encOwner, encAmount, '0x0000000000000000000000000000000000000000', '0x'],
          gas: 500000n,
          ...feeParams,
        })
        console.log('[WrapUSDC] Diag — create tx submitted:', createTxHash)

        const createReceipt = await publicClient.waitForTransactionReceipt({ hash: createTxHash })
        console.log('[WrapUSDC] Diag — create receipt:', {
          status: createReceipt.status,
          gasUsed: createReceipt.gasUsed?.toString?.(),
          logs: createReceipt.logs?.length,
          txHash: createReceipt.transactionHash,
        })
        if (createReceipt.status !== 'success') {
          throw new Error(`Escrow creation transaction failed (status=${createReceipt.status}, gasUsed=${createReceipt.gasUsed})`)
        }

        // Parse EscrowCreated event to get escrowId
        let escrowIdVal: bigint | undefined
        for (const log of createReceipt.logs as any[]) {
          if (log.address.toLowerCase() !== CONFIDENTIAL_ESCROW_ADDRESS.toLowerCase()) continue
          try {
            const decoded = decodeEventLog({
              abi: confidentialEscrowAbi,
              eventName: 'EscrowCreated',
              topics: log.topics,
              data: log.data,
            })
            escrowIdVal = (decoded.args as any).escrowId
            break
          } catch {
            // Not an EscrowCreated event, continue scanning
          }
        }
        if (escrowIdVal === undefined) {
          throw new Error('Could not find EscrowCreated event in transaction receipt')
        }

        updateStep(0, 'done', createTxHash)
        console.log(`[WrapUSDC] Escrow created: id=${escrowIdVal}`)

        // ── Step 2: Approve USDC + fund escrow ──────────────────────────
        updateStep(1, 'in-progress')

        // Approve USDC for the escrow contract
        const approveTxHash = await walletClient.writeContract({
          account: walletClient.account,
          chain: walletClient.chain,
          address: USDC_ADDRESS,
          abi: usdcAbi,
          functionName: 'approve',
          args: [CONFIDENTIAL_ESCROW_ADDRESS, amountWei],
          gas: 100000n,
          ...feeParams,
        })
        const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveTxHash })
        if (approveReceipt.status !== 'success') {
          throw new Error('USDC approve transaction failed')
        }

        // Fund the escrow
        const fundTxHash = await walletClient.writeContract({
          account: walletClient.account,
          chain: walletClient.chain,
          address: CONFIDENTIAL_ESCROW_ADDRESS,
          abi: confidentialEscrowAbi,
          functionName: 'fund',
          args: [escrowIdVal, amountWei],
          gas: 300000n,
          ...feeParams,
        })
        const fundReceipt = await publicClient.waitForTransactionReceipt({ hash: fundTxHash })
        if (fundReceipt.status !== 'success') {
          throw new Error('Escrow fund transaction failed')
        }

        updateStep(1, 'done', fundTxHash)
        console.log(`[WrapUSDC] Escrow funded: tx=${fundTxHash}`)

        // ── Step 3: Redeem escrow ─────────────────────────────────────
        updateStep(2, 'in-progress')
        const redeemTxHash = await walletClient.writeContract({
          account: walletClient.account,
          chain: walletClient.chain,
          address: CONFIDENTIAL_ESCROW_ADDRESS,
          abi: confidentialEscrowAbi,
          functionName: 'redeem',
          args: [escrowIdVal],
          gas: 300000n,
          ...feeParams,
        })
        const redeemReceipt = await publicClient.waitForTransactionReceipt({ hash: redeemTxHash })
        if (redeemReceipt.status !== 'success') {
          throw new Error('Escrow redeem transaction failed')
        }

        updateStep(2, 'done', redeemTxHash)
        console.log(`[WrapUSDC] Escrow redeemed: tx=${redeemTxHash}`)

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
