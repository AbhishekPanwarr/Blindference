import { useEffect, useState } from 'react'
import { Search, ChevronRight, Lock, MessageSquare, Trash2, Clock, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { loadHistory, clearHistory, type HistoryEntry } from '../utils/historyStore'

function formatDate(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const isYesterday = new Date(now.getTime() - 86400000).toDateString() === d.toDateString()
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  if (isToday) return `Today, ${time}`
  if (isYesterday) return `Yesterday, ${time}`
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}, ${time}`
}

function StatusIcon({ status }: { status: HistoryEntry['status'] }) {
  if (status === 'done') return <CheckCircle2 className="w-4 h-4 text-zinc-300" />
  if (status === 'error') return <AlertTriangle className="w-4 h-4 text-red-400" />
  if (status === 'ready') return <Lock className="w-4 h-4 text-zinc-400" />
  return <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />
}

export function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([])

  useEffect(() => {
    setEntries(loadHistory())
  }, [])

  const handleClear = () => {
    if (!confirm('Clear all inference history?')) return
    clearHistory()
    setEntries([])
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-medium text-white tracking-tight">Inference History</h1>
          <p className="text-sm text-zinc-500 mt-2">Past prompts, results, and privately decrypted outputs.</p>
        </div>
        <div className="flex items-center gap-3">
          {entries.length > 0 && (
            <button
              onClick={handleClear}
              className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </button>
          )}
          <Link to="/" className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-zinc-200 transition-colors">
            <Search className="w-4 h-4" />
            New Inference
          </Link>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-12 text-center">
          <Clock className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-white mb-1">No history yet</h3>
          <p className="text-sm text-zinc-500 mb-4">Your inference runs will appear here once you submit a prompt.</p>
          <Link to="/" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-zinc-200 transition-colors">
            <Search className="w-4 h-4" />
            Start Inferring
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
          {entries.map((item, i) => (
            <Link
              key={item.id}
              to={item.requestId ? `/inference/${item.requestId}` : '/'}
              className={`block p-4 flex items-center gap-4 hover:bg-zinc-800/50 transition-colors ${i !== 0 ? 'border-t border-zinc-800' : ''}`}
            >
              <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                <StatusIcon status={item.status} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-white truncate">{item.title}</h3>
                  <span className="flex items-center gap-1 text-[10px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">
                    <Lock className="w-3 h-3" /> {item.mode === 'risk' ? 'RISK' : 'PRIVATE'}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 truncate">
                  {item.status === 'done' && item.decryptedContent
                    ? item.decryptedContent.slice(0, 120) + (item.decryptedContent.length > 120 ? '...' : '')
                    : item.status === 'ready'
                    ? 'Encrypted result waiting for decryption'
                    : item.status === 'error'
                    ? (item.errorMsg ?? 'Inference failed')
                    : 'Processing...'}
                </p>
              </div>
              <div className="text-right shrink-0 hidden sm:block">
                <div className="text-xs text-zinc-400 mb-1">{formatDate(item.timestamp)}</div>
                <div className="text-[10px] text-zinc-600 font-mono">{item.model}</div>
              </div>
              <ChevronRight className="w-5 h-5 text-zinc-600 shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
