import { useState } from 'react'
import { useAccount } from 'wagmi'
import { Wallet, Droplets } from 'lucide-react'
import { useCredits } from '../hooks/useCredits'
import { DepositModal } from './DepositModal'

export function CreditBalance() {
  const { address } = useAccount()
  const { cusdc, blind, loading, refresh } = useCredits(address)
  const [showDeposit, setShowDeposit] = useState(false)

  const cusdcFormatted = (cusdc / 1e6).toFixed(2)
  const blindFormatted = (blind / 1e18).toFixed(2)

  return (
    <>
      <button
        onClick={() => setShowDeposit(true)}
        className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800 transition-colors"
        title="Click to deposit credits"
      >
        <Wallet className="w-3.5 h-3.5 text-emerald-400" />
        {loading ? (
          <span className="animate-pulse">...</span>
        ) : (
          <span>
            {cusdcFormatted} USDC · {blindFormatted} BLIND
          </span>
        )}
        <Droplets className="w-3 h-3 text-zinc-500" />
      </button>
      {showDeposit && <DepositModal onClose={() => setShowDeposit(false)} onSuccess={refresh} />}
    </>
  )
}
