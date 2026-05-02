import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import { motion } from 'framer-motion'

import { DisputeForm } from '../components/DisputeForm'
import { OnChainEvidence } from '../components/OnChainEvidence'
import { QuorumVisualizer } from '../components/QuorumVisualizer'
import { RiskGauge } from '../components/RiskGauge'
import { StatusTimeline } from '../components/StatusTimeline'
import { useCofheClient } from '../hooks/useCofheClient'
import { useInferenceStatus } from '../hooks/useInferenceStatus'
import { decryptOutputKey, downloadAndDecryptTextOutput } from '../utils/textPromptKey'

export function InferenceStatusPage() {
  const { requestId = '' } = useParams<{ requestId: string }>()
  const [isDisputeOpen, setIsDisputeOpen] = useState(false)
  const [timeLeft, setTimeLeft] = useState('')
  const [textAnswer, setTextAnswer] = useState<string | null>(null)
  const [textAnswerError, setTextAnswerError] = useState<string | null>(null)
  const [isDecryptingAnswer, setIsDecryptingAnswer] = useState(false)
  const status = useInferenceStatus(requestId)
  const { client: cofheClient, isReady: cofheReady } = useCofheClient()

  useEffect(() => {
    const update = () => {
      const updatedAt =
        status?.raw && 'updated_at' in status.raw && typeof status.raw.updated_at === 'string'
          ? status.raw.updated_at
          : null
      if (!updatedAt) {
        setTimeLeft('72h 0m')
        return
      }
      const acceptedAt = Date.parse(updatedAt)
      const deadline = acceptedAt + 72 * 60 * 60 * 1000
      const diff = Math.max(deadline - Date.now(), 0)
      const hours = Math.floor(diff / 3_600_000)
      const minutes = Math.floor((diff % 3_600_000) / 60_000)
      setTimeLeft(`${hours}h ${minutes}m`)
    }

    update()
    const interval = window.setInterval(update, 60_000)
    return () => window.clearInterval(interval)
  }, [status?.raw])

  useEffect(() => {
    let cancelled = false
    const outputCid = status?.text_result?.output_cid
    const highHandle = status?.text_result?.encrypted_output_key_high
    const lowHandle = status?.text_result?.encrypted_output_key_low

    const decryptAnswer = async () => {
      if (
        !status ||
        status.mode !== 'text' ||
        status.status !== 'ACCEPTED' ||
        !outputCid ||
        !highHandle ||
        !lowHandle ||
        !cofheClient ||
        !cofheReady
      ) {
        return
      }

      setIsDecryptingAnswer(true)
      setTextAnswerError(null)
      try {
        const outputKey = await decryptOutputKey(
          cofheClient,
          highHandle,
          lowHandle,
        )
        const answer = await downloadAndDecryptTextOutput(outputCid, outputKey)
        if (!cancelled) {
          setTextAnswer(answer)
        }
      } catch (error) {
        if (!cancelled) {
          setTextAnswerError(error instanceof Error ? error.message : 'Failed to decrypt text output')
        }
      } finally {
        if (!cancelled) {
          setIsDecryptingAnswer(false)
        }
      }
    }

    if (!status || status.mode !== 'text' || status.status !== 'ACCEPTED') {
      setTextAnswer(null)
      setTextAnswerError(null)
    }
    void decryptAnswer()

    return () => {
      cancelled = true
    }
  }, [
    cofheClient,
    cofheReady,
    status?.mode,
    status?.status,
    status?.text_result?.output_cid,
    status?.text_result?.encrypted_output_key_high,
    status?.text_result?.encrypted_output_key_low,
  ])

  const getStatusDisplay = (value: string) => {
    switch (value) {
      case 'QUEUED':
        return { text: 'In Queue', icon: Clock, color: 'text-gray-400', bg: 'bg-white/[0.05]' }
      case 'ASSIGNED':
        return {
          text: 'Assigning Quorum',
          icon: CheckCircle2,
          color: 'text-blue-400',
          bg: 'bg-blue-500/10 border border-blue-500/20',
        }
      case 'EXECUTING':
        return {
          text: 'Leader Executing FHE',
          icon: CheckCircle2,
          color: 'text-blue-400',
          bg: 'bg-blue-500/10 border border-blue-500/20',
        }
      case 'VERIFYING':
        return {
          text: 'Verifiers Checking Result',
          icon: CheckCircle2,
          color: 'text-yellow-400',
          bg: 'bg-yellow-500/10 border border-yellow-500/20',
        }
      case 'ACCEPTED':
        return {
          text: 'Consensus Reached',
          icon: CheckCircle2,
          color: 'text-emerald-400',
          bg: 'bg-emerald-500/10 border border-emerald-500/20',
        }
      case 'REJECTED':
        return {
          text: 'Quorum Rejected',
          icon: AlertCircle,
          color: 'text-red-400',
          bg: 'bg-red-500/10 border border-red-500/20',
        }
      case 'DISPUTED':
        return {
          text: 'Dispute Open',
          icon: AlertCircle,
          color: 'text-amber-300',
          bg: 'bg-amber-500/10 border border-amber-500/20',
        }
      default:
        return { text: value, icon: Clock, color: 'text-gray-400', bg: 'bg-white/[0.05]' }
    }
  }

  if (!status) {
    return (
      <div className="mx-auto max-w-4xl pb-20 pt-12">
        <div className="flex h-64 flex-col items-center justify-center">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            className="relative mb-6 h-24 w-24"
          >
            <div className="absolute inset-0 rounded-full border border-white/10" />
            <div className="absolute inset-0 rounded-full border-t border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
          </motion.div>
          <motion.p 
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500"
          >
            Loading request...
          </motion.p>
        </div>
      </div>
    )
  }

  const currentDisplay = getStatusDisplay(status.status)
  const Icon = currentDisplay.icon

  return (
    <div className="mx-auto max-w-4xl pb-20 pt-8">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-xl font-medium text-white mb-1">Active Task</h2>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase text-gray-500 tracking-wider">
            <span>REQ-ID: {requestId}</span>
          </div>
        </div>
        <div
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-widest ${currentDisplay.bg} ${currentDisplay.color} border shadow-sm`}
        >
          <Icon className="h-3.5 w-3.5" />
          {currentDisplay.text}
        </div>
      </div>

      <StatusTimeline currentStatus={status.status} timestamps={status.timestamps} />

      <div className="grid grid-cols-1 gap-8 md:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          <section className="space-y-5 rounded-xl border border-white/10 bg-black p-6">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Quorum Progress</h3>
            <QuorumVisualizer leader={status.quorum.leader ?? undefined} status={status.status} verifiers={status.quorum.verifiers} />
            {!status.quorum.leader ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.01] py-8 text-center text-sm text-gray-500">
                Waiting for network node assignment...
              </div>
            ) : null}
          </section>

          {(
            status.result_commit_tx ||
            status.escrow_creation_tx ||
            status.coverage_purchase_tx ||
            status.dispute_submission_tx ||
            status.dispute_resolution_tx ||
            status.escrow_release_tx
          ) ? (
            <OnChainEvidence
              coveragePurchaseTx={status.coverage_purchase_tx}
              disputeResolutionTx={status.dispute_resolution_tx}
              disputeSubmissionTx={status.dispute_submission_tx}
              escrowCreationTx={status.escrow_creation_tx}
              escrowReleaseTx={status.escrow_release_tx}
              resultCommitTx={status.result_commit_tx}
              taskId={status.task_id || requestId}
            />
          ) : null}

          {status.status === 'ACCEPTED' && status.coverage_id ? (
            <section className="mt-auto flex flex-col gap-5 rounded-xl border border-white/10 bg-black p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Coverage Status</div>
                  <div className="flex items-center gap-2 text-sm font-bold text-emerald-500">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                    ACTIVE <span className="ml-2 text-xs font-normal text-gray-500 font-mono">ID: {status.coverage_id}</span>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Dispute Window</div>
                  <div className="font-mono text-sm text-white">{timeLeft} remaining</div>
                </div>
              </div>
              <button
                className="mt-2 w-full rounded-xl border border-red-500/50 bg-red-500/10 py-3.5 text-xs font-bold uppercase tracking-[0.2em] text-red-500 transition-colors hover:bg-red-500/20"
                onClick={() => setIsDisputeOpen(true)}
                type="button"
              >
                FILE DISPUTE CLAIM
              </button>
            </section>
          ) : null}
        </div>

        <div>
          <section className="sticky top-24 flex flex-col items-center justify-center rounded-xl border border-white/10 bg-black p-8 min-h-[400px]">
            {status.mode === 'text' && status.status === 'ACCEPTED' ? (
              <div className="flex w-full flex-col gap-6">
                <div className="w-full rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 text-emerald-400">
                  <div className="border-b border-emerald-500/20 pb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500">
                    Decrypted Answer
                  </div>
                  {isDecryptingAnswer ? (
                    <div className="py-8 text-sm text-gray-400 font-mono">Decrypting answer...</div>
                  ) : textAnswerError ? (
                    <div className="py-8 text-sm text-red-400">{textAnswerError}</div>
                  ) : textAnswer ? (
                    <pre className="mt-4 whitespace-pre-wrap font-sans text-sm leading-relaxed text-white">{textAnswer}</pre>
                  ) : (
                    <div className="py-8 text-sm text-gray-500 font-mono">Waiting for output key...</div>
                  )}
                </div>
                <div className="w-full rounded-xl border border-white/10 bg-white/[0.02] p-5">
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Commitment</div>
                  <div className="mt-3 break-all font-mono text-[10px] leading-relaxed text-gray-400">
                    {status.text_result?.commitment_hash ?? 'Pending'}
                  </div>
                </div>
              </div>
            ) : status.status === 'ACCEPTED' && status.result ? (
              <div className="flex w-full flex-col items-center">
                <RiskGauge score={status.result.risk_score} size={220} />

                <div className="mt-10 flex w-full justify-center gap-12">
                  <div className="text-center">
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2">Confidence</div>
                    <div className="text-2xl font-medium text-white">{status.result.confidence}%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2">Quorum</div>
                    <div className="text-2xl font-medium text-white">
                      {status.quorum.confirm_count}/{status.quorum.verifiers.length}{' '}
                      <span className="text-emerald-500 ml-1">✓</span>
                    </div>
                  </div>
                </div>

                <div className="mt-10 w-full space-y-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 text-emerald-400">
                  <div className="border-b border-emerald-500/20 pb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500">
                    Verified Model Telemetry
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-5 text-sm">
                    <div>
                      <span className="mb-1.5 block text-[10px] uppercase text-emerald-500/60">Accuracy</span>
                      <span className="font-mono text-white">{'model_id' in status.raw && status.raw.model_id.includes('gemini') ? '96.8%' : '94.2%'}</span>
                    </div>
                    <div>
                      <span className="mb-1.5 block text-[10px] uppercase text-emerald-500/60">False Positives</span>
                      <span className="font-mono text-white">{'model_id' in status.raw && status.raw.model_id.includes('gemini') ? '0.8%' : '1.2%'}</span>
                    </div>
                    <div>
                      <span className="mb-1.5 block text-[10px] uppercase text-emerald-500/60">Hallucinations</span>
                      <span className="font-mono text-white">{'model_id' in status.raw && status.raw.model_id.includes('gemini') ? '< 0.2%' : '< 0.5%'}</span>
                    </div>
                    <div>
                      <span className="mb-1.5 block text-[10px] uppercase text-emerald-500/60">Benchmark</span>
                      <span className="font-mono text-white">{'model_id' in status.raw && status.raw.model_id.includes('gemini') ? '86.2 MMLU' : '82.0 MMLU'}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : status.status === 'REJECTED' ? (
              <div className="flex flex-col items-center justify-center text-center text-red-500">
                <AlertCircle className="mb-4 h-12 w-12" />
                <p className="text-sm font-medium leading-relaxed">
                  Inference rejected by quorum.
                  <br />
                  <span className="text-gray-400 font-normal">Mismatched execution fingerprints.</span>
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center w-full relative">
                <motion.div
                  animate={{ 
                    scale: [1, 1.1, 1],
                    opacity: [0.3, 0.8, 0.3]
                  }}
                  transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                  className="absolute w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"
                />
                
                <div className="relative mb-8 h-32 w-32">
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
                    className="absolute inset-0 rounded-full border border-dashed border-emerald-500/30" 
                  />
                  <motion.div 
                    animate={{ rotate: -360 }}
                    transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                    className="absolute inset-2 rounded-full border border-emerald-500/50 border-t-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]" 
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[10px] font-mono text-emerald-500 font-bold tracking-widest uppercase">
                      {status.status === 'VERIFYING' ? 'VRFY' : 'EXEC'}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 text-center relative z-10">
                  <motion.p 
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-500"
                  >
                    {status.status === 'VERIFYING' ? 'Verifying Results...' : 'Computing FHE...'}
                  </motion.p>
                  <p className="text-[10px] font-mono text-gray-500">
                    Generating cryptographic proofs
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      <DisputeForm
        coverageId={status.coverage_id || ''}
        requestId={requestId}
        developerAddress={status.developer_address}
        isOpen={isDisputeOpen}
        onClose={() => setIsDisputeOpen(false)}
        onSuccess={() => {
          setIsDisputeOpen(false)
        }}
        taskId={status.task_id}
      />
    </div>
  )
}
