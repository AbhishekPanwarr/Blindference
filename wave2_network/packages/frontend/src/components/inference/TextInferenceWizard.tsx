import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import axios from 'axios'
import { Lock, ShieldAlert } from 'lucide-react'
import type { Hex } from 'viem'

import { inferenceApi } from '../../api/inferenceApi'
import { useCofheClient } from '../../hooks/useCofheClient'
import { storePromptKeyForTextRequest } from '../../lib/promptKeyStore'
import { encryptPromptKeyForTextRequest } from '../../utils/textPromptKey'

const TEXT_MODEL_OPTIONS = {
  groq_llama_70b: {
    id: 'groq:llama-3.3-70b-versatile',
    label: 'Groq Llama 70B',
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    description: 'Fast Groq-hosted Llama 70B',
  },
  gemini_flash: {
    id: 'gemini:gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    description: 'Google Gemini 2.5 Flash',
  },
} as const

type TextModelKey = keyof typeof TEXT_MODEL_OPTIONS

type SubmissionStage = 'idle' | 'encrypting' | 'uploading' | 'submitting'

function resolveDefaultModelKey(): TextModelKey {
  const configured = import.meta.env.VITE_TEXT_MODEL_DEFAULT
  if (configured === TEXT_MODEL_OPTIONS.gemini_flash.id) {
    return 'gemini_flash'
  }
  return 'groq_llama_70b'
}

export function TextInferenceWizard() {
  const navigate = useNavigate()
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { client, isReady } = useCofheClient()
  const [prompt, setPrompt] = useState('')
  const [selectedModelKey, setSelectedModelKey] = useState<TextModelKey>(resolveDefaultModelKey)
  const [error, setError] = useState<string | null>(null)
  const [stage, setStage] = useState<SubmissionStage>('idle')
  const selectedModel = TEXT_MODEL_OPTIONS[selectedModelKey]

  const isBusy = stage !== 'idle'
  const buttonLabel = useMemo(() => {
    switch (stage) {
      case 'encrypting':
        return 'Encrypting...'
      case 'uploading':
        return 'Uploading Prompt...'
      case 'submitting':
        return 'Submitting...'
      default:
        return 'Run Confidential Text Inference'
    }
  }, [stage])

  const handleSubmit = async () => {
    const normalizedPrompt = prompt.trim()
    if (!normalizedPrompt) {
      setError('Please enter a prompt first.')
      return
    }
    if (!client || !isReady || !address) {
      setError('Connect your wallet and wait for CoFHE to initialize.')
      return
    }
    if (!publicClient || !walletClient) {
      setError('Wallet client is not available yet.')
      return
    }

    const promptKeyStoreAddress = import.meta.env.VITE_PROMPT_KEY_STORE_ADDRESS as Hex | undefined
    if (!promptKeyStoreAddress) {
      setError('VITE_PROMPT_KEY_STORE_ADDRESS is not configured.')
      return
    }

    try {
      setError(null)
      setStage('encrypting')

      const promptKey = generateKey()
      const encryptedPrompt = await encryptText(normalizedPrompt, promptKey)
      const packedPrompt = packPayload(encryptedPrompt)

      const encryptedPromptKey = await encryptPromptKeyForTextRequest(client, promptKey)
      const taskId = generateTaskId()

      const quorumPreview = await inferenceApi.getQuorumPreview({
        model_id: selectedModel.id,
        min_tier: 1,
        verifier_count: 2,
        zdr_required: false,
      })
      const allowedNodes = [quorumPreview.data.leader, ...quorumPreview.data.verifiers] as Hex[]

      const promptKeyStoreTx = await storePromptKeyForTextRequest({
        taskId,
        encryptedHighInput: encryptedPromptKey.metadata.cofhe_prompt_key_inputs.high as never,
        encryptedLowInput: encryptedPromptKey.metadata.cofhe_prompt_key_inputs.low as never,
        allowedNodes,
        promptKeyStoreAddress,
        publicClient,
        walletClient,
      })

      setStage('uploading')
      const promptCID = await uploadToICL(packedPrompt)

      setStage('submitting')
      const response = await inferenceApi.submitText({
        developer_address: address,
        task_id: taskId,
        mode: 'text',
        model_id: selectedModel.id,
        leader_address: quorumPreview.data.leader,
        verifier_addresses: quorumPreview.data.verifiers,
        text_request: {
          prompt_cid: promptCID,
          encrypted_prompt_key: {
            high: encryptedPromptKey.encryptedPromptKey.high,
            low: encryptedPromptKey.encryptedPromptKey.low,
          },
          model_id: selectedModel.id,
          coverage_enabled: false,
        },
        min_tier: 1,
        zdr_required: false,
        verifier_count: 2,
        metadata: {
          cofhe_prompt_key_inputs: encryptedPromptKey.metadata.cofhe_prompt_key_inputs,
          prompt_length: normalizedPrompt.length,
          vertical: 'blindference-text-demo',
          provider: selectedModel.provider,
          model: selectedModel.model,
          prompt_key_store_tx: promptKeyStoreTx,
          prompt_key_store_status: 'stored_by_user',
          prompt_key_store_address: promptKeyStoreAddress,
        },
      })

      const payload = response.data
      const requestId =
        ('job_id' in payload && typeof payload.job_id === 'string' && payload.job_id) ||
        ('request_id' in payload && typeof payload.request_id === 'string' && payload.request_id)

      if (!requestId) {
        throw new Error('The ICL response did not include a request identifier.')
      }

      navigate(`/inference/${requestId}`)
    } catch (submitError) {
      if (axios.isAxiosError(submitError)) {
        const detail = submitError.response?.data?.detail
        if (typeof detail === 'string' && detail.trim()) {
          setError(detail)
          setStage('idle')
          return
        }
      }
      setError(submitError instanceof Error ? submitError.message : 'Failed to submit text inference request.')
    } finally {
      setStage('idle')
    }
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="flex items-center gap-3 rounded border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-500">
          <ShieldAlert className="h-5 w-5" />
          {error}
        </div>
      ) : null}

      <div className="space-y-3">
        <label className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Confidential Prompt</label>
        <textarea
          className="min-h-[220px] w-full resize-y rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-white placeholder:text-gray-500 focus:border-emerald-500/50 focus:outline-none"
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Enter your confidential prompt..."
          value={prompt}
        />
      </div>

      <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/20 p-4 text-sm text-gray-300">
        Your prompt is encrypted in the browser, uploaded as an encrypted blob, and only the assigned quorum can
        decrypt the prompt key through CoFHE permissions.
      </div>

      <div className="flex items-center justify-between border-t border-white/5 pt-4">
        <div className="space-y-2">
          <label
            className="block text-[10px] font-bold uppercase tracking-tighter text-gray-500"
            htmlFor="text-model-select"
          >
            Model
          </label>
          <select
            className="min-w-[240px] rounded border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-emerald-500/50"
            disabled={isBusy}
            id="text-model-select"
            onChange={(event) => setSelectedModelKey(event.target.value as TextModelKey)}
            value={selectedModelKey}
          >
            {Object.entries(TEXT_MODEL_OPTIONS).map(([key, option]) => (
              <option className="bg-zinc-950 text-white" key={key} value={key}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="text-xs text-gray-500">{selectedModel.description}</div>
        </div>

        <button
          className="flex min-w-[260px] items-center justify-center rounded bg-emerald-500 px-8 py-3 text-sm font-bold uppercase text-black shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all hover:bg-emerald-400 disabled:opacity-50 disabled:shadow-none"
          disabled={isBusy || !isReady || !address}
          onClick={handleSubmit}
          type="button"
        >
          {isBusy ? (
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 animate-pulse text-emerald-900" />
              {buttonLabel}
            </div>
          ) : (
            'Run Confidential Text Inference'
          )}
        </button>
      </div>
    </div>
  )
}

function generateKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32))
}

