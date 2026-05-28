import { ExternalLink } from 'lucide-react';
import { GlassCard } from './ui/GlassCard';
import { CopyButton } from './ui/CopyButton';

interface OnChainEvidenceProps {
  taskId: string;
  resultCommitTx?: string;
  escrowCreationTx?: string;
  escrowReleaseTx?: string;
  coveragePurchaseTx?: string;
  disputeSubmissionTx?: string;
  disputeResolutionTx?: string;
}

function TxLink({ label, txHash }: { label: string; txHash: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-white/10 last:border-0">
       <span className="text-[11px] text-white/50 font-bold uppercase tracking-widest">{label}</span>
       <div className="flex items-center gap-2">
         <a href={`https://sepolia.arbiscan.io/tx/${txHash}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-white hover:text-orange-400 transition-colors">
            <span className="font-mono text-[11px] bg-[rgba(10,10,10,0.8)] px-1.5 py-0.5 rounded border border-white/10">{txHash.slice(0, 10)}...{txHash.slice(-4)}</span>
            <ExternalLink className="w-3 h-3 text-white/50" />
         </a>
         <CopyButton text={txHash} title="Copy hash" className="text-white/50 hover:text-white transition-colors" />
       </div>
    </div>
  );
}

export function OnChainEvidence({
  taskId,
  resultCommitTx,
  escrowCreationTx,
  escrowReleaseTx,
  coveragePurchaseTx,
  disputeSubmissionTx,
  disputeResolutionTx,
}: OnChainEvidenceProps) {
  return (
    <GlassCard className="p-5 space-y-4 rounded-xl">
      <h3 className="text-[10px] uppercase tracking-[0.2em] text-white/50 font-black">On-Chain Evidence</h3>
      <div className="flex flex-col">
        <div className="flex justify-between items-center py-2 border-b border-white/10">
           <span className="text-[11px] text-white/50 font-bold uppercase tracking-widest">Task ID</span>
           <div className="flex items-center gap-1.5 text-white hover:text-orange-400 transition-colors">
             <span className="font-mono text-[11px] text-white/50 bg-[rgba(10,10,10,0.8)] px-1.5 py-0.5 rounded border border-white/10">{taskId.slice(0, 16)}...</span>
             <CopyButton text={taskId} title="Copy task ID" className="text-white/50 hover:text-white transition-colors" />
           </div>
        </div>
        {coveragePurchaseTx && <TxLink label="Coverage Plan" txHash={coveragePurchaseTx} />}
        {escrowCreationTx && <TxLink label="Escrow Created" txHash={escrowCreationTx} />}
        {resultCommitTx && <TxLink label="Result Commitment" txHash={resultCommitTx} />}
        {disputeSubmissionTx && <TxLink label="Dispute Submitted" txHash={disputeSubmissionTx} />}
        {disputeResolutionTx && <TxLink label="Dispute Resolution" txHash={disputeResolutionTx} />}
        {escrowReleaseTx && <TxLink label="Escrow Released" txHash={escrowReleaseTx} />}
      </div>
    </GlassCard>
  );
}
