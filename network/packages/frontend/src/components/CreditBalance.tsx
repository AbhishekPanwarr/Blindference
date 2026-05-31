import { useState } from 'react'
import { useAccount } from 'wagmi'
import { Wallet, Droplets } from 'lucide-react'
import { useCredits } from '../hooks/useCredits'
import { DepositModal } from './DepositModal'

function formatCusdc(wei: string): string {
  try {
    const n = BigInt(wei)
    return (Number(n) / 1e6).toFixed(6)
  } catch {
    return "0.000000"
  }
}

function formatBlind(wei: string): string {
  try {
    const n = BigInt(wei)
    return (Number(n) / 1e18).toFixed(2)
  } catch {
    return "0.00"
  }
}

export function CreditBalance() {
  const { address } = useAccount()
  const { cusdc, blind, loading, refresh } = useCredits(address)
  const [showDeposit, setShowDeposit] = useState(false)

  const cusdcFormatted = formatCusdc(cusdc)
  const blindFormatted = formatBlind(blind)

  return (
    <>
      <button
        onClick={() => setShowDeposit(true)}
        className="flex items-center gap-2 rounded-full border border-orange-500/20 bg-[rgba(10,10,10,0.8)] px-3 py-1.5 text-xs font-medium text-white hover:border-orange-500/40 hover:bg-orange-500/10 transition-colors glow-primary"
        title="Click to deposit credits"
      >
        <Wallet className="w-3.5 h-3.5 text-success" />
        {loading ? (
          <span className="animate-pulse">...</span>
        ) : (
          <span>
            {cusdcFormatted} USDC · {blindFormatted} BLIND
          </span>
        )}
        <Droplets className="w-3 h-3 text-orange-400" />
      </button>
      {showDeposit && <DepositModal onClose={() => setShowDeposit(false)} onSuccess={refresh} />}
    </>
  )
}
