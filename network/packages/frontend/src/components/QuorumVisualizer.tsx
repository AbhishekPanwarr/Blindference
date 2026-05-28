import { CheckCircle2, CircleDashed, Clock, XCircle } from 'lucide-react';
import { truncateAddress } from '../utils/helpers';
import { cn } from '../utils/helpers';
import { Badge } from './ui/Badge';
import { GlassCard } from './ui/GlassCard';

interface NodeInfo {
  address: string;
  status: string;
  stake?: number;
  reputationScore?: number;
}

interface VerdictInfo {
  address: string;
  verdict: 'CONFIRM' | 'REJECT' | null;
  confidence: number;
  stake?: number;
  reputationScore?: number;
}

interface QuorumVisualizerProps {
  leader?: NodeInfo;
  verifiers?: VerdictInfo[];
  status: string;
}

function RepBadge({ rep }: { rep?: number }) {
  if (rep === undefined) return null;
  const color = rep > 80 ? 'text-orange-400 bg-orange-500/10 border-orange-500/20' : rep > 50 ? 'text-white/50 bg-orange-500/5 border-orange-500/10' : 'text-error bg-error/10 border-error/20';
  return (
     <span className={`text-[9px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded border ${color}`}>Rep: {rep}%</span>
  )
}

export function QuorumVisualizer({ leader, verifiers, status }: QuorumVisualizerProps) {
  return (
    <div className="space-y-3">
      {leader && (
        <GlassCard className="flex items-center gap-4 p-4 rounded-xl">
          <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400 font-bold text-xs uppercase tracking-wider border border-orange-500/30 glow-primary">
            L
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-0.5">
               <span className="text-sm font-semibold text-white block">Leader Node</span>
               <RepBadge rep={leader.reputationScore} />
            </div>
            <span className="font-mono text-xs text-white/50 flex items-center gap-2">
               {truncateAddress(leader.address)}
               {leader.stake && <span className="opacity-60">• Stake: {leader.stake} GNK</span>}
            </span>
          </div>
          <StatusBadge status={leader.status} />
        </GlassCard>
      )}

      {verifiers?.map((v, i) => (
        <GlassCard key={i} className="flex items-center gap-4 p-4 rounded-xl">
          <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-400 font-bold text-xs border border-orange-500/20">
            V{i + 1}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-0.5">
               <span className="text-sm font-semibold text-white block">Verifier {i+1}</span>
               <RepBadge rep={v.reputationScore} />
            </div>
            <span className="font-mono text-xs text-white/50 flex items-center gap-2">
               {truncateAddress(v.address)}
               {v.stake && <span className="opacity-60">• Stake: {v.stake} GNK</span>}
            </span>
          </div>
          {v.verdict === 'CONFIRM' ? (
            <Badge variant="secondary" className="gap-1.5 px-2.5 py-1 bg-success/10 text-success border-success/20 rounded-md text-[11px] font-bold tracking-widest uppercase">
              <CheckCircle2 className="w-3.5 h-3.5" />
              CONFIRM
            </Badge>
          ) : v.verdict === 'REJECT' ? (
            <Badge variant="secondary" className="gap-1.5 px-2.5 py-1 bg-error/10 text-error border-error/20 rounded-md text-[11px] font-bold tracking-widest uppercase">
              <XCircle className="w-3.5 h-3.5" />
              REJECT
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1.5 px-2.5 py-1 bg-warning/10 text-warning border-warning/20 rounded-md text-[11px] font-bold tracking-widest uppercase">
              <CircleDashed className="w-3.5 h-3.5 animate-spin" />
              WAITING
            </Badge>
          )}
        </GlassCard>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isComplete = status === 'COMPLETE' || status === 'EXECUTED';
  return (
    <Badge
      variant="secondary"
      className={cn(
        "px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest",
        isComplete
          ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
          : "bg-[rgba(10,10,10,0.8)] text-white/50 border-white/10"
      )}
    >
      {status}
    </Badge>
  );
}
