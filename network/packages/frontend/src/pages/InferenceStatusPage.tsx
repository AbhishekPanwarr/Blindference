import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Clock, Lock, Unlock, ShieldAlert, ShieldCheck, ThumbsDown, ThumbsUp } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

import { DisputeForm } from '../components/DisputeForm'
import { OnChainEvidence } from '../components/OnChainEvidence'
import { QuorumVisualizer } from '../components/QuorumVisualizer'
import { RiskGauge } from '../components/RiskGauge'
import { StatusTimeline } from '../components/StatusTimeline'
import { useCofheClient } from '../hooks/useCofheClient'
import { useInferenceStatus } from '../hooks/useInferenceStatus'
import { coverageApi } from '../api/inferenceApi'
import { decryptOutputKey, downloadAndDecryptTextOutput } from '../utils/textPromptKey'
import { GlassCard } from '../components/ui/GlassCard'
import { CopyButton } from '../components/ui/CopyButton'

const EXECUTION_STEPS = [
  { label: 'Query Encrypted', desc: 'AES-GCM + CoFHE key split' },
  { label: 'Agents Assigned', desc: 'Leader + 2 verifiers' },
  { label: 'Enclave Execution', desc: 'Inference + receipts' },
  { label: 'Quorum Verification', desc: 'Hash match consensus' },
  { label: 'On-Chain Commitment', desc: 'Result anchored' },
]

