import { useState } from 'react'
import { useAccount, useWalletClient, usePublicClient } from 'wagmi'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, CheckCircle, ExternalLink } from 'lucide-react'
import { getReineiraSdk } from '../lib/reineiraSdk'
import { useCofheClient } from '../hooks/useCofheClient'
import { encodeResolverData } from '@reineira-os/sdk'
import { GlassCard } from '../components/ui/GlassCard'
import { SectionLabel } from '../components/effects/GlowDivider'

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
          className="p-2 rounded-lg border border-white/10 glass-card hover:bg-violet-500/10 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-white/50" />
        </button>
        <div>
          <SectionLabel>CREATE ESCROW</SectionLabel>
          <h1 className="text-2xl font-semibold gradient-text font-heading mt-1">Create Escrow</h1>
          <p className="text-sm text-white/50 mt-1">
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
      <GlassCard className="gradient-accent-top p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-white/90 mb-1">Amount (USDC)</label>
          <input
            type="number"
            min="1"
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-[rgba(10,10,10,0.6)] px-3 py-2 text-sm text-white/90 focus:outline-none focus:border-violet-500/50 input-glass"
            placeholder="e.g. 10"
          />
          <p className="text-xs text-white/50 mt-1">Amount in USDC (6 decimals). This will be wrapped into cUSDC during funding.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-white/90 mb-1">Job ID (bytes32)</label>
          <input
            type="text"
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-[rgba(10,10,10,0.6)] px-3 py-2 text-sm text-white/90 focus:outline-none focus:border-violet-500/50 font-mono input-glass"
            placeholder="0x..."
          />
          <p className="text-xs text-white/50 mt-1">
            The inference job ID as a bytes32 hex string (0x + 64 hex chars). Used as resolver data for the escrow condition.
          </p>
        </div>

        <button
          onClick={handleCreate}
          disabled={loading || !address}
          className="w-full rounded-lg btn-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
         
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
      </GlassCard>

      {/* Results */}
      {error && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}
      {success && (
        <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            {success}
          </div>
          {escrowId && (
            <div className="text-xs text-emerald-400/80 font-mono">
              Escrow ID: {escrowId}
            </div>
          )}
          <div className="flex gap-4 mt-1">
            {createTxHash && (
              <a
                href={`https://sepolia.arbiscan.io/tx/${createTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-white/50 hover:text-white/90 flex items-center gap-1 underline"
              >
                Create tx <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {fundTxHash && (
              <a
                href={`https://sepolia.arbiscan.io/tx/${fundTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-white/50 hover:text-white/90 flex items-center gap-1 underline"
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
