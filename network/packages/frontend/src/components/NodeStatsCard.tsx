import { type ReactNode } from 'react'

interface NodeStatsCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: ReactNode
  accent?: 'default' | 'warning' | 'danger' | 'success'
}

const accentClasses = {
  default: 'border-white/10 bg-[rgba(10,10,10,0.6)] glass-card',
  warning: 'border-warning/30 bg-warning/10',
  danger: 'border-error/30 bg-error/10',
  success: 'border-success/30 bg-success/10',
}

export function NodeStatsCard({ title, value, subtitle, icon, accent = 'default' }: NodeStatsCardProps) {
  return (
    <div className={`rounded-xl border p-5 ${accentClasses[accent]} glass-card-hover transition-colors`}>
      <div className="flex items-center gap-3 mb-3">
        <div className="text-orange-400">{icon}</div>
        <span className="text-xs font-medium text-white/50 uppercase tracking-wider">{title}</span>
      </div>
      <div className="text-2xl font-semibold text-white font-heading">{value}</div>
      {subtitle && <div className="text-xs text-white/50 mt-1">{subtitle}</div>}
    </div>
  )
}
