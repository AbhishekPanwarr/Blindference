import { useAccount } from 'wagmi'
import { useIsNodeOperator } from '../hooks/useIsNodeOperator'
import { NodeDashboardPage } from './NodeDashboardPage'
import { NodeRegistrationPage } from './NodeRegistrationPage'
import { Loader2, Wallet } from 'lucide-react'

export function NodesPage() {
  const { address } = useAccount()
  const { isOperator, loading: checkingOperator } = useIsNodeOperator()

  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center text-white">
        <Wallet className="w-10 h-10 text-white/50 mb-4" />
        <h1 className="text-xl font-semibold mb-2 font-heading">Connect Your Wallet</h1>
        <p className="text-sm text-white/50 max-w-md">
          Connect your MetaMask wallet to view your node dashboard or register as an operator.
        </p>
      </div>
    )
  }

  if (checkingOperator) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <Loader2 className="w-8 h-8 text-white/50 animate-spin mb-4" />
        <p className="text-sm text-white/50">Checking operator status...</p>
      </div>
    )
  }

  // Not an operator: show the registration landing card
  if (!isOperator) {
    return <NodeRegistrationPage />
  }

  // Operator: show full dashboard
  return <NodeDashboardPage />
}
