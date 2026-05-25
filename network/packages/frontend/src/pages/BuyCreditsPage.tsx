import { useState, useEffect, useCallback } from 'react'
import { useAccount, useWalletClient, usePublicClient, useReadContract } from 'wagmi'
import { useNavigate } from 'react-router-dom'
import { CreditCard, CheckCircle, Loader2, ArrowLeft, Zap, Shield, Crown, Info } from 'lucide-react'
import { creditsApi, type CreditPackage } from '../api/creditsApi'
import { useCredits } from '../hooks/useCredits'
import { Hex, parseAbi } from 'viem'
import { arbitrumSepolia } from 'wagmi/chains'

const BLIND_TOKEN_ADDRESS = (import.meta.env.VITE_BLIND_TOKEN_ADDRESS || '') as Hex
const PAYMENT_WALLET_ADDRESS = (import.meta.env.VITE_PAYMENT_WALLET_ADDRESS || '') as Hex

const PACKAGE_ICONS: Record<string, React.ReactNode> = {
  starter: <Zap className="w-6 h-6 text-yellow-500" />,
  pro: <Shield className="w-6 h-6 text-blue-500" />,
  enterprise: <Crown className="w-6 h-6 text-purple-500" />,
}

function formatWei(wei: string | number): string {
  try {
    const n = BigInt(wei)
    return n.toLocaleString()
  } catch {
    return String(wei)
  }
}

function weiToEth(wei: string | number): string {
  try {
    const n = BigInt(wei)
    return (Number(n) / 1e18).toFixed(2)
  } catch {
    return "0"
  }
}

