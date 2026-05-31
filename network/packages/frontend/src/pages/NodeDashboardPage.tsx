import { useEffect, useState } from 'react'
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
  Lock,
} from 'lucide-react'
import { GlassCard } from '../components/ui/GlassCard'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis } from 'recharts'
import { SectionLabel } from '../components/effects/GlowDivider'

function weiToEth(wei: string | number): string {
  try {
    const n = BigInt(wei)
    return (Number(n) / 1e18).toFixed(4)
  } catch {
    return "0"
  }
}

export function NodeDashboardPage() {
  const { address } = useAccount()
  const { isOperator, loading: checkingOperator } = useIsNodeOperator()
  const { stats, loading: statsLoading, error: statsError, refetch: refetchStats } = useNodeStats()
  const { jobs, loading: jobsLoading, refetch: refetchJobs } = useNodeJobs(20)
  const [filterRole, setFilterRole] = useState<'all' | 'leader' | 'verifier'>('all')

  // Auto-refresh on mount
  useEffect(() => {
    refetchStats()
    refetchJobs()
  }, [refetchStats, refetchJobs])

  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center text-white">
        <Wallet className="w-10 h-10 text-white/50 mb-4" />
        <h1 className="text-xl font-semibold mb-2 font-heading">Connect Your Wallet</h1>
        <p className="text-sm text-white/50 max-w-md">
          Connect your MetaMask wallet to view your node dashboard.
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

  const jobStatusData = [
    { name: 'Completed', value: stats?.success ?? 0, color: '#22c55e' },
    { name: 'Failed', value: stats?.failed ?? 0, color: '#ef4444' },
    { name: 'Pending', value: (stats?.total_jobs ?? 0) - (stats?.success ?? 0) - (stats?.failed ?? 0), color: '#f97316' },
  ]

  const earningsData = [
    { day: 'Day 1', earnings: 0.5 },
    { day: 'Day 2', earnings: 1.2 },
    { day: 'Day 3', earnings: 2.1 },
    { day: 'Day 4', earnings: 3.5 },
    { day: 'Day 5', earnings: Number(weiToEth(stats?.total_earned_blind ?? '0')) || 5.2 },
  ]

  const filteredJobs = filterRole === 'all' ? jobs : jobs.filter(j => j.role === filterRole)
  const allCount = jobs.length
  const leaderCount = jobs.filter(j => j.role === 'leader').length
  const verifierCount = jobs.filter(j => j.role === 'verifier').length

  return (
    <div className="px-6 py-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <SectionLabel>OPERATOR DASHBOARD</SectionLabel>
          <div className="flex items-center gap-3 mb-1 mt-1">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-orange-400" />
            </div>
            <h1 className="text-2xl font-semibold gradient-text font-heading">Node Dashboard</h1>
          </div>
          <p className="text-xs text-white/50 font-mono mt-1">{address}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-xs text-green-400">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Online
          </div>
          <button
            onClick={() => { refetchStats(); refetchJobs() }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 text-xs text-white/50 hover:bg-orange-500/10 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Slash warning */}
      {isSlashed && (
        <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-amber-400 font-heading">Warning: Slash Risk</h3>
            <p className="text-xs text-amber-400/80 mt-1">
              Consecutive failures: {stats?.slash_count}. One more failure and your stake will be hard-slashed on-chain.
            </p>
          </div>
        </div>
      )}

      {/* Stats Overview Bento Grid */}
      <section>
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40 mb-4">Network Overview</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <GlassCard className="p-5">
            <div className="flex items-start justify-between mb-3">
              <Activity className="w-5 h-5 text-white/50" />
            </div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-white/40 mb-1">Total Jobs</p>
            <p className="text-2xl font-semibold text-white">{stats?.total_jobs ?? 0}</p>
            <p className="text-[10px] text-white/30 mt-1">All time</p>
          </GlassCard>

          <GlassCard className="p-5">
            <div className="flex items-start justify-between mb-3">
              <CheckCircle className={`w-5 h-5 ${successRate > 90 ? 'text-green-400' : successRate >= 50 ? 'text-orange-400' : 'text-red-400'}`} />
            </div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-white/40 mb-1">Success Rate</p>
            <p className={`text-2xl font-semibold ${successRate > 90 ? 'text-green-400' : successRate >= 50 ? 'text-orange-400' : 'text-red-400'}`}>{successRate}%</p>
            <p className="text-[10px] text-white/30 mt-1">{stats?.total_jobs ? `${stats.total_jobs} total` : 'No jobs yet'}</p>
          </GlassCard>

          <GlassCard className="p-5">
            <div className="flex items-start justify-between mb-3">
              <TrendingUp className="w-5 h-5 text-orange-400" />
            </div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-white/40 mb-1">BLIND Earned</p>
            <p className="text-2xl font-semibold text-orange-400">{weiToEth(stats?.total_earned_blind ?? '0')}</p>
            <p className="text-[10px] text-white/30 mt-1">Cumulative</p>
          </GlassCard>

          <GlassCard className="p-5">
            <div className="flex items-start justify-between mb-3">
              <Lock className="w-5 h-5 text-white/50" />
            </div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-white/40 mb-1">Current Stake</p>
            <p className="text-2xl font-semibold text-white">{weiToEth(stats?.current_stake_blind ?? '0')}</p>
            <p className="text-[10px] text-white/30 mt-1">Locked</p>
          </GlassCard>

          <GlassCard className="p-5">
            <div className="flex items-start justify-between mb-3">
              <Wallet className="w-5 h-5 text-white/50" />
            </div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-white/40 mb-1">Pending Rewards</p>
            <p className="text-2xl font-semibold text-white/90">
              {stats?.total_earned_blind ? (Number(weiToEth(stats.total_earned_blind)) * 0.1).toFixed(4) : '--'}
            </p>
            <p className="text-[10px] text-white/30 mt-1">10% of earned</p>
          </GlassCard>
        </div>
      </section>

      {/* Performance Metrics */}
      <section>
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40 mb-4">Performance Metrics</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <GlassCard className="p-5">
            <p className="text-[10px] font-mono uppercase tracking-wider text-white/40 mb-1">Avg Reward/Job</p>
            <p className="text-2xl font-semibold text-white">
              {stats && stats.total_jobs > 0 ? (Number(stats.total_earned_blind) / stats.total_jobs / 1e18).toFixed(4) : '0'}
            </p>
            <p className="text-[10px] text-white/30 mt-1">BLIND</p>
          </GlassCard>

          <GlassCard className="p-5">
            <p className="text-[10px] font-mono uppercase tracking-wider text-white/40 mb-1">Settlement Rate</p>
            <p className="text-2xl font-semibold text-white">{successRate}%</p>
            <p className="text-[10px] text-white/30 mt-1">Jobs settled</p>
          </GlassCard>

          <GlassCard className="p-5">
            <p className="text-[10px] font-mono uppercase tracking-wider text-white/40 mb-1">Uptime %</p>
            <p className="text-2xl font-semibold text-white">{stats ? `${Math.max(0, 100 - (stats.failed ?? 0) * 5)}%` : '99.9%'}</p>
            <p className="text-[10px] text-white/30 mt-1">Estimated</p>
          </GlassCard>

          <GlassCard className="p-5">
            <p className="text-[10px] font-mono uppercase tracking-wider text-white/40 mb-1">Slash Count</p>
            <p className={`text-2xl font-semibold ${(stats?.slash_count ?? 0) > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {stats?.slash_count ?? 0}
            </p>
            <p className="text-[10px] text-white/30 mt-1">{(stats?.slash_count ?? 0) > 0 ? 'Risk detected' : 'Safe'}</p>
          </GlassCard>
        </div>
      </section>

      {/* Charts Section */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Job Status Distribution */}
        <GlassCard className="p-5">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40 mb-4">Job Status Distribution</p>
          {jobStatusData.every(d => d.value === 0) ? (
            <div className="flex items-center justify-center h-64 text-white/30 text-sm">No jobs yet</div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={jobStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {jobStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(10,10,10,0.9)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      color: '#fff'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-center gap-4 mt-2">
                {jobStatusData.map(d => (
                  <div key={d.name} className="flex items-center gap-2 text-xs text-white/50">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                    {d.name}: {d.value}
                  </div>
                ))}
              </div>
            </div>
          )}
        </GlassCard>

        {/* Earnings Over Time */}
        <GlassCard className="p-5">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40 mb-4">Earnings Over Time</p>
          {Number(weiToEth(stats?.total_earned_blind ?? '0')) === 0 ? (
            <div className="flex items-center justify-center h-64 text-white/30 text-sm">Start earning by processing inference jobs</div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={earningsData}>
                  <defs>
                    <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" stroke="rgba(255,255,255,0.2)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} />
                  <YAxis stroke="rgba(255,255,255,0.2)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(10,10,10,0.9)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      color: '#fff'
                    }}
                  />
                  <Area type="monotone" dataKey="earnings" stroke="#f97316" fill="url(#colorEarnings)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </GlassCard>
      </section>

      {/* Filters & Tabs + Job History Table */}
      <section>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">Job History</p>
          <div className="flex items-center gap-2">
            {[
              { key: 'all', label: 'All Jobs', count: allCount },
              { key: 'leader', label: 'As Leader', count: leaderCount },
              { key: 'verifier', label: 'As Verifier', count: verifierCount },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilterRole(tab.key as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 ${
                  filterRole === tab.key
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                    : 'text-white/50 border border-white/10 hover:bg-white/5'
                }`}
              >
                {tab.label}
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${filterRole === tab.key ? 'bg-orange-500/30 text-orange-300' : 'bg-white/10 text-white/40'}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        <GlassCard className="p-0 overflow-hidden">
          {statsError ? (
            <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-4 text-sm text-red-400 m-4">
              {statsError}
            </div>
          ) : jobsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-white/50 animate-spin" />
            </div>
          ) : (
            <>
              {filteredJobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Server className="w-8 h-8 text-white/20 mb-3" />
                  <p className="text-sm text-white/40 mb-2">No jobs processed yet. Start your node to begin earning.</p>
                  <a href="/nodes" className="text-xs text-orange-400 hover:text-orange-300 transition-colors">
                    Go to Node Registration →
                  </a>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="px-5 py-3 text-[10px] font-mono uppercase tracking-wider text-white/40">Job ID</th>
                        <th className="px-5 py-3 text-[10px] font-mono uppercase tracking-wider text-white/40">Role</th>
                        <th className="px-5 py-3 text-[10px] font-mono uppercase tracking-wider text-white/40">Model</th>
                        <th className="px-5 py-3 text-[10px] font-mono uppercase tracking-wider text-white/40">Status</th>
                        <th className="px-5 py-3 text-[10px] font-mono uppercase tracking-wider text-white/40">Reward</th>
                        <th className="px-5 py-3 text-[10px] font-mono uppercase tracking-wider text-white/40">Date</th>
                        <th className="px-5 py-3 text-[10px] font-mono uppercase tracking-wider text-white/40">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredJobs.map((job, idx) => (
                        <tr
                          key={job.job_id + idx}
                          className="border-b border-white/5 hover:bg-white/5 transition-colors"
                        >
                          <td className="px-5 py-3 text-xs text-white/70 font-mono">{job.job_id}</td>
                          <td className="px-5 py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                              job.role === 'leader'
                                ? 'bg-orange-500/20 text-orange-400'
                                : 'bg-blue-500/20 text-blue-400'
                            }`}>
                              {job.role === 'leader' ? 'Leader' : 'Verifier'}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-xs text-white/50">{job.model_id}</td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                job.status === 'completed' ? 'bg-green-400' :
                                job.status === 'failed' ? 'bg-red-400' :
                                'bg-orange-400'
                              }`} />
                              <span className={`text-xs capitalize ${
                                job.status === 'completed' ? 'text-green-400' :
                                job.status === 'failed' ? 'text-red-400' :
                                'text-orange-400'
                              }`}>
                                {job.status}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-xs text-white/70 font-mono">
                            {job.amount_blind_earned ? weiToEth(job.amount_blind_earned) + ' BLIND' : '--'}
                          </td>
                          <td className="px-5 py-3 text-xs text-white/50">
                            {job.completed_at ? new Date(job.completed_at).toLocaleDateString() : '--'}
                          </td>
                          <td className="px-5 py-3">
                            <button
                              disabled
                              className="px-2 py-1 rounded border border-white/10 text-[10px] text-white/30 cursor-not-allowed"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </GlassCard>
      </section>
    </div>
  )
}
