import { ExternalLink, Copy, CheckCircle } from 'lucide-react';
import { useState } from 'react';

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
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(txHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex justify-between items-center py-2 border-b border-zinc-800 last:border-0">
       <span className="text-[11px] text-zinc-500 font-bold uppercase tracking-widest">{label}</span>
       <div className="flex items-center gap-2">
         <a href={`https://sepolia.arbiscan.io/tx/${txHash}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-zinc-300 hover:text-white transition-colors">
            <span className="font-mono text-[11px] bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">{txHash.slice(0, 10)}...{txHash.slice(-4)}</span>
            <ExternalLink className="w-3 h-3 text-zinc-600" />
         </a>
         <button onClick={handleCopy} className="text-zinc-600 hover:text-zinc-300 transition-colors">
           {copied ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
         </button>
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
  const [taskCopied, setTaskCopied] = useState(false);

  return (
    <section className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 space-y-4">
      <h3 className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-black">On-Chain Evidence</h3>
      <div className="flex flex-col">
        <div className="flex justify-between items-center py-2 border-b border-zinc-800">
           <span className="text-[11px] text-zinc-500 font-bold uppercase tracking-widest">Task ID</span>
           <button
             onClick={() => {
               navigator.clipboard.writeText(taskId);
               setTaskCopied(true);
               setTimeout(() => setTaskCopied(false), 2000);
             }}
             className="flex items-center gap-1.5 text-zinc-300 hover:text-white transition-colors"
           >
             <span className="font-mono text-[11px] text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">{taskId.slice(0, 16)}...</span>
             {taskCopied ? <CheckCircle className="w-3 h-3 text-zinc-400" /> : <Copy className="w-3 h-3 text-zinc-600" />}
           </button>
        </div>
        {coveragePurchaseTx && <TxLink label="Coverage Plan" txHash={coveragePurchaseTx} />}
        {escrowCreationTx && <TxLink label="Escrow Created" txHash={escrowCreationTx} />}
        {resultCommitTx && <TxLink label="Result Commitment" txHash={resultCommitTx} />}
        {disputeSubmissionTx && <TxLink label="Dispute Submitted" txHash={disputeSubmissionTx} />}
        {disputeResolutionTx && <TxLink label="Dispute Resolution" txHash={disputeResolutionTx} />}
        {escrowReleaseTx && <TxLink label="Escrow Released" txHash={escrowReleaseTx} />}
      </div>
    </section>
  );
}
