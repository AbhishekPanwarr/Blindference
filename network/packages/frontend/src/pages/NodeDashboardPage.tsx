import { useEffect } from 'react'
import { useAccount } from 'wagmi'
import { useIsNodeOperator } from '../hooks/useIsNodeOperator'
import { useNodeStats } from '../hooks/useNodeStats'
import { useNodeJobs } from '../hooks/useNodeJobs'
import { NodeStatsCard } from '../components/NodeStatsCard'
import { NodeJobHistory } from '../components/NodeJobHistory'
import { BecomeNodeBanner } from '../components/BecomeNodeBanner'
import {
  BarChart3,
  Wallet,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  Server,
  TrendingUp,
  Activity,
  RefreshCw,
  Loader2,
} from 'lucide-react'

export function NodeDashboardPage() {
  const { address } = useAccount()
  const { isOperator, loading: checkingOperator } = useIsNodeOperator()
  const { stats, loading: statsLoading, error: statsError, refetch: refetchStats } = useNodeStats()
  const { jobs, loading: jobsLoading, refetch: refetchJobs } = useNodeJobs(20)

  // Auto-refresh on mount
  useEffect(() => {
    refetchStats()
    refetchJobs()
  }, [refetchStats, refetchJobs])

  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center text-white">
        <Wallet className="w-10 h-10 text-zinc-600 mb-4" />
        <h1 className="text-xl font-semibold mb-2">Connect Your Wallet</h1>
        <p className="text-sm text-zinc-500 max-w-md">
          Connect your MetaMask wallet to view your node dashboard.
        </p>
      </div>
    )
  }

  if (checkingOperator) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <Loader2 className="w-8 h-8 text-zinc-500 animate-spin mb-4" />
        <p className="text-sm text-zinc-500">Checking operator status...</p>
      </div>
    )
  }

  // Non-operator: show become-a-node banner
  if (!isOperator) {
    return (
      <div className="px-6 py-8">
        <BecomeNodeBanner />
      </div>
    )
  }

  // Operator: full dashboard
  const isSlashed = stats?.slashed || (stats?.slash_count ?? 0) >= 2
  const successRate = stats && stats.total_jobs > 0
    ? Math.round((stats.success / stats.total_jobs) * 100)
    : 0

  return (
    <div className="px-6 py-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-5 h-5 text-zinc-400" />
            <h1 className="text-xl font-semibold text-white">Node Dashboard</h1>
          </div>
          <p className="text-xs text-zinc-500 font-mono">{address}</p>
        </div>
        <button
          onClick={() => { refetchStats(); refetchJobs() }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-800 text-xs text-zinc-400 hover:bg-zinc-900 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Slash warning */}
      {isSlashed && (
        <div className="mb-6 rounded-xl border border-red-900/30 bg-red-950/20 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-red-300">Warning: Slash Risk</h3>
            <p className="text-xs text-red-400/80 mt-1">
              Consecutive failures: {stats?.slash_count}. One more failure and your stake will be hard-slashed on-chain.
            </p>
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <NodeStatsCard
          title="Current Stake"
          value={`${stats?.current_stake_blind || '0'} BLIND`}
          subtitle="On-chain BLIND stake"
          icon={<ShieldCheck className="w-5 h-5 text-emerald-400" />}
          accent={isSlashed ? 'danger' : 'default'}
        />
        <NodeStatsCard
          title="Total Earned"
          value={`${stats?.total_earned_blind || '0'} BLIND`}
          subtitle="Cumulative rewards"
          icon={<TrendingUp className="w-5 h-5 text-blue-400" />}
        />
        <NodeStatsCard
          title="Jobs Completed"
          value={stats?.total_jobs ?? 0}
          subtitle={`${stats?.success ?? 0} success / ${stats?.failed ?? 0} failed`}
          icon={<CheckCircle className="w-5 h-5 text-emerald-400" />}
        />
        <NodeStatsCard
          title="Success Rate"
          value={`${successRate}%`}
          subtitle={stats?.total_jobs ? `${stats.total_jobs} total jobs` : 'No jobs yet'}
          icon={<Activity className="w-5 h-5 text-purple-400" />}
        />
      </div>

      {/* Two-column layout: jobs + details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Job history — takes 2/3 width */}
        <div className="lg:col-span-2">
          {statsError ? (
            <div className="rounded-xl border border-red-900/30 bg-red-950/20 p-4 text-sm text-red-400">
              {statsError}
            </div>
          ) : jobsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-zinc-600 animate-spin" />
            </div>
          ) : (
            <NodeJobHistory jobs={jobs} />
          )}
        </div>

        {/* Side panel — staking details */}
        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
              <Server className="w-4 h-4 text-zinc-400" />
              Node Status
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Operator</span>
                <span className="text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Active
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Failures</span>
                <span className={`font-mono ${(stats?.slash_count ?? 0) >= 2 ? 'text-red-400' : 'text-zinc-300'}`}>
                  {stats?.slash_count ?? 0} / 3
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Slashed</span>
                <span className={stats?.slashed ? 'text-red-400 font-medium' : 'text-zinc-500'}>
                  {stats?.slashed ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-zinc-400" />
              Reward Split
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                <span className="text-zinc-400">Leader: 60%</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-purple-400" />
                <span className="text-zinc-400">Verifier 1: 20%</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-pink-400" />
                <span className="text-zinc-400">Verifier 2: 20%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
