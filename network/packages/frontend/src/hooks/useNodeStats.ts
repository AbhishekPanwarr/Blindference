import { useState, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { paymentApiClient } from '../api/client'

interface NodeStats {
  total_jobs: number
  success: number
  failed: number
  slashed: boolean
  slash_count: number
  current_stake_blind: string
  total_earned_blind: string
}

export function useNodeStats() {
  const { address } = useAccount()
  const [stats, setStats] = useState<NodeStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    if (!address) {
      setStats(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const resp = await paymentApiClient.get(`/v1/nodes/${address.toLowerCase()}/stats`)
      setStats(resp.data as NodeStats)
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Failed to fetch stats')
    } finally {
      setLoading(false)
    }
  }, [address])

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 30_000)
    return () => clearInterval(interval)
  }, [fetchStats])

  return { stats, loading, error, refetch: fetchStats }
}
