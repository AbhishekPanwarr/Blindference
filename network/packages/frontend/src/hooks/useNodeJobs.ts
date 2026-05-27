import { useState, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { paymentApiClient } from '../api/client'

interface NodeJob {
  job_id: string
  role: string
  status: string
  model_id: string
  amount_blind_earned: number | null
  completed_at: string
}

export function useNodeJobs(limit: number = 20) {
  const { address } = useAccount()
  const [jobs, setJobs] = useState<NodeJob[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchJobs = useCallback(async () => {
    if (!address) {
      setJobs([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const resp = await paymentApiClient.get(`/v1/nodes/${address.toLowerCase()}/jobs?limit=${limit}`)
      setJobs(resp.data.jobs as NodeJob[])
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Failed to fetch jobs')
    } finally {
      setLoading(false)
    }
  }, [address, limit])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  return { jobs, loading, error, refetch: fetchJobs }
}
