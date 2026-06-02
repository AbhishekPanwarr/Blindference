import { useState, useEffect, useCallback } from 'react'
import { useAccount, useWalletClient, usePublicClient, useReadContract } from 'wagmi'
import { useNavigate } from 'react-router-dom'
import { CreditCard, CheckCircle, Loader2, ArrowLeft, Zap, Shield, Crown, Info, Droplets, RefreshCw, ExternalLink } from 'lucide-react'
import { creditsApi, type CreditPackage } from '../api/creditsApi'
import { useCredits } from '../hooks/useCredits'
import { useBlindFaucet } from '../hooks/useBlindFaucet'
import { useWrapUSDC } from '../hooks/useWrapUSDC'
import { Hex, parseAbi } from 'viem'
import { arbitrumSepolia } from 'wagmi/chains'
import { GlassCard } from '../components/ui/GlassCard'
import { SectionLabel } from '../components/effects/GlowDivider'

const BLIND_TOKEN_ADDRESS = (import.meta.env.VITE_BLIND_TOKEN_ADDRESS || '') as Hex
const PAYMENT_WALLET_ADDRESS = (import.meta.env.VITE_PAYMENT_WALLET_ADDRESS || '') as Hex

const PACKAGE_ICONS: Record<string, React.ReactNode> = {
  starter: <Zap className="w-6 h-6 text-yellow-500" />,
  pro: <Shield className="w-6 h-6 text-blue-500" />,
  enterprise: <Crown className="w-6 h-6 text-violet-500" />,
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

  const { drip: dripBlind, fetchLastDripTime, lastDripTime, loading: faucetLoading, error: faucetError, success: faucetSuccess } = useBlindFaucet()
  const { wrap: wrapUsdc, steps: wrapSteps, loading: wrapLoading, error: wrapError, success: wrapSuccess, resetSteps: resetWrapSteps, checkBalances, balances, balanceLoading } = useWrapUSDC()
  const [wrapAmount, setWrapAmount] = useState<string>('10')

  const [packages, setPackages] = useState<CreditPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [approving, setApproving] = useState(false)

  // Tab state for NullPay-inspired interface
  const [activeTab, setActiveTab] = useState<'buy' | 'faucet' | 'wrap'>('buy')

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
        <Loader2 className="w-6 h-6 animate-spin text-white/50" />
      </div>
    )
  }

  const needsApproval = allowance !== undefined && allowance < BigInt(packages[0]?.price_blind_wei || '100000000000000000000')

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">
      {/* ── Header ── */}
      <GlassCard className="gradient-accent-top p-8 text-center" hoverEffect={false}>
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 p-2 rounded-full border border-white/10 glass-card hover:bg-violet-500/10 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-white/50" />
        </button>
        <SectionLabel>CREDITS & TOKENS</SectionLabel>
        <h1 className="text-3xl font-bold text-white mb-2 mt-1">
          Manage Your <span className="gradient-text">Credits</span>
        </h1>
        <p className="text-sm text-white/50 max-w-xl mx-auto">
          Purchase inference credit packages, wrap USDC to cUSDC, or drip free BLIND tokens for testnet use.
        </p>
      </GlassCard>

      {/* ── Token Overview Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* cUSDC Card */}
        <GlassCard className="p-6" hoverEffect>
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-white">cUSDC</h2>
              <p className="text-xs text-white/50 mt-1 leading-relaxed">
                Confidential USDC for private inference payments. Wrapped via Reineira escrow on Arbitrum Sepolia.
              </p>
            </div>
            <div className="p-2 rounded-xl bg-[rgba(10,10,10,0.6)] border border-white/10">
              <Droplets className="w-5 h-5 text-violet-400" />
            </div>
          </div>
          <div className="mb-5">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40 mb-1">Current Balance</div>
            <div className="text-2xl font-mono text-white/90">{formatWei(balanceCusdc)}</div>
            <div className="text-xs text-white/50">cUSDC wei</div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('wrap')}
              className="btn-primary px-4 py-2 text-sm font-semibold flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Wrap USDC
            </button>
            <button className="btn-outline px-4 py-2 text-sm font-semibold flex items-center gap-2 opacity-50 cursor-not-allowed" disabled>
              Deposit
            </button>
          </div>
        </GlassCard>

        {/* BLIND Card */}
        <GlassCard className="p-6" hoverEffect>
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-white">BLIND</h2>
              <p className="text-xs text-white/50 mt-1 leading-relaxed">
                Native protocol token. Stake to run nodes, earn rewards per job, and vote on protocol upgrades.
              </p>
            </div>
            <div className="p-2 rounded-xl bg-[rgba(10,10,10,0.6)] border border-white/10">
              <Zap className="w-5 h-5 text-violet-400" />
            </div>
          </div>
          <div className="mb-5">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40 mb-1">Current Balance</div>
            <div className="text-2xl font-mono text-white/90">{weiToEth(balanceBlind)}</div>
            <div className="text-xs text-white/50">BLIND</div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('faucet')}
              className="btn-primary px-4 py-2 text-sm font-semibold flex items-center gap-2"
            >
              <Droplets className="w-4 h-4" />
              Drip Tokens
            </button>
            <button className="btn-outline px-4 py-2 text-sm font-semibold flex items-center gap-2 opacity-50 cursor-not-allowed" disabled>
              Stake
            </button>
          </div>
        </GlassCard>
      </div>

      {/* ── Tabbed Interface ── */}
      <div>
        {/* Tab Selector */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {([
            { key: 'buy' as const, label: 'Buy Packages' },
            { key: 'faucet' as const, label: 'BLIND Faucet' },
            { key: 'wrap' as const, label: 'Wrap USDC' },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={
                'px-5 py-2 rounded-full text-sm font-semibold transition-all duration-300 border ' +
                (activeTab === tab.key
                  ? 'bg-violet-500 text-white border-violet-500 shadow-[0_0_20px_rgba(139,92,246,0.35)]'
                  : 'bg-[rgba(10,10,10,0.6)] text-white/60 border-white/10 hover:border-white/20 hover:text-white')
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab 1: Buy Packages ── */}
        {activeTab === 'buy' && (
          <div className="space-y-6">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">
              Credit Packages
            </div>

            {/* Approval banner */}
            {address && needsApproval && (
              <GlassCard className="p-4 border-amber-500/30" hoverEffect={false}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium text-amber-400">BLIND Approval Required</div>
                    <div className="text-xs text-amber-400/70 mt-1">
                      Approve the Payment Service to spend your BLIND tokens for purchases.
                    </div>
                  </div>
                  <button
                    onClick={handleApprove}
                    disabled={approving}
                    className="btn-primary px-4 py-2 text-sm font-semibold disabled:opacity-50 flex items-center gap-2 shrink-0"
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
              </GlassCard>
            )}

            {/* Global error / success */}
            {error && (
              <GlassCard className="p-4 border-red-500/30" hoverEffect={false}>
                <div className="text-sm text-red-400">{error}</div>
              </GlassCard>
            )}
            {success && (
              <GlassCard className="p-4 border-emerald-500/30" hoverEffect={false}>
                <div className="text-sm text-emerald-400 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  {success}
                </div>
              </GlassCard>
            )}

            {/* Package cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {packages.map((pkg) => (
                <GlassCard
                  key={pkg.id}
                  className="p-6 flex flex-col"
                  hoverEffect
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-xl bg-[rgba(10,10,10,0.6)] border border-white/10">
                      {PACKAGE_ICONS[pkg.id] || <CreditCard className="w-6 h-6 text-white/50" />}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white/90">{pkg.name}</h3>
                      <p className="text-xs text-white/50">{pkg.base_calls.toLocaleString()} base calls</p>
                    </div>
                  </div>

                  <div className="flex-1 space-y-3 mb-6">
                    <div className="flex justify-between text-sm">
                      <span className="text-white/50">Bonus</span>
                      <span className="text-white/90 font-medium">+{pkg.bonus_percent}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/50">Total calls</span>
                      <span className="text-white/90 font-medium">{pkg.total_calls.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/50">Price</span>
                      <span className="text-white/90 font-medium">{pkg.price_blind.toLocaleString()} BLIND</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/50">Effective per-call</span>
                      <span className="text-white/50">
                        {(pkg.price_blind / pkg.total_calls).toFixed(4)} BLIND
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handlePurchase(pkg)}
                    disabled={purchasing === pkg.id || !address || !BLIND_TOKEN_ADDRESS || needsApproval}
                    className="w-full btn-primary px-4 py-2.5 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                </GlassCard>
              ))}
            </div>
          </div>
        )}

        {/* ── Tab 2: BLIND Faucet ── */}
        {activeTab === 'faucet' && (
          <div className="space-y-6">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">
              Testnet Faucet
            </div>

            <GlassCard className="p-6" hoverEffect={false}>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">BLIND Faucet</h3>
                  <p className="text-xs text-white/50">
                    {lastDripTime !== null && lastDripTime > 0n
                      ? 'You have already dripped BLIND tokens.'
                      : 'Get free BLIND tokens for testnet use.'}
                  </p>
                </div>
                <div className="p-2 rounded-xl bg-[rgba(10,10,10,0.6)] border border-white/10">
              <Droplets className="w-5 h-5 text-violet-400" />
                </div>
              </div>

              {/* Status card */}
              <div className="glass-card p-4 mb-6">
                <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40 mb-2">Status</div>
                <div className="text-sm text-white/70">
                  {lastDripTime !== null && lastDripTime > 0n
                    ? `Last drip: block ${lastDripTime.toString()}`
                    : 'No drip recorded for this wallet.'}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={dripBlind}
                  disabled={faucetLoading || !address || (lastDripTime !== null && lastDripTime > 0n)}
                  className="btn-primary px-6 py-2.5 text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
                >
                  {faucetLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Dripping...
                    </>
                  ) : (
                    <>
                      <Droplets className="w-4 h-4" />
                      Drip BLIND
                    </>
                  )}
                </button>
                <button
                  onClick={fetchLastDripTime}
                  className="px-4 py-2.5 rounded-full border border-white/10 bg-[rgba(10,10,10,0.6)] text-sm font-semibold text-white/60 hover:border-white/20 hover:text-white transition-all flex items-center gap-2"
                  title="Check drip status"
                >
                  <RefreshCw className="w-4 h-4" />
                  Check Status
                </button>
              </div>

              {faucetError && (
                <div className="mt-4 glass-card border-red-500/30 p-3 text-xs text-red-400">
                  {faucetError}
                </div>
              )}
              {faucetSuccess && (
                <div className="mt-4 glass-card border-emerald-500/30 p-3 text-xs text-emerald-400 flex items-center gap-2">
                  <CheckCircle className="w-3 h-3" />
                  {faucetSuccess}
                </div>
              )}
            </GlassCard>
          </div>
        )}

        {/* ── Tab 3: Wrap USDC ── */}
        {activeTab === 'wrap' && (
          <div className="space-y-6">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">
              USDC → cUSDC
            </div>

            <GlassCard className="p-6" hoverEffect={false}>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">Wrap USDC</h3>
                  <p className="text-xs text-white/50">
                    Convert plain USDC to confidential cUSDC via a 3-step escrow workaround.
                  </p>
                </div>
                <a
                  href="https://faucet.circle.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-full border border-white/10 bg-[rgba(10,10,10,0.6)] text-xs font-medium text-white/50 hover:border-violet-500/30 hover:text-violet-400 transition-all flex items-center gap-2"
                >
                  <ExternalLink className="w-3 h-3" />
                  Circle Faucet
                </a>
              </div>

              {/* Amount input */}
              <div className="mb-5">
                <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40 mb-2">Amount</div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={wrapAmount}
                    onChange={(e) => setWrapAmount(e.target.value)}
                    className="w-40 input-glass px-4 py-2.5 text-sm text-white/90"
                    placeholder="Amount"
                  />
                  <button
                    onClick={() => wrapUsdc(Number(wrapAmount))}
                    disabled={wrapLoading || !address}
                    className="btn-primary px-6 py-2.5 text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
                  >
                    {wrapLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Wrapping...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        Wrap USDC
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Step progress indicators */}
              {wrapSteps.some((s) => s.status !== 'pending') && (
                <div className="mb-5">
                  <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40 mb-3">Progress</div>
                  <div className="flex items-center gap-2">
                    {wrapSteps.map((step, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <div className="flex flex-col items-center">
                          <div
                            className={
                              'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border transition-colors ' +
                              (step.status === 'done'
                                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                                : step.status === 'in-progress'
                                ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                                : step.status === 'error'
                                ? 'bg-red-500/20 border-red-500/50 text-red-400'
                                : 'bg-[rgba(10,10,10,0.6)] border-white/10 text-white/30')
                            }
                          >
                            {step.status === 'done' && <CheckCircle className="w-4 h-4" />}
                            {step.status === 'in-progress' && <Loader2 className="w-4 h-4 animate-spin" />}
                            {step.status === 'error' && <div className="w-2 h-2 rounded-full bg-red-400" />}
                            {step.status === 'pending' && <span>{idx + 1}</span>}
                          </div>
                          <span
                            className={
                              'text-[10px] mt-1.5 font-medium ' +
                              (step.status === 'done'
                                ? 'text-emerald-400'
                                : step.status === 'in-progress'
                                ? 'text-amber-400'
                                : step.status === 'error'
                                ? 'text-red-400'
                                : 'text-white/30')
                            }
                          >
                            {step.label}
                          </span>
                        </div>
                        {idx < wrapSteps.length - 1 && (
                          <div
                            className={
                              'w-8 h-px mb-4 ' +
                              (wrapSteps[idx + 1].status !== 'pending'
                                ? 'bg-emerald-500/40'
                                : 'bg-white/10')
                            }
                          />
                        )}
                      </div>
                    ))}
                  </div>
                  {wrapSteps.map((step, idx) => (
                    <div key={`detail-${idx}`} className="mt-2 flex items-center gap-2 text-xs">
                      {step.status === 'done' && <CheckCircle className="w-3 h-3 text-emerald-400" />}
                      {step.status === 'in-progress' && <Loader2 className="w-3 h-3 animate-spin text-amber-400" />}
                      {step.status === 'error' && <div className="w-3 h-3 rounded-full bg-red-400" />}
                      {step.status === 'pending' && <div className="w-3 h-3 rounded-full border border-white/50" />}
                      <span
                        className={
                          step.status === 'done'
                            ? 'text-emerald-400'
                            : step.status === 'in-progress'
                            ? 'text-amber-400'
                            : step.status === 'error'
                            ? 'text-red-400'
                            : 'text-white/50'
                        }
                      >
                        {step.label}
                        {step.txHash && (
                          <a
                            href={`https://sepolia.arbiscan.io/tx/${step.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-1 text-white/50 hover:text-white/90 underline"
                          >
                            (view)
                          </a>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {wrapError && (
                <div className="mb-4 glass-card border-red-500/30 p-3 text-xs text-red-400">
                  {wrapError}
                </div>
              )}
              {wrapSuccess && (
                <div className="mb-4 glass-card border-emerald-500/30 p-3 text-xs text-emerald-400 flex items-center gap-2">
                  <CheckCircle className="w-3 h-3" />
                  {wrapSuccess}
                </div>
              )}

              {/* Check Balances */}
              <div className="flex items-center gap-3 mb-3">
                <button
                  onClick={checkBalances}
                  disabled={balanceLoading || !address}
                  className="px-4 py-2 rounded-full border border-white/10 bg-[rgba(10,10,10,0.6)] text-xs font-medium text-white/50 transition-all hover:border-white/20 hover:text-white disabled:opacity-50 flex items-center gap-2"
                >
                  {balanceLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3 h-3" />
                  )}
                  Check Balances
                </button>
              </div>
              {balances && (
                <GlassCard className="p-4 text-xs space-y-2" variant="light">
                  <div className="flex justify-between">
                    <span className="text-white/50">USDC</span>
                    <span className="text-white/90 font-mono">{balances.usdc}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">cUSDC</span>
                    <span className="text-violet-400 font-mono">{balances.cusdc}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">ETH</span>
                    <span className="text-white/90 font-mono">{balances.eth}</span>
                  </div>
                  <div className="text-white/50 text-[10px] pt-2 border-t border-white/10 mt-2">
                    cUSDC is FHE-encrypted. The handle proves your wallet is recognized by the token contract.
                  </div>
                </GlassCard>
              )}
            </GlassCard>
          </div>
        )}
      </div>

      {/* ── Info Footer ── */}
      <GlassCard className="px-5 py-4 flex items-start gap-3" variant="light">
        <Info className="w-4 h-4 text-white/50 mt-0.5 shrink-0" />
        <p className="text-xs text-white/50 leading-relaxed">
          Credits are awarded in cUSDC wei equivalent based on the cheapest model price
          (qwen2.5-7b). You can use credits for any inference model. BLIND payments
          receive a 20% discount vs. cUSDC.
        </p>
      </GlassCard>
    </div>
  )
}
