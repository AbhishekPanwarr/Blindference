import { useState } from 'react'
import { useAccount, useWalletClient, usePublicClient } from 'wagmi'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, CheckCircle, ExternalLink } from 'lucide-react'
import { getReineiraSdk } from '../lib/reineiraSdk'
import { useCofheClient } from '../hooks/useCofheClient'
import { encodeResolverData } from '@reineira-os/sdk'

const PAYOUT_CLAIMER_ADDRESS = (import.meta.env.VITE_PAYOUT_CLAIMER_ADDRESS || '0xEfB565c7989dd1dEDD0C5B8c95dA24Ef2d94FBbd') as `0x${string}`
const INFERENCE_GATE_ADDRESS = (import.meta.env.VITE_INFERENCE_GATE_ADDRESS || '0x6a3fA63542d0b69937949372c11348A9EE3f6459') as `0x${string}`

export function CreateEscrowPage() {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const navigate = useNavigate()
  const { client: cofheClient } = useCofheClient()

  const [amount, setAmount] = useState<string>('10')
  const [jobId, setJobId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [escrowId, setEscrowId] = useState<string | null>(null)
  const [createTxHash, setCreateTxHash] = useState<string | null>(null)
  const [fundTxHash, setFundTxHash] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!address || !walletClient || !publicClient) {
      setError('Connect your wallet first')
      return
    }
    if (!cofheClient) {
      setError('CoFHE client not ready. Please wait a moment and try again.')
      return
    }

    const usdcAmount = Number(amount)
    if (isNaN(usdcAmount) || usdcAmount <= 0) {
      setError('Amount must be greater than 0')
      return
    }

    const trimmedJobId = jobId.trim()
    if (!trimmedJobId || !trimmedJobId.startsWith('0x') || trimmedJobId.length !== 66) {
      setError('Job ID must be a valid bytes32 hex string (0x + 64 characters)')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)
    setEscrowId(null)
    setCreateTxHash(null)
    setFundTxHash(null)

    try {
      const sdk = await getReineiraSdk(walletClient, publicClient, cofheClient)
      const sdkAmount = sdk.usdc(usdcAmount)

      const resolverData = encodeResolverData(['bytes32'], [trimmedJobId])

      console.log(`[CreateEscrowPage] Creating escrow: amount=${usdcAmount} USDC owner=${PAYOUT_CLAIMER_ADDRESS} resolver=${INFERENCE_GATE_ADDRESS}`)

      const escrow = await sdk.escrow
        .build()
        .amount(sdkAmount)
        .owner(PAYOUT_CLAIMER_ADDRESS)
        .condition(INFERENCE_GATE_ADDRESS, resolverData)
        .create()

      console.log(`[CreateEscrowPage] Escrow created: id=${escrow.id} tx=${escrow.createTx?.hash ?? 'n/a'}`)
      setEscrowId(String(escrow.id))
      setCreateTxHash(escrow.createTx?.hash ?? null)

      const fundResult = await escrow.fund(sdkAmount, { autoApprove: true })
      console.log(`[CreateEscrowPage] Escrow funded: tx=${fundResult.tx.hash}`)
      setFundTxHash(fundResult.tx.hash)

      setSuccess(`Escrow #${escrow.id} created and funded successfully!`)
    } catch (err: any) {
      console.error('[CreateEscrowPage] Error:', err)
      setError(err.message || 'Escrow creation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-zinc-400" />
        </button>
        <div>
          <h1 className="text-2xl font-semibold text-white">Create Escrow</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Create a Reineira escrow for inference payment. Owner is set to PayoutClaimer for automatic settlement.
          </p>
        </div>
      </div>

      {/* Info box */}
      <div className="mb-6 rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
        <div className="text-xs text-blue-400/80">
          <p className="mb-1"><strong>Owner:</strong> {PAYOUT_CLAIMER_ADDRESS}</p>
          <p className="mb-1"><strong>Resolver:</strong> {INFERENCE_GATE_ADDRESS}</p>
          <p>The escrow owner is fixed to PayoutClaimer so the Payment Service can claim funds on job completion.</p>
        </div>
      </div>

      {/* Form */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-white mb-1">Amount (USDC)</label>
          <input
            type="number"
            min="1"
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500"
            placeholder="e.g. 10"
          />
          <p className="text-xs text-zinc-500 mt-1">Amount in USDC (6 decimals). This will be wrapped into cUSDC during funding.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-white mb-1">Job ID (bytes32)</label>
          <input
            type="text"
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500 font-mono"
            placeholder="0x..."
          />
          <p className="text-xs text-zinc-500 mt-1">
            The inference job ID as a bytes32 hex string (0x + 64 hex chars). Used as resolver data for the escrow condition.
          </p>
        </div>

        <button
          onClick={handleCreate}
          disabled={loading || !address}
          className="w-full rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating & Funding Escrow...
            </>
          ) : (
            'Create Escrow'
          )}
        </button>
      </div>

      {/* Results */}
      {error && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}
      {success && (
        <div className="mt-4 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            {success}
          </div>
          {escrowId && (
            <div className="text-xs text-green-400/80 font-mono">
              Escrow ID: {escrowId}
            </div>
          )}
          <div className="flex gap-4 mt-1">
            {createTxHash && (
              <a
                href={`https://sepolia.arbiscan.io/tx/${createTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 underline"
              >
                Create tx <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {fundTxHash && (
              <a
                href={`https://sepolia.arbiscan.io/tx/${fundTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 underline"
              >
                Fund tx <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