function generateTaskId(): Hex {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}` as Hex
}

async function encryptText(text: string, key: Uint8Array): Promise<{ iv: Uint8Array; authTag: Uint8Array; ciphertext: Uint8Array }> {
  if (key.byteLength !== 32) {
    throw new Error('Key must be 32 bytes')
  }

  const iv = crypto.getRandomValues(new Uint8Array(16))
  const cryptoKey = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['encrypt'])
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    cryptoKey,
    new TextEncoder().encode(text),
  )

  const encryptedBytes = new Uint8Array(encrypted)
  const ciphertext = encryptedBytes.subarray(0, encryptedBytes.length - 16)
  const authTag = encryptedBytes.subarray(encryptedBytes.length - 16)
  return { iv, authTag, ciphertext }
}

function packPayload(payload: { iv: Uint8Array; authTag: Uint8Array; ciphertext: Uint8Array }): Uint8Array {
  const packed = new Uint8Array(payload.iv.length + payload.authTag.length + payload.ciphertext.length)
  packed.set(payload.iv, 0)
  packed.set(payload.authTag, payload.iv.length)
  packed.set(payload.ciphertext, payload.iv.length + payload.authTag.length)
  return packed
}

async function uploadToICL(data: Uint8Array): Promise<string> {
  const timeoutMs = Number(import.meta.env.VITE_PROMPT_UPLOAD_TIMEOUT_MS || '30000')
  try {
    const response = await withTimeout(
      inferenceApi.uploadPromptBlob(new Blob([data])),
      timeoutMs,
      'Encrypted prompt upload timed out. Check the ICL and Pinata connectivity, then try again.',
    )
    if (!response.data?.cid) {
      throw new Error(`Unexpected ICL upload response: ${JSON.stringify(response.data)}`)
    }
    return response.data.cid
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const detail = error.response?.data?.detail
      if (typeof detail === 'string' && detail.trim()) {
        throw new Error(detail)
      }
    }
    throw new Error(
      error instanceof Error
        ? error.message
        : 'Encrypted prompt upload failed before the request completed.',
    )
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs)
    promise
      .then((value) => {
        window.clearTimeout(timeoutId)
        resolve(value)
      })
      .catch((error) => {
        window.clearTimeout(timeoutId)
        reject(error)
      })
  })
}
