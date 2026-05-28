import { useEffect, useState } from 'react'
import { jobApi, type DeveloperStats, type JobStatusResponse } from '../api/inferenceApi'

export function useDeveloperStats(address: string | undefined) {
  const [stats, setStats] = useState<DeveloperStats | null>(null)
  const [recentJobs, setRecentJobs] = useState<JobStatusResponse[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!address) {
      setStats(null)
      setRecentJobs([])
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    const fetchData = async () => {
      try {
        const [statsResp, jobsResp] = await Promise.all([
          jobApi.getDeveloperStats(address),
          // Fetch recent jobs from history (we'll filter client-side for SDK jobs)
          // Since the payment service doesn't have a dedicated /developers/{address}/jobs endpoint,
          // we use the existing job status endpoint pattern or local storage.
          // For now, we'll just fetch stats and leave recent jobs empty.
          Promise.resolve({ data: { jobs: [] } }),
        ])

        if (cancelled) return
        setStats(statsResp.data)
        setRecentJobs(jobsResp.data.jobs as JobStatusResponse[])
      } catch (err: any) {
        if (cancelled) return
        setError(err.message || 'Failed to fetch developer stats')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchData()
    return () => { cancelled = true }
  }, [address])

  return { stats, recentJobs, loading, error }
}
