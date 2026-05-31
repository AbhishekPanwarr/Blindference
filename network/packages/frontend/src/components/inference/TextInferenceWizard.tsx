import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import axios from 'axios'
import { Lock, ShieldAlert, Cpu } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Hex } from 'viem'
import { SectionLabel } from '../effects/GlowDivider'

import { inferenceApi, jobApi } from '../../api/inferenceApi'
import { useCofheClient } from '../../hooks/useCofheClient'
import { storePromptKeyForTextRequest } from '../../lib/promptKeyStore'
import { encryptPromptKeyForTextRequest } from '../../utils/textPromptKey'

const TEXT_MODEL_OPTIONS = {
  qwen_7b: {
    id: 'qwen2.5-7b',
    label: 'Qwen2.5 7B (Local)',
    provider: 'local',
    model: 'qwen2.5-7b',
    description: 'Local vLLM Qwen 2.5 7B',
  },
  groq_llama_70b: {
    id: 'groq:llama-3.3-70b-versatile',
    label: 'Groq Llama 70B',
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    description: 'Cloud-hosted Groq LLM',
  },
  gemini_flash: {
    id: 'gemini:gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    description: 'Cloud-hosted Gemini 2.5 Flash',
  },
} as const

type TextModelKey = keyof typeof TEXT_MODEL_OPTIONS

type SubmissionStage = 'idle' | 'encrypting' | 'uploading' | 'submitting'

function resolveDefaultModelKey(): TextModelKey {
  const configured = import.meta.env.VITE_TEXT_MODEL_DEFAULT
  if (configured === TEXT_MODEL_OPTIONS.gemini_flash.id) {
    return 'qwen_7b'
  }
  return 'qwen_7b'
}

