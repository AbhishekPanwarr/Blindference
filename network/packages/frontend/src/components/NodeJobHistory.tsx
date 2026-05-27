import { Server, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react'

interface NodeJob {
  job_id: string
  role: string
  status: string
  model_id: string
  amount_blind_earned: number | null
  completed_at: string
}

interface NodeJobHistoryProps {
  jobs: NodeJob[]
}

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { icon: typeof CheckCircle; className: string; label: string }> = {
    COMPLETED: { icon: CheckCircle, className: 'text-emerald-400 bg-emerald-950/30 border-emerald-900/30', label: 'Completed' },
    FAILED: { icon: XCircle, className: 'text-red-400 bg-red-950/30 border-red-900/30', label: 'Failed' },
    REFUNDED: { icon: XCircle, className: 'text-zinc-400 bg-zinc-900 border-zinc-800', label: 'Refunded' },
    RUNNING: { icon: Clock, className: 'text-yellow-400 bg-yellow-950/30 border-yellow-900/30', label: 'Running' },
  }
  const config = configs[status] || { icon: AlertTriangle, className: 'text-zinc-400 bg-zinc-900 border-zinc-800', label: status }
  const Icon = config.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium ${config.className}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  )
}

function RoleBadge({ role }: { role: string }) {
  const isLeader = role === 'leader'
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium ${
      isLeader
        ? 'text-blue-400 bg-blue-950/30 border-blue-900/30'
        : 'text-purple-400 bg-purple-950/30 border-purple-900/30'
    }`}>
      <Server className="w-3 h-3" />
      {isLeader ? 'Leader' : 'Verifier'}
    </span>
  )
}

export function NodeJobHistory({ jobs }: NodeJobHistoryProps) {
  if (jobs.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 text-center">
        <Server className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
        <p className="text-sm text-zinc-500">No jobs found yet.</p>
        <p className="text-xs text-zinc-600 mt-1">Jobs will appear here once you are assigned to a quorum.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <h3 className="text-sm font-medium text-white">Job History</h3>
        <span className="text-xs text-zinc-500">{jobs.length} jobs</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500">
              <th className="px-4 py-2 font-medium">Job ID</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Model</th>
              <th className="px-4 py-2 font-medium">Reward</th>
              <th className="px-4 py-2 font-medium">Completed</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.job_id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                <td className="px-4 py-2.5 font-mono text-zinc-400">{job.job_id.slice(0, 8)}...</td>
                <td className="px-4 py-2.5"><RoleBadge role={job.role} /></td>
                <td className="px-4 py-2.5"><StatusBadge status={job.status} /></td>
                <td className="px-4 py-2.5 text-zinc-400">{job.model_id}</td>
                <td className="px-4 py-2.5 text-zinc-300">
                  {job.amount_blind_earned !== null ? `${job.amount_blind_earned} BLIND` : '—'}
                </td>
                <td className="px-4 py-2.5 text-zinc-500">
                  {job.completed_at ? new Date(job.completed_at).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
