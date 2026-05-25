import { apiClient, paymentApiClient } from './client'

type TextInferenceRequest = {
  promptCID: string
  encryptedPromptKey: {
    high: string
    low: string
  }
  modelId?: string
  coverageEnabled?: boolean
}

export type InferenceRequestPayload = {
  developer_address: string
  model_id: string
  mode?: 'risk' | 'text'
  text_request?: TextInferenceRequest
  encrypted_input: Array<{
    ctHash: string
    utype: string | number
    signature: string
  }>
  permits: Array<{
    node: string
    permit: Record<string, unknown> | string
  }>
  leader_address: string
  verifier_addresses: string[]
  feature_types: string[]
  loan_id: string
  coverage_type: string | null
  max_fee_gnk: number
  min_tier: number
  zdr_required: boolean
  verifier_count: number
  metadata: Record<string, unknown>
}

export type JobSubmitPayload = {
  user_address: string
  prompt_cid: string
  model_id: string
  encrypted_prompt_key_high: string
  encrypted_prompt_key_low: string
  payment_mode?: 'credits' | 'escrow'
  payment_currency?: 'cusdc' | 'blind'
  insurance_opt_in?: boolean
  task_id?: string
  permits?: Array<{
    node: string
    permit: Record<string, unknown> | string
  }>
  min_tier?: number
  zdr_required?: boolean
  verifier_count?: number
  metadata?: Record<string, unknown>
}

export type JobSubmitResponse = {
  job_id: string
  status: string
  escrow_id?: number | null
  coverage_id?: number | null
}

export type JobStatusResponse = {
  job_id: string
  user_address: string
  model_id: string
  amount_cusdc: string
  amount_blind: string
  insurance_opt_in: boolean
  insurance_premium_cusdc: string
  escrow_id: number | null
  coverage_id: number | null
  status: string
  leader_address: string | null
  verifier_addresses: string[]
  error_reason: string | null
  result_hash: string | null
  output_cid: string | null
  encrypted_output_key_high: string | null
  encrypted_output_key_low: string | null
  rewards_distributed: boolean
  reward_tx_hashes: string[]
  created_at: string
  updated_at: string
}

export type IpfsUploadResponse = {
  cid: string
}

export type BackendInferenceRequest = {
  request_id: string
  task_id: string
  leader_address: string | null
  developer_address: string
  model_id: string
  mode?: 'risk' | 'text'
  text_mode?: boolean
  text_request?: {
    prompt_cid: string
    encrypted_prompt_key: {
      high: string
      low: string
    }
    model_id?: string | null
    coverage_enabled?: boolean
  } | null
  encrypted_features: Array<{
    ct_hash: string
    utype: string | number
    signature: string
  }>
  feature_types: string[]
  loan_id: string | null
  coverage_type: string | null
  max_fee_gnk: number
  status: 'queued' | 'accepted' | 'rejected' | 'disputed' | 'failed' | 'pending_store_key'
  min_tier: number
  zdr_required: boolean
  verifier_count: number
  quorum: {
    leader_address: string
    verifier_addresses: string[]
    candidate_addresses: string[]
  }
  metadata: Record<string, unknown>
  result_hash: string | null
  result_preview: string | null
  risk_score: number | null
  leader_submission: {
    leader_address: string
    risk_score: number | null
    confidence: number | null
    summary: string | null
    provider: string | null
    model: string | null
    result_hash: string | null
    submitted_at: string | null
  } | null
  verifier_verdicts: Array<{
    verifier_address: string
    submitted: boolean
    accepted: boolean | null
    confidence: number | null
    reason: string | null
    risk_score: number | null
    result_hash: string | null
    provider: string | null
    model: string | null
    summary: string | null
    updated_at: string | null
  }>
  chain_tx_hash: string | null
  aggregated_confidence: number | null
  confirm_count: number
  reject_count: number
  encrypted_output_key_high?: string | null
  encrypted_output_key_low?: string | null
  output_cid?: string | null
  commitment_hash?: string | null
  failure_reason?: string | null
  created_at: string
  updated_at: string
}

export type BackendTextInferenceStatus = {
  job_id: string
  status: 'QUEUED' | 'ACCEPTED' | 'REJECTED' | 'DISPUTED' | 'TIMEDOUT'
  output_cid?: string | null
  commitment_hash?: string | null
  encrypted_output_key_high?: string | null
  encrypted_output_key_low?: string | null
  quorum?: {
    verifier_addresses: string[]
    confirmations: number
    confidence: number
  } | null
  dispute_deadline?: number | null
}

export type BackendInferenceStatusResponse = BackendInferenceRequest | BackendTextInferenceStatus

export type CoverageQuote = {
  request_id: string
  coverage_available: boolean
  recommendation: string
}

export type QuorumPreviewResponse = {
  leader: string
  verifiers: string[]
  candidates: string[]
}

export const inferenceApi = {
  getQuorumPreview(params: { model_id: string; min_tier: number; verifier_count: number; zdr_required?: boolean }) {
    return apiClient.get<QuorumPreviewResponse>('/v1/inference/quorum-preview', { params })
  },
  submit(payload: InferenceRequestPayload) {
    return apiClient.post<BackendInferenceRequest>('/v1/inference/requests', payload)
  },
  uploadPromptBlob(blob: Blob, filename = 'blindference-text-prompt.bin') {
    const formData = new FormData()
    formData.append('file', blob, filename)
    return apiClient.post<IpfsUploadResponse>('/v1/inference/upload-prompt', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },
  getStatus(requestId: string) {
    return apiClient.get<BackendInferenceStatusResponse>(`/v1/inference/${requestId}`)
  },
  list() {
    return apiClient.get<BackendInferenceRequest[]>('/v1/inference')
  },
}

export const jobApi = {
  submit(payload: JobSubmitPayload) {
    return paymentApiClient.post<JobSubmitResponse>('/v1/jobs/submit', payload)
  },
  getStatus(jobId: string) {
    return paymentApiClient.get<JobStatusResponse>(`/v1/jobs/${jobId}`)
  },
}

export const coverageApi = {
  quote(requestId: string) {
    return apiClient.get<CoverageQuote>(`/v1/coverage/${requestId}`)
  },
  fileDispute(requestId: string, payload: { evidence: string }) {
    return apiClient.post(`/v1/inference/${requestId}/dispute`, payload)
  },
}
