import { type ReactNode } from 'react'

interface NodeStatsCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: ReactNode
  accent?: 'default' | 'warning' | 'danger' | 'success'
}

const accentClasses = {
  default: 'border-zinc-800 bg-zinc-900/40',
  warning: 'border-yellow-900/30 bg-yellow-950/20',
  danger: 'border-red-900/30 bg-red-950/20',
  success: 'border-emerald-900/30 bg-emerald-950/20',
}

export function NodeStatsCard({ title, value, subtitle, icon, accent = 'default' }: NodeStatsCardProps) {
  return (
    <div className={`rounded-xl border p-5 ${accentClasses[accent]}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className="text-zinc-400">{icon}</div>
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{title}</span>
      </div>
      <div className="text-2xl font-semibold text-white">{value}</div>
      {subtitle && <div className="text-xs text-zinc-500 mt-1">{subtitle}</div>}
    </div>
  )
}