export function TextInferenceWizard() {
  const navigate = useNavigate()
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { client, isReady, error: cofheError, retry: retryCofhe } = useCofheClient()
  const [prompt, setPrompt] = useState('')
  const [escrowId, setEscrowId] = useState('')
  const [selectedModelKey, setSelectedModelKey] = useState<TextModelKey>(resolveDefaultModelKey)
  const [error, setError] = useState<string | null>(null)
  const [stage, setStage] = useState<SubmissionStage>('idle')
  const [isFocused, setIsFocused] = useState(false)
  const selectedModel = TEXT_MODEL_OPTIONS[selectedModelKey]

  // Persist conversation history across wizard sessions (navigates away after submit)
  const [messageHistory, setMessageHistory] = useState<{ role: string; content: string }[]>(() => {
    try {
      const raw = localStorage.getItem('blindference_wizard_history')
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })

  const [encryptStep, setEncryptStep] = useState<string | null>(null)

  const isBusy = stage !== 'idle'
  const buttonLabel = useMemo(() => {
    switch (stage) {
      case 'encrypting':
        return encryptStep ?? 'Encrypting Prompt...'
      case 'uploading':
        return 'Uploading to ICL...'
      case 'submitting':
        return 'Assigning Quorum...'
      default:
        return 'Run Confidential Text Inference'
    }
  }, [stage, encryptStep])

  const handleSubmit = async () => {
    const normalizedPrompt = prompt.trim()
    if (!normalizedPrompt) {
      setError('Please enter a prompt first.')
      return
    }
    if (!isReady || !address) {
      setError('Connect your wallet and wait for CoFHE to initialize.')
      return
    }
    if (!client) {
      setError('CoFHE client not initialized.')
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
      setEncryptStep('AES-256-GCM encrypting prompt...')

      // Build conversation history from persisted wizard turns
      const conversation = messageHistory
      const payloadObj = { conversation, prompt: normalizedPrompt }
      const payloadString = JSON.stringify(payloadObj)
      console.log(`[Blindference] Encrypting ${conversation.length} history turns + current prompt`)

      const promptKey = generateKey()
      const encryptedPrompt = await encryptText(payloadString, promptKey)
      const packedPrompt = packPayload(encryptedPrompt)

      setEncryptStep('CoFHE ZK proof generation (~10-30s)...')
      const encryptedPromptKey = await withTimeout(
        encryptPromptKeyForTextRequest(client, promptKey),
        120_000,
        'CoFHE encryption timed out after 120s. This may happen if the ZK proof generation is slow. Please try again.',
      )
      const taskId = generateTaskId()

      // Log encrypted outputs so the developer can verify CoFHE is working
      console.log('[Blindference] CoFHE encryption success:', {
        taskId,
        highCtHash: encryptedPromptKey.encryptedPromptKey.high,
        lowCtHash: encryptedPromptKey.encryptedPromptKey.low,
      })

      // ── On-chain storeKey (opens MetaMask) ──────────────────────────
      // We attempt this BEFORE quorum preview so the user can verify the
      // CoFHE ciphertexts are valid on-chain even if no nodes are running.
      setEncryptStep('Storing encrypted key on-chain...')
      let allowedNodes: Hex[] = []
      let promptKeyStoreTx: Hex | undefined
      let quorumPreviewData: { leader: Hex; verifiers: Hex[] } | null = null

      try {
        const preview = await inferenceApi.getQuorumPreview({
          model_id: selectedModel.id,
          min_tier: 0,
          verifier_count: 2,
          zdr_required: false,
        })
        quorumPreviewData = {
          leader: preview.data.leader as Hex,
          verifiers: preview.data.verifiers.map((v) => v as Hex),
        }
        allowedNodes = [quorumPreviewData.leader, ...quorumPreviewData.verifiers]
      } catch (quorumErr) {
        const msg = axios.isAxiosError(quorumErr)
          ? quorumErr.response?.data?.detail
          : quorumErr instanceof Error
            ? quorumErr.message
            : String(quorumErr)
        console.warn('[Blindference] Quorum preview failed:', msg)
        // Fallback: use the user's own address so storeKey can still execute
        // (real nodes won't be able to decrypt, but the CoFHE ciphertext is
        // verified on-chain and the user sees MetaMask).
        allowedNodes = address ? [address] : []
      }

      promptKeyStoreTx = await storePromptKeyForTextRequest({
        taskId,
        encryptedHighInput: encryptedPromptKey.metadata.cofhe_prompt_key_inputs.high as never,
        encryptedLowInput: encryptedPromptKey.metadata.cofhe_prompt_key_inputs.low as never,
        allowedNodes,
        promptKeyStoreAddress,
        publicClient,
        walletClient,
      })

      console.log('[Blindference] storeKey tx:', promptKeyStoreTx)

      // ── Upload + ICL submit ─────────────────────────────────────────
      setEncryptStep(null)
      setStage('uploading')
      const promptCID = await uploadToICL(packedPrompt)

      if (!quorumPreviewData) {
        setError(
          'Encrypted key stored on-chain successfully, but no inference nodes are available. ' +
          'Start at least 3 blindference-node instances (1 leader + 2 verifiers) to form a quorum.',
        )
        setStage('idle')
        return
      }

      setStage('submitting')
      const response = await jobApi.submit({
        user_address: address,
        prompt_cid: promptCID,
        model_id: selectedModel.id,
        encrypted_prompt_key_high: encryptedPromptKey.encryptedPromptKey.high,
        encrypted_prompt_key_low: encryptedPromptKey.encryptedPromptKey.low,
        payment_mode: 'credits',
        payment_currency: 'cusdc',
        insurance_opt_in: false,
        task_id: taskId,
        min_tier: 0,
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
          conversation_history: conversation,
          has_conversation_history: conversation.length > 0,
        },
      })

      const payload = response.data
      const requestId =
        ('job_id' in payload && typeof payload.job_id === 'string' && payload.job_id) ||
        ('request_id' in payload && typeof payload.request_id === 'string' && payload.request_id)

      if (!requestId) {
        throw new Error('The ICL response did not include a request identifier.')
      }

      // Persist user message for next turn
      const nextHistory = [...messageHistory, { role: 'user', content: normalizedPrompt }]
      setMessageHistory(nextHistory)
      try {
        localStorage.setItem('blindference_wizard_history', JSON.stringify(nextHistory))
      } catch {
        // ignore quota errors
      }

      navigate(`/inference/${requestId}`)
    } catch (submitError) {
      setEncryptStep(null)
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
      setEncryptStep(null)
      setStage('idle')
    }
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4 } }
  }

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      <AnimatePresence>
        {cofheError ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-500 overflow-hidden"
          >
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 shrink-0" />
              <span className="leading-relaxed">CoFHE: {cofheError}</span>
            </div>
            <button
              type="button"
              onClick={retryCofhe}
              className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-500 hover:bg-amber-500/20 transition-colors"
            >
              Retry
            </button>
          </motion.div>
        ) : null}
        {error ? (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-500 overflow-hidden"
          >
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <span className="leading-relaxed">{error}</span>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.div variants={itemVariants} className="space-y-3 relative">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-500">Confidential Prompt</label>
          <AnimatePresence>
            {isFocused && (
              <motion.span 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20"
              >
                <Lock className="w-3 h-3" /> FHE Protected
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        
        <div className="relative group">
          <div className={`absolute -inset-0.5 rounded-xl bg-gradient-to-r from-emerald-500/0 via-emerald-500/20 to-emerald-500/0 blur opacity-0 transition-opacity duration-500 ${isFocused ? 'opacity-100' : 'group-hover:opacity-50'}`} />
          <textarea
            className="relative min-h-[220px] w-full resize-y rounded-xl border border-white/10 bg-black px-5 py-4 text-sm leading-relaxed text-white placeholder:text-gray-600 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition-all shadow-inner"
            onChange={(event) => setPrompt(event.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Enter your confidential prompt..."
            value={prompt}
          />
        </div>
      </motion.div>

      <motion.div variants={itemVariants}>
        <details className="rounded-xl border border-white/10 bg-white/[0.02] p-5 group">
          <summary className="cursor-pointer list-none text-sm font-semibold text-gray-400 hover:text-white transition-colors flex items-center gap-2">
            <svg className="w-4 h-4 transition-transform group-open:rotate-90" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            Advanced / Settlement
          </summary>
          <div className="mt-4 space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-gray-500" htmlFor="escrow-id-input">
              Escrow ID (optional)
            </label>
            <input
              className="w-full rounded-lg border border-white/10 bg-black px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
              id="escrow-id-input"
              onChange={(event) => setEscrowId(event.target.value)}
              placeholder="Link this job to a Reineira escrow for automatic settlement"
              type="number"
              value={escrowId}
            />
            <p className="text-[11px] leading-relaxed text-gray-500">
              Link this job to a Reineira escrow for automatic settlement. Leave blank if you are not using escrow.
            </p>
          </div>
        </details>
      </motion.div>

      <motion.div variants={itemVariants} className="rounded-xl border border-white/10 bg-white/[0.02] p-5 gradient-accent-top">
        <div className="flex items-start gap-4">
          <div className="mt-1 rounded-full bg-emerald-500/10 p-2 border border-emerald-500/20 text-emerald-500">
            <Lock className="w-4 h-4" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-white">End-to-End Encryption</h4>
            <p className="text-xs leading-relaxed text-gray-500">
              Your prompt is encrypted in the browser, uploaded as an encrypted blob, and only the assigned quorum can decrypt the prompt key through CoFHE permissions.
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-t border-white/10 pt-6 gap-6 sm:gap-0 mt-8">
        <div className="space-y-2 w-full sm:w-auto">
          <label
            className="block text-[10px] font-bold uppercase tracking-[0.15em] text-gray-500"
            htmlFor="text-model-select"
          >
            Execution Model
          </label>
          <div className="relative">
            <Cpu className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500/50" />
            <select
              className="w-full sm:min-w-[260px] appearance-none rounded-lg border border-white/10 bg-black pl-10 pr-10 py-3 text-sm font-medium text-white outline-none transition-all focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 disabled:opacity-50"
              disabled={isBusy}
              id="text-model-select"
              onChange={(event) => setSelectedModelKey(event.target.value as TextModelKey)}
              value={selectedModelKey}
            >
              {Object.entries(TEXT_MODEL_OPTIONS).map(([key, option]) => (
                <option className="bg-black text-white" key={key} value={key}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
              <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd" />
              </svg>
            </div>
          </div>
          <div className="text-[11px] text-gray-500 font-mono mt-1">{selectedModel.description}</div>
        </div>

        <div className="flex flex-col items-center gap-2 w-full sm:w-auto">
          <button
            className="group relative flex w-full sm:w-auto min-w-[280px] items-center justify-center rounded-xl bg-emerald-500 px-8 py-4 text-sm font-bold uppercase tracking-wide text-black transition-all hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed overflow-hidden shadow-[0_0_20px_rgba(16,185,129,0.15)] hover:shadow-[0_0_25px_rgba(16,185,129,0.3)]"
            disabled={isBusy || !isReady || !address}
            onClick={handleSubmit}
            type="button"
          >
            {isBusy ? (
              <div className="flex items-center gap-3 relative z-10">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  className="h-4 w-4 rounded-full border-2 border-black/30 border-t-black" 
                />
                {buttonLabel}
              </div>
            ) : (
              <span className="relative z-10 flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Run Confidential Inference
              </span>
            )}
            
            {!isBusy && (
              <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
            )}
          </button>
          
          {encryptStep && (
            <div className="flex flex-col items-center gap-1">
              <motion.span
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[11px] text-emerald-500/80 font-mono"
              >
                {encryptStep}
              </motion.span>
              {encryptStep.includes('ZK') && (
                <span className="text-[10px] text-gray-500">
                  Browser may be unresponsive — do not refresh
                </span>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
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