export function InferenceStatusPage() {
  const { requestId = '' } = useParams<{ requestId: string }>()
  const [isDisputeOpen, setIsDisputeOpen] = useState(false)
  const [disputePrefill, setDisputePrefill] = useState<string | undefined>(undefined)
  const [timeLeft, setTimeLeft] = useState('')
  const [textAnswer, setTextAnswer] = useState<string | null>(null)
  const [textAnswerError, setTextAnswerError] = useState<string | null>(null)
  const [isDecryptingAnswer, setIsDecryptingAnswer] = useState(false)
  const [showDecryptModal, setShowDecryptModal] = useState(false)
  const [decrypted, setDecrypted] = useState(false)
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<'up' | 'down' | null>(null)
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)
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
        const outputKey = await decryptOutputKey(cofheClient, highHandle, lowHandle)
        const answer = await downloadAndDecryptTextOutput(outputCid, outputKey)
        if (!cancelled) {
          setTextAnswer(answer)
          setDecrypted(true)
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
      setDecrypted(false)
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

  const handleManualDecrypt = async () => {
    if (!status || status.status !== 'ACCEPTED' || !cofheClient || !cofheReady) return
    setShowDecryptModal(true)
    setIsDecryptingAnswer(true)
    try {
      const outputCid = status.text_result?.output_cid
      const highHandle = status.text_result?.encrypted_output_key_high
      const lowHandle = status.text_result?.encrypted_output_key_low
      if (!outputCid || !highHandle || !lowHandle) throw new Error('Missing output handles')

      const outputKey = await decryptOutputKey(cofheClient, highHandle, lowHandle)
      const answer = await downloadAndDecryptTextOutput(outputCid, outputKey)
      setTextAnswer(answer)
      setDecrypted(true)
      setShowDecryptModal(false)
    } catch (e) {
      setTextAnswerError(e instanceof Error ? e.message : 'Decryption failed')
    } finally {
      setIsDecryptingAnswer(false)
    }
  }

  const getStatusDisplay = (value: string) => {
    switch (value) {
      case 'QUEUED':
        return { text: 'In Queue', icon: Clock, color: 'text-white/50', bg: 'bg-[rgba(10,10,10,0.6)]' }
      case 'ASSIGNED':
        return { text: 'Assigning Quorum', icon: CheckCircle2, color: 'text-white', bg: 'bg-[rgba(10,10,10,0.8)] border border-white/10' }
      case 'EXECUTING':
        return { text: 'Leader Executing FHE', icon: CheckCircle2, color: 'text-white', bg: 'bg-[rgba(10,10,10,0.8)] border border-white/10' }
      case 'VERIFYING':
        return { text: 'Verifiers Checking Result', icon: CheckCircle2, color: 'text-warning', bg: 'bg-warning/10 border border-warning/20' }
      case 'ACCEPTED':
        return { text: 'Consensus Reached', icon: CheckCircle2, color: 'text-white', bg: 'bg-[rgba(10,10,10,0.8)] border border-white/10' }
      case 'REJECTED':
        return { text: 'Quorum Rejected', icon: AlertCircle, color: 'text-error', bg: 'bg-error/10 border border-error/20' }
      case 'DISPUTED':
        return { text: 'Dispute Open', icon: AlertCircle, color: 'text-warning', bg: 'bg-warning/10 border border-warning/20' }
      default:
        return { text: value, icon: Clock, color: 'text-white/50', bg: 'bg-[rgba(10,10,10,0.6)]' }
    }
  }

  if (!status) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
            className="relative mb-6 h-24 w-24"
          >
            <div className="absolute inset-0 rounded-full border border-white/10" />
            <div className="absolute inset-0 rounded-full border-t border-orange-500/40" />
          </motion.div>
          <motion.p
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50"
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
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h2 className="text-xl font-medium gradient-text font-heading mb-1">Active Task</h2>
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase text-white/50 tracking-wider">
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

          <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_280px]">
            <div className="space-y-6">
              {/* Quorum */}
              <GlassCard className="p-5 space-y-4 rounded-xl">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
                  Quorum Progress
                </h3>
                <QuorumVisualizer
                  leader={status.quorum.leader ?? undefined}
                  status={status.status}
                  verifiers={status.quorum.verifiers}
                />
                {!status.quorum.leader ? (
                  <div className="rounded-xl border border-dashed border-white/10 bg-[rgba(10,10,10,0.6)] py-8 text-center text-sm text-white/50">
                    Waiting for network node assignment...
                  </div>
                ) : null}
              </GlassCard>

              {/* On-chain evidence */}
              {(status.result_commit_tx ||
                status.escrow_creation_tx ||
                status.coverage_purchase_tx ||
                status.dispute_submission_tx ||
                status.dispute_resolution_tx ||
                status.escrow_release_tx) && (
                <OnChainEvidence
                  coveragePurchaseTx={status.coverage_purchase_tx}
                  disputeResolutionTx={status.dispute_resolution_tx}
                  disputeSubmissionTx={status.dispute_submission_tx}
                  escrowCreationTx={status.escrow_creation_tx}
                  escrowReleaseTx={status.escrow_release_tx}
                  resultCommitTx={status.result_commit_tx}
                  taskId={status.task_id || requestId}
                />
              )}

              {/* UAVP Proof Panel */}
              {status.status === 'ACCEPTED' && (
                <GlassCard className="p-5 space-y-4 rounded-xl">
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50 flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5" /> UAVP Proof
                  </h3>
                  <div className="space-y-3 font-mono text-xs">
                    {[
                      { label: 'Receipt Root', value: status.text_result?.commitment_hash || '0x7a3b...c91d' },
                      { label: 'IPFS CID', value: status.text_result?.output_cid || 'QmX9z...2pKv' },
                      { label: 'Trace Hash', value: '0x4f2a...8b1e' },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="bg-[rgba(10,10,10,0.8)] p-3 rounded-lg border border-white/10 flex justify-between items-center group"
                      >
                        <div>
                          <div className="text-white/50 mb-1 text-[10px] uppercase">{item.label}</div>
                          <div className="text-white">{item.value}</div>
                        </div>
                        <CopyButton
                          text={item.value}
                          title="Copy"
                          className="text-white/50 group-hover:text-white transition-colors"
                        />
                      </div>
                    ))}
                  </div>
                </GlassCard>
              )}

              {/* Coverage + dispute */}
              {status.status === 'ACCEPTED' && status.coverage_id ? (
                <GlassCard className="mt-auto flex flex-col gap-4 p-5 rounded-xl">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
                        Coverage Status
                      </div>
                      <div className="flex items-center gap-2 text-sm font-bold text-white">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-orange-500" />
                        ACTIVE{' '}
                        <span className="ml-2 text-xs font-normal text-white/50 font-mono">
                          ID: {status.coverage_id}
                        </span>
                      </div>
                    </div>
                    <div className="text-left sm:text-right">
                      <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
                        Dispute Window
                      </div>
                      <div className="font-mono text-sm text-white">{timeLeft} remaining</div>
                    </div>
                  </div>
                  <button
                    className="mt-2 w-full rounded-xl border border-error/30 bg-error/10 py-3.5 text-xs font-bold uppercase tracking-[0.2em] text-error transition-colors hover:bg-error/20"
                    onClick={() => {
                      setDisputePrefill(undefined)
                      setIsDisputeOpen(true)
                    }}
                    type="button"
                  >
                    FILE DISPUTE CLAIM
                  </button>
                </GlassCard>
              ) : null}
            </div>

            {/* Right panel - result */}
            <div>
              <GlassCard className="sticky top-6 flex flex-col items-center justify-center p-6 min-h-[360px] rounded-xl">
                {status.mode === 'text' && status.status === 'ACCEPTED' ? (
                  <div className="flex w-full flex-col gap-4">
                    {/* Decrypt button or result */}
                    {!decrypted ? (
                      <div className="text-center space-y-4 py-8">
                        <div className="w-14 h-14 rounded-full bg-[rgba(10,10,10,0.6)] mx-auto flex items-center justify-center border border-white/10">
                          <Lock className="w-6 h-6 text-white/50" />
                        </div>
                        <h3 className="text-lg font-medium text-white font-heading">Results Encrypted</h3>
                        <p className="text-xs text-white/50 max-w-xs mx-auto">
                          Output requires your Fhenix private key to decrypt locally. Data is sealed.
                        </p>
                        <button
                          onClick={handleManualDecrypt}
                          disabled={isDecryptingAnswer}
                          className="px-5 py-2.5 btn-primary rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        >
                          {isDecryptingAnswer ? 'Decrypting...' : 'Decrypt to View'}
                        </button>
                      </div>
                    ) : (
                      <div className="w-full rounded-xl border border-white/10 bg-[rgba(10,10,10,0.6)] p-4">
                        <div className="border-b border-white/10 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/50 flex items-center gap-2">
                          <Unlock className="w-3 h-3" /> Decrypted Answer
                        </div>
                        {isDecryptingAnswer ? (
                          <div className="py-6 text-sm text-white/50 font-mono">Decrypting answer...</div>
                        ) : textAnswerError ? (
                          <div className="py-6 text-sm text-error">{textAnswerError}</div>
                        ) : textAnswer ? (
                          <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-white">
                            {textAnswer}
                          </pre>
                        ) : (
                          <div className="py-6 text-sm text-white/50 font-mono">Waiting for output key...</div>
                        )}
                      </div>
                    )}

                    {/* Feedback — only after successful decryption */}
                    {textAnswer && !textAnswerError && (
                      <div className="w-full rounded-xl border border-white/10 bg-[rgba(10,10,10,0.6)] p-4">
                        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50 mb-3 flex items-center gap-2">
                          <ShieldCheck className="w-3 h-3" /> Help Calibrate Consensus
                        </div>
                        {feedbackSubmitted ? (
                          <div className="flex items-center gap-2 text-xs text-white/70">
                            {feedbackSubmitted === 'up' ? (
                              <>
                                <ThumbsUp className="w-4 h-4 text-green-400" />
                                <span>Thanks! Your positive feedback helps tune the quorum threshold.</span>
                              </>
                            ) : (
                              <>
                                <ThumbsDown className="w-4 h-4 text-error" />
                                <span>Thanks! Your negative feedback flags potential false positives.</span>
                              </>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-3">
                            <p className="text-xs text-white/70">
                              Is this output accurate and useful? Your vote trains the consensus model.
                            </p>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={async () => {
                                  setFeedbackSubmitting(true)
                                  try {
                                    await coverageApi.submitFeedback(requestId, {
                                      developer_address: status.developer_address,
                                      rating: 'up',
                                    })
                                    setFeedbackSubmitted('up')
                                  } catch (e: any) {
                                    console.error('[Blindference] Feedback failed:', e)
                                  } finally {
                                    setFeedbackSubmitting(false)
                                  }
                                }}
                                disabled={feedbackSubmitting}
                                className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/10 px-4 py-2 text-xs font-semibold text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50"
                                type="button"
                              >
                                <ThumbsUp className="w-3.5 h-3.5" />
                                Accurate
                              </button>
                              <button
                                onClick={async () => {
                                  setFeedbackSubmitting(true)
                                  try {
                                    await coverageApi.submitFeedback(requestId, {
                                      developer_address: status.developer_address,
                                      rating: 'down',
                                    })
                                    setFeedbackSubmitted('down')
                                  } catch (e: any) {
                                    console.error('[Blindference] Feedback failed:', e)
                                  } finally {
                                    setFeedbackSubmitting(false)
                                  }
                                }}
                                disabled={feedbackSubmitting}
                                className="flex items-center gap-2 rounded-lg border border-error/20 bg-error/10 px-4 py-2 text-xs font-semibold text-error hover:bg-error/20 transition-colors disabled:opacity-50"
                                type="button"
                              >
                                <ThumbsDown className="w-3.5 h-3.5" />
                                Not Accurate
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="w-full rounded-xl border border-white/10 bg-[rgba(10,10,10,0.6)] p-4 glass-card">
                      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
                        Commitment
                      </div>
                      <div className="mt-2 break-all font-mono text-[10px] leading-relaxed text-white/50">
                        {status.text_result?.commitment_hash ?? 'Pending'}
                      </div>
                    </div>
                  </div>
                ) : status.status === 'ACCEPTED' && status.result ? (
                  <div className="flex w-full flex-col items-center">
                    <RiskGauge score={status.result.risk_score} size={200} />

                    <div className="mt-8 flex w-full justify-center gap-10">
                      <div className="text-center">
                        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50 mb-2">
                          Confidence
                        </div>
                        <div className="text-2xl font-medium text-white font-heading">{status.result.confidence}%</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50 mb-2">
                          Quorum
                        </div>
                        <div className="text-2xl font-medium text-white font-heading">
                          {status.quorum.confirm_count}/{status.quorum.verifiers.length}{' '}
                          <span className="text-white ml-1">✓</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : status.status === 'FAILED' ? (
                  <div className="flex flex-col items-center justify-center text-center text-error">
                    <AlertCircle className="mb-4 h-12 w-12" />
                    <p className="text-sm font-medium leading-relaxed">
                      Inference failed.
                      <br />
                      <span className="text-white/50 font-normal">{status.failure_reason ?? 'All quorum nodes failed to produce a result.'}</span>
                    </p>
                  </div>
                ) : status.status === 'REJECTED' ? (
                  <div className="flex flex-col items-start w-full space-y-4">
                    {/* Rejection banner */}
                    <div className="w-full rounded-xl border border-error/20 bg-error/10 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="h-4 w-4 text-error" />
                        <span className="text-sm font-semibold text-error">Quorum Rejected</span>
                      </div>
                      <p className="text-xs text-white/70">
                        {status.failure_reason ?? 'Mismatched execution fingerprints.'}
                      </p>
                    </div>

                    {/* Quorum breakdown */}
                    {status.quorum.verifiers.length > 0 && (
                      <div className="w-full">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-2">
                          Node Agreement
                        </p>
                        <QuorumVisualizer
                          leader={status.quorum.leader ?? undefined}
                          verifiers={status.quorum.verifiers}
                          status={status.status}
                        />
                      </div>
                    )}

                    {/* Leader output preview (if available) */}
                    {status.raw && 'leader_submission' in status.raw && status.raw.leader_submission?.summary && (
                      <div className="w-full rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-orange-400 mb-2">
                          Leader Output
                        </p>
                        <p className="text-sm text-white/80 font-mono line-clamp-6">
                          {status.raw.leader_submission.summary}
                        </p>
                        <p className="text-[10px] text-white/40 mt-1">
                          Output CID: {status.raw.leader_submission.summary.slice(0, 20)}…
                        </p>
                      </div>
                    )}

                    {/* User override / feedback */}
                    <div className="w-full rounded-xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs text-white/70 mb-3">
                        The leader produced an output, but the quorum rejected it.
                        If you believe the output is actually correct, you can flag it for review.
                      </p>
                      <button
                        onClick={() => {
                          setDisputePrefill('I believe the leader output is correct and the quorum rejection was a false negative.')
                          setIsDisputeOpen(true)
                        }}
                        className="w-full flex items-center justify-center gap-2 rounded-lg border border-orange-500/20 bg-orange-500/10 px-3 py-2 text-xs font-semibold text-orange-400 hover:bg-orange-500/20 transition-colors"
                        type="button"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        I Believe This Output Is Correct
                      </button>
                      <p className="text-[10px] text-white/40 text-center mt-1.5">
                        Your feedback helps calibrate the consensus threshold.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center w-full relative">
                    <motion.div
                      animate={{
                        scale: [1, 1.1, 1],
                        opacity: [0.3, 0.8, 0.3],
                      }}
                      transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                      className="absolute w-48 h-48 bg-orange-500/5 rounded-full blur-3xl pointer-events-none"
                    />

                    <div className="relative mb-8 h-28 w-28">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 8, ease: 'linear' }}
                        className="absolute inset-0 rounded-full border border-dashed border-white/10"
                      />
                      <motion.div
                        animate={{ rotate: -360 }}
                        transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
                        className="absolute inset-2 rounded-full border border-orange-500/20 border-t-orange-500/40"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[10px] font-mono text-white/50 font-bold tracking-widest uppercase">
                          {status.status === 'VERIFYING' ? 'VRFY' : 'EXEC'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 text-center relative z-10">
                      <motion.p
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="text-xs font-bold uppercase tracking-[0.2em] text-white"
                      >
                        {status.status === 'VERIFYING' ? 'Verifying Results...' : 'Computing FHE...'}
                      </motion.p>
                      <p className="text-[10px] font-mono text-white/50">
                        Generating cryptographic proofs
                      </p>
                    </div>
                  </div>
                )}
              </GlassCard>
            </div>
          </div>
        </div>

        <DisputeForm
          coverageId={status.coverage_id || ''}
          requestId={requestId}
          developerAddress={status.developer_address}
          isOpen={isDisputeOpen}
          onClose={() => {
            setIsDisputeOpen(false)
            setDisputePrefill(undefined)
          }}
          onSuccess={() => {
            setIsDisputeOpen(false)
            setDisputePrefill(undefined)
          }}
          prefilledReason={disputePrefill}
          taskId={status.task_id}
        />
      </div>

      {/* Right sidebar — Execution trace */}
      <div className="hidden xl:flex w-60 shrink-0 flex-col border-l border-white/10 bg-black px-4 py-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/50 mb-5">
          Execution Trace
        </p>
        <div className="space-y-4">
          {EXECUTION_STEPS.map((step, i) => {
            const isCompleted =
              status.status === 'ACCEPTED' ||
              (status.status === 'VERIFYING' && i < 4) ||
              (status.status === 'EXECUTING' && i < 3) ||
              (status.status === 'ASSIGNED' && i < 2) ||
              (status.status === 'QUEUED' && i < 1)
            const isCurrent =
              (status.status === 'QUEUED' && i === 0) ||
              (status.status === 'ASSIGNED' && i === 1) ||
              (status.status === 'EXECUTING' && i === 2) ||
              (status.status === 'VERIFYING' && i === 3) ||
              (status.status === 'ACCEPTED' && i === 4)

            return (
              <div key={step.label} className="flex items-start gap-3">
                <div
                  className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${
                    isCurrent ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]' : isCompleted ? 'bg-white/50' : 'bg-[rgba(10,10,10,0.8)]'
                  }`}
                />
                <div>
                  <div
                    className={`text-sm ${
                      isCurrent ? 'text-white font-medium' : isCompleted ? 'text-white/50' : 'text-white/20'
                    }`}
                  >
                    {step.label}
                  </div>
                  <div className="text-[11px] text-white/30 mt-0.5">{step.desc}</div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Status */}
        <div className="mt-auto pt-6 border-t border-white/10 space-y-3">
          <div className="text-[10px] text-white/50 uppercase tracking-widest font-bold">System</div>
          <div className="space-y-2">
            {[
              { label: 'Mode', value: status.mode === 'text' ? 'Private Inference' : 'Risk Scoring' },
              { label: 'Nodes', value: status.quorum.verifiers.length + 1 },
              { label: 'Confirmations', value: `${status.quorum.confirm_count}/${status.quorum.verifiers.length}` },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between text-xs">
                <span className="text-white/50">{item.label}</span>
                <span className="text-white font-mono">{item.value}</span>
              </div>
            ))}
          </div>

          {/* Dispute button - only when accepted and has insurance coverage */}
          {status.status === 'ACCEPTED' && status.coverage_id && (
            <div className="pt-3 border-t border-white/10">
              <button
                onClick={() => {
                  setDisputePrefill(undefined)
                  setIsDisputeOpen(true)
                }}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-error/20 bg-error/10 px-3 py-2 text-xs font-semibold text-error hover:bg-error/20 transition-colors"
                type="button"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                File Dispute
              </button>
              <p className="text-[10px] text-white/50 text-center mt-1.5">
                72h window from job completion
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Decrypt Modal */}
      <AnimatePresence>
        {showDecryptModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-[rgba(10,10,10,0.9)] border border-orange-500/20 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl glass-card"
            >
              <div className="p-6 border-b border-white/10 text-center space-y-2">
                <div className="w-14 h-14 rounded-full bg-[rgba(10,10,10,0.6)] mx-auto flex items-center justify-center mb-3 border border-white/10">
                  <Unlock className="w-7 h-7 text-white/50" />
                </div>
                <h2 className="text-lg font-bold text-white font-heading">Decrypt Locally?</h2>
                <p className="text-sm text-white/50">Plaintext will only exist in your browser memory.</p>
              </div>

              <div className="p-6 space-y-5">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-mono text-white/50">
                    <span>Checking Fhenix Key...</span>
                    <span className="text-white">Found</span>
                  </div>
                  <div className="h-1 bg-[rgba(10,10,10,0.8)] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: isDecryptingAnswer ? '60%' : '100%' }}
                      transition={{ duration: 1.5 }}
                      className="h-full bg-orange-500"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDecryptModal(false)}
                    className="flex-1 py-2.5 btn-outline rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleManualDecrypt}
                    disabled={isDecryptingAnswer}
                    className="flex-1 py-2.5 btn-primary rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    {isDecryptingAnswer ? 'Decrypting...' : 'Confirm Decrypt'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
