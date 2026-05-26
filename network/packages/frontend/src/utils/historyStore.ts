export type HistoryStatus = 'pending' | 'encrypting' | 'processing' | 'escrow' | 'ready' | 'done' | 'error'

export type HistoryEntry = {
  id: string
  title: string
  prompt: string
  mode: 'chat' | 'risk'
  model: string
  status: HistoryStatus
  requestId?: string
  outputCID?: string
  encryptedOutputKeyHigh?: string
  encryptedOutputKeyLow?: string
  decryptedContent?: string
  errorMsg?: string
  timestamp: number
}

const STORAGE_KEY = 'blindference_history_v1'

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as HistoryEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveHistory(entries: HistoryEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // ignore quota errors
  }
}

export function addHistoryEntry(entry: HistoryEntry) {
  const entries = loadHistory()
  entries.unshift(entry)
  saveHistory(entries)
}

export function updateHistoryEntry(id: string, patch: Partial<HistoryEntry>) {
  const entries = loadHistory()
  const idx = entries.findIndex((e) => e.id === id)
  if (idx === -1) return
  entries[idx] = { ...entries[idx], ...patch }
  saveHistory(entries)
}

export function clearHistory() {
  localStorage.removeItem(STORAGE_KEY)
}
