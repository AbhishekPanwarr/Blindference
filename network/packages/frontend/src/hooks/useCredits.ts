import { useCallback, useEffect, useState } from 'react'
import { creditsApi } from '../api/creditsApi'

export function useCredits(address: string | undefined) {
  const [balance, setBalance] = useState<{
    cusdc: number
    blind: number
    loading: boolean
    error: string | null
  }>({ cusdc: 0, blind: 0, loading: false, error: null })

  const fetchBalance = useCallback(async () => {
    if (!address) return
    setBalance((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const resp = await creditsApi.getBalance(address)
      setBalance({
        cusdc: resp.data.balance_cusdc,
        blind: resp.data.balance_blind,
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
    void fetchBalance()
    const interval = setInterval(() => {
      void fetchBalance()
    }, 5_000)
    return () => clearInterval(interval)
  }, [fetchBalance])

  return { ...balance, refresh: fetchBalance }
}