export function BuyCreditsPage() {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const navigate = useNavigate()
  const { cusdc: balanceCusdc, blind: balanceBlind, refresh } = useCredits(address)

  // Check BLIND token allowance for Payment Service
  const { data: allowance } = useReadContract({
    address: BLIND_TOKEN_ADDRESS || undefined,
    abi: parseAbi(['function allowance(address owner, address spender) view returns (uint256)']),
    functionName: 'allowance',
    args: address && PAYMENT_WALLET_ADDRESS ? [address, PAYMENT_WALLET_ADDRESS] : undefined,
    query: { enabled: !!address && !!BLIND_TOKEN_ADDRESS && !!PAYMENT_WALLET_ADDRESS },
  })

  const [packages, setPackages] = useState<CreditPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [approving, setApproving] = useState(false)

  // Fetch packages on mount
  useEffect(() => {
    let cancelled = false
    creditsApi
      .getPackages()
      .then((resp) => {
        if (!cancelled) setPackages(resp.data.packages)
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.detail || 'Failed to load packages')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleApprove = useCallback(async () => {
    if (!address || !walletClient || !publicClient) {
      setError('Connect your wallet first')
      return
    }
    if (!BLIND_TOKEN_ADDRESS || !PAYMENT_WALLET_ADDRESS) {
      setError('BLIND token or payment wallet not configured')
      return
    }

    setApproving(true)
    setError(null)

    try {
      // Dynamic EIP-1559 gas estimation
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
        address: BLIND_TOKEN_ADDRESS,
        abi: parseAbi([
          'function approve(address spender, uint256 amount) returns (bool)',
        ]),
        functionName: 'approve',
        args: [PAYMENT_WALLET_ADDRESS, BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')],
        ...feeParams,
      })

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
      if (receipt.status !== 'success') {
        throw new Error('Approval failed on-chain')
      }
      setSuccess('BLIND approval successful! You can now purchase packages.')
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Approval failed')
    } finally {
      setApproving(false)
    }
  }, [address, walletClient, publicClient])

  const handlePurchase = useCallback(
    async (pkg: CreditPackage) => {
      if (!address || !walletClient || !publicClient) {
        setError('Connect your wallet first')
        return
      }
      if (!BLIND_TOKEN_ADDRESS || !PAYMENT_WALLET_ADDRESS) {
        setError('BLIND token or payment wallet not configured')
        return
      }

      setPurchasing(pkg.id)
      setError(null)
      setSuccess(null)

      try {
        // Dynamic EIP-1559 gas estimation
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

        // Send BLIND transfer
        const txHash = await walletClient.writeContract({
          account: address,
          chain: arbitrumSepolia,
          address: BLIND_TOKEN_ADDRESS,
          abi: parseAbi([
            'function transfer(address to, uint256 amount) returns (bool)',
          ]),
          functionName: 'transfer',
          args: [PAYMENT_WALLET_ADDRESS, BigInt(pkg.price_blind_wei)],
          ...feeParams,
        })

        // Wait for receipt
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
        if (receipt.status !== 'success') {
          throw new Error('BLIND transfer failed on-chain')
        }

        // Notify Payment Service
        const resp = await creditsApi.purchasePackage(pkg.id, txHash)
        setSuccess(
          `Purchased ${pkg.name}! Awarded ${resp.data.credits_awarded_cusdc} cUSDC-equivalent credits.`
        )
        refresh()
      } catch (err: any) {
        setError(err.response?.data?.detail || err.message || 'Purchase failed')
      } finally {
        setPurchasing(null)
      }
    },
    [address, walletClient, publicClient, refresh]
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    )
  }

  const needsApproval = allowance !== undefined && allowance < BigInt(packages[0]?.price_blind_wei || '100000000000000000000')

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-zinc-400" />
        </button>
        <div>
          <h1 className="text-2xl font-semibold text-white">Buy Credits</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Purchase credit packages with BLIND tokens. Credits are denominated in cUSDC wei.
          </p>
        </div>
      </div>

      {/* Current balance */}
      {(balanceCusdc || balanceBlind) && (
        <div className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 mb-2">
            Credit Balance
          </div>
          <div className="flex gap-6">
            <div>
              <div className="text-2xl font-mono text-white">{formatWei(balanceCusdc)}</div>
              <div className="text-xs text-zinc-500">cUSDC credits (wei)</div>
            </div>
            <div>
              <div className="text-2xl font-mono text-white">{weiToEth(balanceBlind)}</div>
              <div className="text-xs text-zinc-500">BLIND credits</div>
            </div>
          </div>
        </div>
      )}

      {/* Approval button */}
      {address && needsApproval && (
        <div className="mb-6 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-yellow-400">BLIND Approval Required</div>
              <div className="text-xs text-yellow-400/70 mt-1">
                Approve the Payment Service to spend your BLIND tokens for purchases.
              </div>
            </div>
            <button
              onClick={handleApprove}
              disabled={approving}
              className="rounded-lg bg-yellow-500 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-yellow-400 disabled:opacity-50 flex items-center gap-2"
            >
              {approving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Approving...
                </>
              ) : (
                'Approve BLIND'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Error / Success */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-6 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400 flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          {success}
        </div>
      )}

      {/* Package cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {packages.map((pkg) => (
          <div
            key={pkg.id}
            className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 flex flex-col hover:border-zinc-700 transition-colors"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-zinc-800/60">
                {PACKAGE_ICONS[pkg.id] || <CreditCard className="w-6 h-6 text-zinc-400" />}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">{pkg.name}</h3>
                <p className="text-xs text-zinc-500">{pkg.base_calls.toLocaleString()} base calls</p>
              </div>
            </div>

            <div className="flex-1 space-y-3 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Bonus</span>
                <span className="text-white font-medium">+{pkg.bonus_percent}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Total calls</span>
                <span className="text-white font-medium">{pkg.total_calls.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Price</span>
                <span className="text-white font-medium">{pkg.price_blind.toLocaleString()} BLIND</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Effective per-call</span>
                <span className="text-zinc-400">
                  {(pkg.price_blind / pkg.total_calls).toFixed(4)} BLIND
                </span>
              </div>
            </div>

            <button
              onClick={() => handlePurchase(pkg)}
              disabled={purchasing === pkg.id || !address || !BLIND_TOKEN_ADDRESS || needsApproval}
              className="w-full rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {purchasing === pkg.id ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  Buy {pkg.name}
                </>
              )}
            </button>
          </div>
        ))}
      </div>

      {/* Info footer */}
      <div className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3 flex items-start gap-2">
        <Info className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
        <p className="text-xs text-zinc-500">
          Credits are awarded in cUSDC wei equivalent based on the cheapest model price
          (qwen2.5-7b). You can use credits for any inference model. BLIND payments
          receive a 20% discount vs. cUSDC.
        </p>
      </div>
    </div>
  )
}
