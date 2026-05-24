import { useState } from 'react'
import { ShieldAlert, X, Loader2, CheckCircle, XCircle } from 'lucide-react'

export function DisputeModal({
  requestId,
  onClose,
  onSubmit,
}: {
  requestId: string
  onClose: () => void
  onSubmit: (evidence: string) => Promise<void>
}) {
  const [evidence, setEvidence] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setStatus('submitting')
    setError(null)
    try {
      await onSubmit(evidence)
      setStatus('success')
    } catch (err: any) {
      setStatus('error')
      setError(err.response?.data?.detail || err.message || 'Dispute submission failed')
    }
  }

  if (status === 'success') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Dispute Filed!</h3>
          <p className="text-sm text-zinc-400 mb-6">
            Your dispute has been submitted and is under review.
          </p>
          <button
            onClick={onClose}
            className="w-full rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-zinc-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-400" />
            <h3 className="text-base font-semibold text-white">File Dispute</h3>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-zinc-500 mb-4">
          Request ID: <span className="font-mono">{requestId}</span>
        </p>

        <div className="mb-4">
          <label className="block text-xs text-zinc-400 mb-2">Evidence (optional)</label>
          <textarea
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            placeholder="Describe why you believe the inference result is incorrect..."
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none resize-none"
            rows={4}
          />
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400 flex items-center gap-2">
            <XCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={status === 'submitting'}
          className="w-full rounded-lg bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {status === 'submitting' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <ShieldAlert className="w-4 h-4" />
              Submit Dispute
            </>
          )}
        </button>

        <p className="mt-3 text-[10px] text-zinc-600 text-center">
          Disputes must be filed within 72 hours of job completion.
        </p>
      </div>
    </div>
  )
}
