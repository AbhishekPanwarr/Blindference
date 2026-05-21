import { useCallback, useEffect, useRef, useState } from 'react'
import { type ChatEntry } from '../components/inference/ChatView'
import { useInferenceStatus } from './useInferenceStatus'
import { useCofheClient } from './useCofheClient'
import { decryptOutputKey, downloadAndDecryptTextOutput } from '../utils/textPromptKey'
import { addHistoryEntry, updateHistoryEntry } from '../utils/historyStore'

function uid() { return Math.random().toString(36).slice(2) }

function getAutoDecryptSetting(): boolean {
  try {
    return localStorage.getItem('blindference_auto_decrypt') === 'true'
  } catch {
    return false
  }
}

function makeHistoryFromMessage(m: ChatEntry, prompt: string): {
  id: string
  title: string
  prompt: string
  mode: 'chat' | 'risk'
  model: string
  status: ChatEntry['status']
  requestId?: string
  outputCID?: string
  encryptedOutputKeyHigh?: string
  encryptedOutputKeyLow?: string
  errorMsg?: string
  timestamp: number
} {
  return {
    id: m.id,
    title: prompt.slice(0, 60) + (prompt.length > 60 ? '...' : ''),
    prompt,
    mode: 'chat',
    model: m.metadata?.model ?? 'unknown',
    status: m.status ?? 'pending',
    requestId: m.requestId,
    outputCID: m.outputCID,
    encryptedOutputKeyHigh: m.encryptedOutputKeyHigh,
    encryptedOutputKeyLow: m.encryptedOutputKeyLow,
    errorMsg: m.errorMsg,
    timestamp: m.timestamp ? new Date(m.timestamp).getTime() : Date.now(),
  }
}

