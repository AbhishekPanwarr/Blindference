import { CheckCircle2 } from 'lucide-react';

const stages = ['QUEUED', 'ASSIGNED', 'EXECUTING', 'VERIFYING', 'ACCEPTED'];

export function StatusTimeline({ currentStatus, timestamps }: { currentStatus: string; timestamps: Record<string, number> }) {
  let currentIndex = stages.indexOf(currentStatus);
  if (currentStatus === 'REJECTED') {
     currentIndex = stages.indexOf('VERIFYING');
  }

  return (
    <div className="flex items-center justify-between w-full relative mb-10 mt-4 px-2">
      <div className="absolute top-3.5 left-0 w-full h-[2px] bg-white/5 -z-10 rounded-full" />
      <div className="absolute top-3.5 left-0 h-[2px] bg-white/30 -z-10 rounded-full transition-all duration-1000" style={{ width: `${Math.max(0, currentIndex) / (stages.length - 1) * 100}%` }} />

      {stages.map((stage, idx) => {
        const isCompleted = currentIndex >= idx;
        const isCurrent = currentIndex === idx && currentStatus !== 'ACCEPTED' && currentStatus !== 'REJECTED';
        const isRejected = currentStatus === 'REJECTED' && idx === stages.length - 1;
        const timestamp = timestamps[stage];

        return (
          <div key={stage} className="flex flex-col items-center relative group">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all shadow-sm ${
                isCompleted
                  ? 'bg-white/20 border-white text-white shadow-[0_0_10px_rgba(255,255,255,0.1)]'
                  : isRejected
                     ? 'bg-red-500/20 border-red-500 text-red-400'
                     : 'bg-[#0a0a0b] border-zinc-700 text-zinc-600'
               }`}>
              {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <div className={`w-1.5 h-1.5 rounded-full ${isCurrent ? 'bg-white animate-pulse' : 'bg-transparent'}`} />}
            </div>
            <div className="absolute top-9 flex flex-col items-center w-24">
               <span className={`text-[9px] uppercase tracking-widest font-bold ${isCompleted ? 'text-zinc-300' : 'text-zinc-600'}`}>{stage}</span>
               {timestamp && <span className="text-[9px] font-mono text-zinc-500 mt-0.5">{new Date(timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
