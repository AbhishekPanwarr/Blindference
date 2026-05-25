import { useEffect, useState } from 'react'

import { jobApi, type JobStatusResponse } from '../api/inferenceApi'

export type JobStage = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' | 'PENDING_PAYMENT'

export type JobStatus = {
  jobId: string
  stage: JobStage
  status: string
  modelId: string
  resultHash: string | null
  outputCid: string | null
  leaderAddress: string | null
  verifierAddresses: string[]
  errorReason: string | null
  rewardsDistributed: boolean
  createdAt: string
  updatedAt: string
  raw: JobStatusResponse
}

function mapJobResponse(response: JobStatusResponse): JobStatus {
  const status = response.status
  const stage: JobStage =
    status === 'COMPLETED'
      ? 'COMPLETED'
      : status === 'FAILED'
        ? 'FAILED'
        : status === 'REFUNDED'
          ? 'REFUNDED'
          : status === 'PENDING_PAYMENT'
            ? 'PENDING_PAYMENT'
            : 'RUNNING'

  return {
    jobId: response.job_id,
    stage,
    status: response.status,
    modelId: response.model_id,
    resultHash: response.result_hash,
    outputCid: response.output_cid,
    leaderAddress: response.leader_address,
    verifierAddresses: response.verifier_addresses,
    errorReason: response.error_reason,
    rewardsDistributed: response.rewards_distributed,
    createdAt: response.created_at,
    updatedAt: response.updated_at,
    raw: response,
  }
}

export function useJobStatus(jobId: string) {
  const [status, setStatus] = useState<JobStatus | null>(null)

  useEffect(() => {
    if (!jobId) return

    let mounted = true
    const poll = async () => {
      try {
        const response = await jobApi.getStatus(jobId)
        if (!mounted) return
        const mapped = mapJobResponse(response.data)
        if (mapped.stage === 'COMPLETED') {
          console.log(`[Blindference] Job ${jobId} COMPLETED. Result hash:`, mapped.resultHash)
        } else {
          console.log(`[Blindference] Job ${jobId} status:`, mapped.stage)
        }
        setStatus(mapped)
      } catch (error) {
        console.error('[Blindference] Error polling job status:', error)
      }
    }

    void poll()
    const interval = window.setInterval(() => {
      void poll()
    }, 3000)

    return () => {
      mounted = false
      window.clearInterval(interval)
    }
  }, [jobId])

  return status
}
