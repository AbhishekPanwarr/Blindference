import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Lock,
  ShieldCheck,
  Copy,
  ChevronDown,
  ChevronUp,
  Sparkles,
  User,
  Eye,
  Loader2,
} from 'lucide-react'

export interface ChatEntry {
  id: string
  role: 'user' | 'assistant'
  content: string
  status?: 'pending' | 'encrypting' | 'processing' | 'ready' | 'done' | 'error'
  requestId?: string
  outputCID?: string
  encryptedOutputKeyHigh?: string
  encryptedOutputKeyLow?: string
  errorMsg?: string
  metadata?: {
    model?: string
    receiptRoot?: string
    receiptsCID?: string
    traceHash?: string
  }
  timestamp?: Date
}

interface ChatViewProps {
  entries: ChatEntry[]
  onSuggestionClick?: (text: string) => void
  onDecrypt?: (id: string) => void
}

function UavpPanel({ metadata }: { metadata?: ChatEntry['metadata'] }) {
  const [open, setOpen] = useState(false)
  if (!metadata) return null

  const items = [
    { label: 'Receipt Root', value: metadata.receiptRoot },
    { label: 'IPFS CID', value: metadata.receiptsCID },
    { label: 'Trace Hash', value: metadata.traceHash },
  ].filter((i) => i.value)

  if (items.length === 0) return null

  return (
    <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/40 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <span className="flex items-center gap-1.5 font-medium uppercase tracking-wider">
          <ShieldCheck className="w-3 h-3" /> UAVP Proof
        </span>
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2">
              {items.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between text-[10px] font-mono"
                >
                  <span className="text-zinc-600">{item.label}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-400">{item.value!.slice(0, 12)}...{item.value!.slice(-4)}</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(item.value!)}
                      className="text-zinc-600 hover:text-zinc-300 transition-colors"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-2">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-zinc-500"
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
          transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}
        />
      ))}
    </div>
  )
}

export function ChatView({ entries, onSuggestionClick, onDecrypt }: ChatViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries])

  if (entries.length === 0) {
    return <div className="flex-1" />
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      {entries.map((entry) => (
        <motion.div
          key={entry.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className={`flex gap-4 ${entry.role === 'user' ? 'flex-row-reverse' : ''}`}
        >
          {/* Avatar */}
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
              entry.role === 'user'
                ? 'bg-zinc-800 border border-zinc-700'
                : 'bg-white/10 border border-white/20'
            }`}
          >
            {entry.role === 'user' ? (
              <User className="w-3.5 h-3.5 text-zinc-400" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-zinc-300" />
            )}
          </div>

          {/* Content */}
          <div
            className={`max-w-[80%] ${
              entry.role === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div
              className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                entry.role === 'user'
                  ? 'bg-zinc-800 text-white'
                  : 'bg-zinc-900/60 border border-zinc-800 text-zinc-300'
              }`}
            >
              {entry.role === 'assistant' && (entry.status === 'pending' || entry.status === 'encrypting' || entry.status === 'processing') ? (
                <TypingDots />
              ) : entry.role === 'assistant' && entry.status === 'ready' ? (
                <div className="flex items-center gap-3">
                  <Lock className="w-4 h-4 text-zinc-500" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-zinc-300">Result encrypted</div>
                    <div className="text-[11px] text-zinc-600">Decrypt locally with your Fhenix key</div>
                  </div>
                  <button
                    onClick={() => onDecrypt?.(entry.id)}
                    className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-zinc-200 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Decrypt to View
                  </button>
                </div>
              ) : entry.role === 'assistant' && entry.status === 'error' ? (
                <div className="text-sm text-red-400">{entry.errorMsg ?? 'Something went wrong.'}</div>
              ) : (
                <div className="whitespace-pre-wrap">{entry.content}</div>
              )}
            </div>

            {entry.role === 'assistant' && entry.status === 'done' && (
              <UavpPanel metadata={entry.metadata} />
            )}

            {entry.metadata && (
              <div className="mt-1.5 flex items-center gap-2 text-[10px] text-zinc-600">
                {entry.metadata.model && <span className="font-mono">{entry.metadata.model}</span>}
              </div>
            )}
          </div>
        </motion.div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}


