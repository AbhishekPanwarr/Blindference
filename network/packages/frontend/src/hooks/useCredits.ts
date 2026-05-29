import { useCallback, useEffect, useRef, useState } from 'react'
import { creditsApi } from '../api/creditsApi'

const PAYMENT_BASE =
  import.meta.env.VITE_PAYMENT_API_URL || 'http://127.0.0.1:8001'

export function useCredits(address: string | undefined) {
  const [balance, setBalance] = useState<{
    cusdc: string
    blind: string
    loading: boolean
    error: string | null
  }>({ cusdc: "0", blind: "0", loading: false, error: null })

  const esRef = useRef<EventSource | null>(null)

  const fetchBalance = useCallback(async () => {
    if (!address) return
    setBalance((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const resp = await creditsApi.getBalance(address)
      setBalance({
        cusdc: resp.data.balance_cusdc || "0",
        blind: resp.data.balance_blind || "0",
        loading: false,
        error: null,
      })
    } catch (err) {
      setBalance((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch balance',
      }))
    }
  }, [address])

  useEffect(() => {
    if (!address) return

    // Server-Sent Events (SSE) real-time balance stream.
    // Falls back to a one-time fetch if the browser doesn't support EventSource
    // or the connection drops.
    const url = `${PAYMENT_BASE}/v1/balance/stream/${address.toLowerCase()}`
    const es = new EventSource(url)
    esRef.current = es

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        setBalance({
          cusdc: data.balance_cusdc || "0",
          blind: data.balance_blind || "0",
          loading: false,
          error: null,
        })
      } catch {
        // ignore malformed events
      }
    }

    es.onerror = () => {
      // Connection failed or closed — fallback to one-time manual fetch
      void fetchBalance()
    }

    return () => {
      es.close()
      esRef.current = null
    }
  }, [address, fetchBalance])

  return { ...balance, refresh: fetchBalance }
}