export function useChat() {
  const [messages, setMessages] = useState<ChatEntry[]>([])
  const [activeRequestId, setActiveRequestId] = useState('')
  const { client: cofheClient, isReady } = useCofheClient()
  const decryptedIds = useRef<Set<string>>(new Set())

  const status = useInferenceStatus(activeRequestId)

  // Update the pending assistant message when job status changes
  useEffect(() => {
    if (!activeRequestId || !status) return
    setMessages(prev => prev.map(m => {
      if (m.role !== 'assistant' || m.requestId !== activeRequestId || m.status === 'done' || m.status === 'error' || m.status === 'ready') return m
      const next: ChatEntry = { ...m }
      if (status.status === 'QUEUED' || status.status === 'ASSIGNED' || status.status === 'EXECUTING') {
        next.status = 'processing'
      }
      return next
    }))
  }, [activeRequestId, status?.status])

  // Auto-decrypt or set ready when ACCEPTED
  useEffect(() => {
    if (!status || status.status !== 'ACCEPTED' || status.mode !== 'text') return
    const { encrypted_output_key_high: high, encrypted_output_key_low: low, output_cid } = status.text_result ?? {}
    if (!high || !low || !output_cid) return

    setMessages(prev => prev.map(m => {
      if (m.role !== 'assistant' || m.requestId !== activeRequestId) return m
      if (m.status === 'done' || m.status === 'error' || m.status === 'ready') return m
      // store metadata for manual decrypt
      const updated: ChatEntry = {
        ...m,
        outputCID: output_cid,
        encryptedOutputKeyHigh: high,
        encryptedOutputKeyLow: low,
      }
      if (getAutoDecryptSetting() && cofheClient && isReady) {
        // will be handled by the decrypt effect below
        return updated
      }
      // manual mode
      updateHistoryEntry(m.id, { status: 'ready', outputCID: output_cid, encryptedOutputKeyHigh: high, encryptedOutputKeyLow: low })
      return { ...updated, status: 'ready' }
    }))
  }, [status?.status, status?.text_result?.output_cid, activeRequestId])

  // Effect to perform actual auto-decrypt when setting and conditions are met
  useEffect(() => {
    if (!status || status.status !== 'ACCEPTED' || status.mode !== 'text') return
    const { encrypted_output_key_high: high, encrypted_output_key_low: low, output_cid } = status.text_result ?? {}
    if (!high || !low || !output_cid || !cofheClient || !isReady) return
    if (!getAutoDecryptSetting()) return
    if (decryptedIds.current.has(activeRequestId)) return
    decryptedIds.current.add(activeRequestId)

    const rid = activeRequestId;
    (async () => {
      try {
        const key = await decryptOutputKey(cofheClient, high, low)
        const answer = await downloadAndDecryptTextOutput(output_cid, key)
        setMessages(prev => prev.map(m =>
          m.role === 'assistant' && m.requestId === rid
            ? { ...m, status: 'done', content: answer }
            : m
        ))
        updateHistoryEntry(rid, { status: 'done', decryptedContent: answer })
      } catch (e) {
        setMessages(prev => prev.map(m =>
          m.role === 'assistant' && m.requestId === rid
            ? { ...m, status: 'error', errorMsg: e instanceof Error ? e.message : 'Decryption failed' }
            : m
        ))
        updateHistoryEntry(rid, { status: 'error', errorMsg: e instanceof Error ? e.message : 'Decryption failed' })
      }
    })()
  }, [status?.status, status?.text_result?.output_cid, cofheClient, isReady, activeRequestId])

  const pushUserMessage = useCallback((prompt: string, model: string): string => {
    const userId = uid()
    const assistantId = uid()
    const now = new Date()
    const userEntry: ChatEntry = {
      id: userId,
      role: 'user',
      content: prompt,
      metadata: { model },
      status: 'done',
      timestamp: now,
    }
    const assistantEntry: ChatEntry = {
      id: assistantId,
      role: 'assistant',
      content: '',
      metadata: { model },
      status: 'encrypting',
      timestamp: now,
    }
    setMessages(prev => [...prev, userEntry, assistantEntry])
    addHistoryEntry(makeHistoryFromMessage(assistantEntry, prompt))
    return assistantId
  }, [])

  const updateAssistantStatus = useCallback((assistantId: string, statusValue: ChatEntry['status'], requestId?: string) => {
    setMessages(prev => prev.map(m =>
      m.id === assistantId ? { ...m, status: statusValue, ...(requestId ? { requestId } : {}) } : m
    ))
    if (requestId) {
      updateHistoryEntry(assistantId, { status: statusValue, requestId })
    }
  }, [])

  const failAssistantMessage = useCallback((assistantId: string, errorMsg: string) => {
    setMessages(prev => prev.map(m =>
      m.id === assistantId ? { ...m, status: 'error', errorMsg } : m
    ))
    updateHistoryEntry(assistantId, { status: 'error', errorMsg })
  }, [])

  const updateAssistantMetadata = useCallback((assistantId: string, metadataPatch: Partial<ChatEntry['metadata']>) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== assistantId) return m
      return {
        ...m,
        metadata: { ...m.metadata, ...metadataPatch },
      }
    }))
  }, [])

  const decryptMessage = useCallback(async (assistantId: string) => {
    const msg = messages.find(m => m.id === assistantId && m.role === 'assistant')
    if (!msg || !msg.outputCID || !msg.encryptedOutputKeyHigh || !msg.encryptedOutputKeyLow || !cofheClient || !isReady) return
    try {
      const key = await decryptOutputKey(cofheClient, msg.encryptedOutputKeyHigh, msg.encryptedOutputKeyLow)
      const answer = await downloadAndDecryptTextOutput(msg.outputCID, key)
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, status: 'done', content: answer } : m
      ))
      updateHistoryEntry(assistantId, { status: 'done', decryptedContent: answer })
    } catch (e) {
      const err = e instanceof Error ? e.message : 'Decryption failed'
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, status: 'error', errorMsg: err } : m
      ))
      updateHistoryEntry(assistantId, { status: 'error', errorMsg: err })
    }
  }, [messages, cofheClient, isReady])

  return { messages, pushUserMessage, updateAssistantStatus, updateAssistantMetadata, failAssistantMessage, setActiveRequestId, status, decryptMessage }
}
