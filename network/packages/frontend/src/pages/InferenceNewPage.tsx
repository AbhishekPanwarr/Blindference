import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { Lock, ShieldAlert, ShieldCheck, Copy, Cpu, CheckCircle2, Loader2, ChevronDown, ArrowUp, MessageSquare, BarChart2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Hex } from 'viem'
import axios from 'axios'

import { inferenceApi } from '../api/inferenceApi'
import { ChatView } from '../components/inference/ChatView'
import { useCofheClient } from '../hooks/useCofheClient'
import { useChat } from '../hooks/useChat'
import { storePromptKeyForTextRequest } from '../lib/promptKeyStore'
import { encryptPromptKeyForTextRequest } from '../utils/textPromptKey'
import { useInferenceStore } from '../stores/inferenceStore'
import { encryptRiskFeatures } from '../utils/encryption'
import { readStoredRiskInputHandles, storeEncryptedRiskInputsInVault } from '../lib/inputVault'
import { PermitUtils } from '@cofhe/sdk/permits'
import { cn } from '../utils/helpers'
import { addHistoryEntry } from '../utils/historyStore'

const TEXT_MODEL_OPTIONS = {
  groq_llama_70b: {
    id: 'groq:llama-3.3-70b-versatile',
    label: 'Groq Llama 70B',
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
  },
  gemini_flash: {
    id: 'gemini:gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    provider: 'gemini',
    model: 'gemini-2.5-flash',
  },
  opt_125m: {
    id: 'facebook/opt-125m',
    label: 'OPT 125M (Local)',
    provider: 'local',
    model: 'facebook/opt-125m',
  },
} as const
type TextModelKey = keyof typeof TEXT_MODEL_OPTIONS

const MODEL_BINDINGS = {
  'llama3-70b': {
    modelId: 'groq:llama-3.3-70b-versatile',
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    baseFee: 10,
    telemetry: {
      accuracy: '94.2%',
      falsePositives: '1.2%',
      hallucinations: '< 0.5%',
      benchmark: '82.0 MMLU',
    },
  },
  'gemini-pro': {
    modelId: 'gemini:gemini-2.5-flash',
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    baseFee: 8,
    telemetry: {
      accuracy: '96.8%',
      falsePositives: '0.8%',
      hallucinations: '< 0.2%',
      benchmark: '86.2 MMLU',
    },
  },
  'opt-125m': {
    modelId: 'facebook/opt-125m',
    provider: 'local',
    model: 'facebook/opt-125m',
    baseFee: 2,
    telemetry: {
      accuracy: 'N/A (dev model)',
      falsePositives: 'N/A',
      hallucinations: 'N/A',
      benchmark: '125M params',
    },
  },
} as const

function generateKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32))
}

function generateTaskId(): Hex {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}` as Hex
}

async function encryptText(
  text: string,
  key: Uint8Array
): Promise<{ iv: Uint8Array; authTag: Uint8Array; ciphertext: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(16))
  const cryptoKey = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['encrypt'])
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    cryptoKey,
    new TextEncoder().encode(text)
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

const TRACE_STEPS = [
  { key: 'encrypt',  label: 'Input Sealed',           sub: 'AES-GCM + CoFHE key split' },
  { key: 'icl',      label: 'Inference Quorum',       sub: 'Leader + 2 verifiers assigned' },
  { key: 'leader',   label: 'Leader Run',             sub: 'Model execution in enclave' },
  { key: 'quorum',   label: 'Verifier Replay',        sub: 'Frozen receipts checked for hash match' },
  { key: 'onchain',  label: 'Trace Anchored',         sub: 'Receipt root + trace hash committed' },
  { key: 'decrypt',  label: 'Local Reveal',           sub: 'Result decrypted only in your browser' },
]

type StepStatus = 'pending' | 'active' | 'done' | 'error'
function stepStatus(key: string, stage: string, requestId: string | null, jobStatus: string | null, decrypted: boolean): StepStatus {
  // Local stages (before ICL submission)
  if (!requestId) {
    if (key === 'encrypt') return stage === 'encrypting' ? 'active' : stage === 'uploading' || stage === 'submitting' ? 'done' : 'pending'
    if (key === 'icl') return stage === 'uploading' ? 'active' : stage === 'submitting' ? 'done' : 'pending'
    return 'pending'
  }

  const order = ['encrypt', 'icl', 'leader', 'quorum', 'onchain', 'decrypt']
  const idx = order.indexOf(key)

  // Granular ICL stage mapping
  let reached = 0
  switch (jobStatus) {
    case 'QUEUED':
      reached = 1 // encrypt done, icl active
      break
    case 'ASSIGNED':
      reached = 2 // icl done, leader active
      break
    case 'EXECUTING':
      reached = 3 // leader done, quorum active
      break
    case 'VERIFYING':
      reached = 4 // quorum done, onchain active
      break
    case 'ACCEPTED':
      reached = 5 // onchain done, decrypt active (waiting for user)
      break
    case 'REJECTED':
    case 'DISPUTED':
      // Something went wrong — mark current step as error, previous as done
      if (idx < reached) return 'done'
      if (idx === reached) return 'error'
      return 'pending'
    default:
      reached = 0
  }

  // Decrypt step is only done after the user actually decrypts
  if (key === 'decrypt') {
    if (jobStatus === 'ACCEPTED' && decrypted) return 'done'
    if (jobStatus === 'ACCEPTED' && !decrypted) return 'active'
    if (reached > 5) return 'done'
    return 'pending'
  }

  if (idx < reached) return 'done'
  if (idx === reached) return 'active'
  return 'pending'
}

export function InferenceNewPage() {
  const [mode, setMode] = useState<'chat' | 'risk'>('chat')
  const [prompt, setPrompt] = useState('')
  const [selectedModelKey, setSelectedModelKey] = useState<TextModelKey>('groq_llama_70b')
  const [error, setError] = useState<string | null>(null)
  const [showModelPicker, setShowModelPicker] = useState(false)
  const modelRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const navigate = useNavigate()
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { client: cofheClient, isReady } = useCofheClient()
  const store = useInferenceStore()
  const { messages, pushUserMessage, updateAssistantStatus, updateAssistantMetadata, failAssistantMessage, setActiveRequestId, status, decryptMessage } = useChat()

  const selectedModel = TEXT_MODEL_OPTIONS[selectedModelKey]
  const currentRiskModel = MODEL_BINDINGS[store.modelId]
  const basePrice = currentRiskModel.baseFee
  const coveragePremium = store.coverageEnabled ? 2 : 0
  const totalDisplay = basePrice + coveragePremium

  const [chatStage, setChatStage] = useState<'idle' | 'encrypting' | 'uploading' | 'submitting'>('idle')
  const isChatBusy = chatStage !== 'idle'

  const hasMessages = messages.length > 0
  const jobStatus = status?.status ?? null
  const latestRequestId = [...messages].reverse().find(m => m.role === 'assistant' && m.requestId)?.requestId ?? null

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages.length])

  // Close model picker on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) {
        setShowModelPicker(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const handleSuggestionClick = useCallback((text: string) => {
    setPrompt(text)
  }, [])

  const handleChatSubmit = async () => {
    const normalizedPrompt = prompt.trim()
    if (!normalizedPrompt) { setError('Please enter a prompt first.'); return }
    if (!cofheClient || !isReady || !address) { setError('Connect your wallet and wait for CoFHE to initialize.'); return }
    if (!publicClient || !walletClient) { setError('Wallet client is not available yet.'); return }

    const promptKeyStoreAddress = import.meta.env.VITE_PROMPT_KEY_STORE_ADDRESS as Hex | undefined
    if (!promptKeyStoreAddress) { setError('VITE_PROMPT_KEY_STORE_ADDRESS is not configured.'); return }

    const assistantId = pushUserMessage(normalizedPrompt, selectedModel.label)
    setPrompt('')
    setError(null)

    try {
      setChatStage('encrypting')
      updateAssistantStatus(assistantId, 'encrypting')

      const promptKey = generateKey()
      const encryptedPrompt = await encryptText(normalizedPrompt, promptKey)
      const packedPrompt = packPayload(encryptedPrompt)

      const encryptedPromptKey = await encryptPromptKeyForTextRequest(cofheClient, promptKey)
      const taskId = generateTaskId()

      updateAssistantMetadata(assistantId, {
        taskId,
        modelId: selectedModel.id,
      })

      console.log('[Blindference] CoFHE encryption success:', {
        taskId,
        highCtHash: encryptedPromptKey.encryptedPromptKey.high,
        lowCtHash: encryptedPromptKey.encryptedPromptKey.low,
      })

      // ── On-chain storeKey (opens MetaMask) ──────────────────────────
      // Do this BEFORE quorum preview so the user can verify CoFHE
      // ciphertexts are valid on-chain even if no nodes are running.
      let allowedNodes: Hex[] = []
      let quorumPreview: { data: { leader: string; verifiers: string[] } } | null = null

      try {
        quorumPreview = await inferenceApi.getQuorumPreview({
          model_id: selectedModel.id,
          min_tier: 0,
          verifier_count: 2,
          zdr_required: false,
        })
        allowedNodes = [quorumPreview.data.leader as Hex, ...quorumPreview.data.verifiers.map((v) => v as Hex)]
      } catch (quorumErr) {
        const msg = axios.isAxiosError(quorumErr)
          ? quorumErr.response?.data?.detail
          : quorumErr instanceof Error
            ? quorumErr.message
            : String(quorumErr)
        console.warn('[Blindference] Quorum preview failed:', msg)
        allowedNodes = address ? [address] : []
      }

      const promptKeyStoreTx = await storePromptKeyForTextRequest({
        taskId,
        encryptedHighInput: encryptedPromptKey.metadata.cofhe_prompt_key_inputs.high as never,
        encryptedLowInput: encryptedPromptKey.metadata.cofhe_prompt_key_inputs.low as never,
        allowedNodes,
        promptKeyStoreAddress,
        publicClient,
        walletClient,
      })

      if (promptKeyStoreTx) {
        updateAssistantMetadata(assistantId, { storeKeyTx: promptKeyStoreTx })
      }

      // If quorum preview failed we stored the key on-chain but cannot submit
      if (!quorumPreview) {
        const msg =
          'Encrypted key stored on-chain successfully, but no inference nodes are available. ' +
          'Start at least 3 blindference-node instances (1 leader + 2 verifiers) and ensure they register with the ICL via /admin/bootstrap-demo-nodes or real attestation to form a quorum.'
        setError(msg)
        failAssistantMessage(assistantId, msg)
        setChatStage('idle')
        return
      }

      setChatStage('uploading')
      updateAssistantStatus(assistantId, 'processing')
      const timeoutMs = Number(import.meta.env.VITE_PROMPT_UPLOAD_TIMEOUT_MS || '30000')
      const uploadResp = await withTimeout(
        inferenceApi.uploadPromptBlob(new Blob([packedPrompt])),
        timeoutMs,
        'Encrypted prompt upload timed out. Check the ICL and Pinata connectivity, then try again.',
      )
      const promptCID = uploadResp.data.cid
      updateAssistantMetadata(assistantId, { promptCID })

      setChatStage('submitting')
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
        min_tier: 0,
        zdr_required: false,
        verifier_count: 2,
        metadata: {
          cofhe_prompt_key_inputs: encryptedPromptKey.metadata.cofhe_prompt_key_inputs,
          prompt_length: normalizedPrompt.length,
          vertical: 'blindference-text-demo',
          provider: selectedModel.provider,
          model: selectedModel.model,
          is_agent_job: false,
          uavp_enabled: true,
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

      updateAssistantMetadata(assistantId, {
        requestIdDisplay: requestId,
        leader: quorumPreview.data.leader,
        verifiers: quorumPreview.data.verifiers.join(', '),
      })

      updateAssistantStatus(assistantId, 'processing', requestId)
      setActiveRequestId(requestId)
    } catch (submitError) {
      let msg = 'Failed to submit text inference request.'
      if (axios.isAxiosError(submitError)) {
        const detail = submitError.response?.data?.detail
        if (typeof detail === 'string' && detail.trim()) {
          msg = detail
        }
      } else if (submitError instanceof Error) {
        msg = submitError.message
      }
      setError(msg)
      failAssistantMessage(assistantId, msg)
    } finally {
      setChatStage('idle')
    }
  }

  const handleRiskSubmit = async () => {
    if (store.creditScore < 300 || store.creditScore > 850) {
      store.setError('Invalid credit score. Must be between 300 and 850.')
      return
    }

    if (!cofheClient || !isReady || !address) {
      store.setError('Connect your wallet and wait for CoFHE to initialize.')
      return
    }
    if (!walletClient || !publicClient) {
      store.setError('Wallet client is not available yet.')
      return
    }

    const inputVaultAddress = import.meta.env.VITE_BLINDFERENCE_INPUT_VAULT_ADDRESS as Hex | undefined
    if (!inputVaultAddress) {
      store.setError('VITE_BLINDFERENCE_INPUT_VAULT_ADDRESS is not configured.')
      return
    }

    try {
      store.setError(null)
      store.setIsEncrypting(true)
      const loanId = `loan_${Date.now()}`

      const encrypted = await encryptRiskFeatures(cofheClient, {
        creditScore: store.creditScore,
        loanAmount: store.loanAmount,
        accountAge: store.accountAge,
        prevDefaults: store.prevDefaults,
      })

      const inputVaultTx = await storeEncryptedRiskInputsInVault({
        encryptedInputs: encrypted,
        loanId,
        publicClient,
        vaultAddress: inputVaultAddress,
        walletClient,
      })

      const storedVaultInputs = await readStoredRiskInputHandles({
        loanId,
        publicClient,
        vaultAddress: inputVaultAddress,
      })
      if (storedVaultInputs.owner.toLowerCase() !== address.toLowerCase()) {
        throw new Error(
          'BlindferenceInputVault stored handles for a different owner than the connected wallet.'
        )
      }

      const vaultBackedEncryptedInput = encrypted.map((item, index) => ({
        ctHash: storedVaultInputs.handles[index].toString(),
        utype: item.utype,
        signature: item.signature,
      }))

      const quorumPreview = await inferenceApi.getQuorumPreview({
        model_id: currentRiskModel.modelId,
        min_tier: 0,
        verifier_count: 2,
        zdr_required: false,
      })
      const quorumNodes = [quorumPreview.data.leader, ...quorumPreview.data.verifiers]

      const permits = await Promise.all(
        quorumNodes.map(async (nodeAddress) => {
          const sharingPermit = await cofheClient.permits.createSharing({
            issuer: address,
            recipient: nodeAddress,
            name: `Blindference ${currentRiskModel.modelId} ${Date.now()} -> ${nodeAddress}`,
            expiration: Math.floor(Date.now() / 1000) + 30 * 24 * 3600, // 30 days
          })
          return {
            node: nodeAddress,
            permit: PermitUtils.export(sharingPermit),
          }
        })
      )

      store.setIsEncrypting(false)
      store.setIsSubmitting(true)

      const response = await inferenceApi.submit({
        model_id: currentRiskModel.modelId,
        encrypted_input: vaultBackedEncryptedInput,
        permits,
        leader_address: quorumPreview.data.leader,
        verifier_addresses: quorumPreview.data.verifiers,
        feature_types: ['uint32', 'uint64', 'uint32', 'uint8'],
        loan_id: loanId,
        coverage_type: store.coverageEnabled ? 'HALLUCINATION' : null,
        max_fee_gnk: totalDisplay,
        developer_address: address,
        min_tier: 0,
        zdr_required: false,
        verifier_count: 2,
        metadata: {
          coverage_requested: store.coverageEnabled,
          encryption_mode: 'cofhe',
          input_vault_address: inputVaultAddress,
          input_vault_tx: inputVaultTx,
          input_vault_owner: storedVaultInputs.owner,
          input_vault_stored_at: storedVaultInputs.storedAt.toString(),
          vertical: 'blindference-risk-demo',
          provider: currentRiskModel.provider,
          model: currentRiskModel.model,
        },
      })

      addHistoryEntry({
        id: loanId,
        title: `Risk: ${store.creditScore}/${store.loanAmount}/${store.accountAge}/${store.prevDefaults}`,
        prompt: `Risk scoring: credit=${store.creditScore}, loan=${store.loanAmount}, age=${store.accountAge}, defaults=${store.prevDefaults}`,
        mode: 'risk',
        model: currentRiskModel.modelId,
        status: 'processing',
        requestId: response.data.request_id,
        timestamp: Date.now(),
      })

      store.setRequestId(response.data.request_id)
      navigate(`/inference/${response.data.request_id}`)
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const detail = error.response?.data?.detail
        if (typeof detail === 'string' && detail.trim()) {
          store.setError(detail)
          return
        }
      }
      store.setError(error instanceof Error ? error.message : 'Failed to submit request.')
    } finally {
      store.setIsSubmitting(false)
      store.setIsEncrypting(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Scrollable area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-6 py-8">

            {/* Mode toggle pills */}
            <div className="flex items-center justify-center gap-2 mb-6">
              <button
                type="button"
                onClick={() => setMode('chat')}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-colors border ${
                  mode === 'chat'
                    ? 'bg-white text-black border-white'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Chat
              </button>
              <button
                type="button"
                onClick={() => setMode('risk')}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-colors border ${
                  mode === 'risk'
                    ? 'bg-white text-black border-white'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                Risk Scoring
              </button>
            </div>

            {mode === 'chat' ? (
              <>
                {/* Empty state heading */}
                <AnimatePresence>
                  {!hasMessages && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center justify-center min-h-[30vh] text-center space-y-4 pb-8"
                    >
                      <h1 className="text-3xl font-semibold tracking-tight text-white">What do you want to infer?</h1>
                      <p className="text-sm text-zinc-500">
                        Private inference through Fhenix CoFHE. Your prompt and result never leave the enclave in plaintext.
                      </p>
                      {/* Suggestion chips */}
                      <div className="flex flex-wrap justify-center gap-2 pt-2 max-w-lg">
                        {[
                          'Staking risk score analysis',
                          'Gaming strategy optimization',
                          'DeFi yield farming assessment',
                          'Smart contract vulnerability check',
                        ].map((label) => (
                          <button
                            key={label}
                            type="button"
                            onClick={() => handleSuggestionClick(label)}
                            className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-2.5 text-xs text-zinc-400 hover:border-zinc-700 hover:text-zinc-200 hover:bg-zinc-800/60 transition-all"
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Chat messages */}
                <ChatView entries={messages} onSuggestionClick={handleSuggestionClick} onDecrypt={decryptMessage} />
              </>
            ) : (
              /* Risk Scoring Mode */
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-5 max-w-2xl mx-auto">
                <div className="mb-2">
                  <h1 className="text-2xl font-semibold text-white mb-1">Risk Assessment</h1>
                  <p className="text-sm text-zinc-500">Secure, end-to-end encrypted inference via FHE.</p>
                </div>

                {store.error && (
                  <div className="mb-4 flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-500">
                    <ShieldAlert className="h-5 w-5" />
                    {store.error}
                  </div>
                )}

                {/* Model selector */}
                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
                    Model Selection
                  </label>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {(['llama3-70b', 'gemini-pro', 'opt-125m'] as const).map((id) => {
                      const isSelected = store.modelId === id
                      const m = MODEL_BINDINGS[id]
                      return (
                        <button
                          className={cn(
                            'cursor-pointer rounded-xl p-4 text-left outline-none transition-all flex flex-col gap-1.5',
                            isSelected
                              ? 'border border-white/20 bg-white/[0.03] shadow-[0_0_15px_rgba(255,255,255,0.05)]'
                              : 'border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'
                          )}
                          key={id}
                          onClick={() => store.setModelId(id)}
                          type="button"
                        >
                          <span className="text-base font-semibold capitalize text-white">
                            {id.replace('-', ' ')}
                          </span>
                          <span className="text-xs text-zinc-500">
                            {id === 'gemini-pro' ? 'Google API' : id === 'opt-125m' ? 'Local GPU' : 'DePIN execution'}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Applicant data */}
                <div className="space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
                    Applicant Data (Encrypted)
                  </label>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {(
                      [
                        ['Credit Score', store.creditScore, store.setCreditScore, 300, 850],
                        ['Loan Amount ($)', store.loanAmount, store.setLoanAmount, 0, undefined],
                        ['Account Age (days)', store.accountAge, store.setAccountAge, 0, undefined],
                        ['Previous Defaults', store.prevDefaults, store.setPrevDefaults, 0, 10],
                      ] as const
                    ).map(([label, value, setter, min, max]) => (
                      <div className="space-y-1.5" key={label}>
                        <span className="text-xs font-medium text-zinc-400">{label}</span>
                        <input
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 font-mono text-sm text-white focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all"
                          max={max}
                          min={min}
                          onChange={(e) => setter(Number(e.target.value))}
                          type="number"
                          value={value}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Coverage */}
                <div className="flex items-start gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 hover:border-zinc-700 transition-colors">
                  <input
                    checked={store.coverageEnabled}
                    className="mt-1 cursor-pointer h-5 w-5 rounded border-zinc-700 bg-zinc-900 text-white focus:ring-white/20 focus:ring-offset-zinc-900"
                    onChange={(e) => store.setCoverageEnabled(e.target.checked)}
                    type="checkbox"
                  />
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-white">Hallucination Coverage</h4>
                    <p className="text-xs leading-relaxed text-zinc-500">
                      Receive up to 500 USDC payout if the prediction is disputed and settled in your
                      favor. Premium is automatically calculated.
                    </p>
                  </div>
                </div>

                {/* Fee + submit */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-t border-zinc-800 pt-6 gap-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
                      Estimated Fee
                    </span>
                    <div className="text-2xl font-mono text-white mt-1">
                      {totalDisplay}.00 <span className="text-zinc-400 text-lg">GNK</span>
                    </div>
                  </div>

                  <button
                    className="flex w-full sm:w-auto min-w-[220px] items-center justify-center rounded-xl bg-white px-8 py-3.5 text-sm font-bold text-black transition-all hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={store.isEncrypting || store.isSubmitting || !isReady || !address}
                    onClick={handleRiskSubmit}
                    type="button"
                  >
                    {store.isEncrypting ? (
                      <div className="flex items-center gap-2">
                        <Lock className="h-4 w-4 animate-pulse text-black" />
                        Encrypting...
                      </div>
                    ) : store.isSubmitting ? (
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                        Submitting
                      </div>
                    ) : (
                      'Run Encrypted Inference'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sticky bottom input (chat only) */}
        {mode === 'chat' && (
          <div className="border-t border-zinc-800 bg-[#0a0a0a] px-6 py-4">
            <div className="mx-auto max-w-2xl">

              {/* Error row */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2 text-xs text-red-400 mb-2"
                  >
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Big rounded-3xl input */}
              <div className="rounded-3xl border border-zinc-700 bg-zinc-900/70 relative">
                <textarea
                  rows={3}
                  className="w-full resize-none bg-transparent px-5 pt-4 pb-12 text-sm leading-relaxed text-white placeholder:text-zinc-600 focus:outline-none"
                  placeholder="Ask anything... (⌘+Enter to send)"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={isChatBusy}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !isChatBusy) {
                      e.preventDefault()
                      handleChatSubmit()
                    }
                  }}
                />

                {/* Bottom row inside input */}
                <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
                  {/* Model picker pill */}
                  <div className="relative" ref={modelRef}>
                    <button
                      type="button"
                      onClick={() => setShowModelPicker((v) => !v)}
                      disabled={isChatBusy}
                      className="flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-zinc-700 transition-colors disabled:opacity-50"
                    >
                      <Cpu className="w-3 h-3 text-zinc-400" />
                      {selectedModel.label}
                      <ChevronDown className={`w-3 h-3 text-zinc-500 transition-transform ${showModelPicker ? 'rotate-180' : ''}`} />
                    </button>
                    <AnimatePresence>
                      {showModelPicker && (
                        <motion.div
                          initial={{ opacity: 0, y: 6, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 6, scale: 0.97 }}
                          transition={{ duration: 0.15 }}
                          className="absolute bottom-full left-0 mb-2 w-72 rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl z-50 overflow-hidden"
                        >
                          {Object.entries(TEXT_MODEL_OPTIONS).map(([k, o]) => (
                            <button
                              key={k}
                              type="button"
                              onClick={() => { setSelectedModelKey(k as TextModelKey); setShowModelPicker(false) }}
                              className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-zinc-800 transition-colors ${selectedModelKey === k ? 'bg-zinc-800' : ''}`}
                            >
                              <Cpu className="w-4 h-4 text-zinc-400 mt-0.5 shrink-0" />
                              <div>
                                <div className="text-sm font-semibold text-white flex items-center gap-2">
                                  {o.label}{selectedModelKey === k && <CheckCircle2 className="w-3.5 h-3.5 text-zinc-300" />}
                                </div>
                                <div className="text-xs text-zinc-500 mt-0.5">{o.provider} · {o.model}</div>
                              </div>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="flex items-center gap-2">
                    <AnimatePresence>
                      {isChatBusy && (
                        <motion.span
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex items-center gap-1.5 text-[11px] text-zinc-500"
                        >
                          <Loader2 className="w-3 h-3 animate-spin" />
                          {chatStage === 'encrypting' ? 'Sealing...' : chatStage === 'uploading' ? 'Uploading...' : 'Dispatching...'}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    <span className="flex items-center gap-1 text-[11px] text-zinc-600">
                      <Lock className="w-3 h-3" /> Private
                    </span>
                    <button
                      type="button"
                      onClick={handleChatSubmit}
                      disabled={isChatBusy || !isReady || !address || !prompt.trim()}
                      className="flex items-center justify-center w-9 h-9 rounded-full bg-white text-black hover:bg-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isChatBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT: Execution Trace sidebar */}
      <div className="hidden xl:flex w-72 shrink-0 flex-col border-l border-zinc-800 bg-[#0d0d0d] px-6 py-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-500 mb-8">Execution Trace</p>
        <div className="relative flex flex-col gap-0">
          {TRACE_STEPS.map((step, i) => {
            const latestAssistant = [...messages].reverse().find(m => m.role === 'assistant' && m.requestId === latestRequestId)
            const decrypted = latestAssistant?.status === 'done' || false
            const ss = stepStatus(step.key, chatStage, latestRequestId, jobStatus, decrypted)
            const isLast = i === TRACE_STEPS.length - 1
            return (
              <div key={step.key} className="flex gap-3 relative">
                {!isLast && <div className="absolute left-[7px] top-5 w-[2px] h-full bg-zinc-800" />}
                <div className="relative z-10 mt-0.5 shrink-0">
                  {ss === 'done' ? (
                    <div className="w-4 h-4 rounded-full bg-zinc-300 flex items-center justify-center">
                      <CheckCircle2 className="w-3 h-3 text-black" />
                    </div>
                  ) : ss === 'active' ? (
                    <motion.div
                      animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
                      transition={{ repeat: Infinity, duration: 1.4 }}
                      className="w-4 h-4 rounded-full bg-white/80"
                    />
                  ) : ss === 'error' ? (
                    <div className="w-4 h-4 rounded-full bg-red-500/80 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-red-400" />
                    </div>
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-zinc-700 bg-zinc-900" />
                  )}
                </div>
                <div className={`pb-7 ${ss === 'pending' ? 'opacity-40' : ''}`}>
                  <div className={`text-sm font-medium ${ss === 'done' ? 'text-zinc-200' : ss === 'active' ? 'text-white' : ss === 'error' ? 'text-red-400' : 'text-zinc-500'}`}>
                    {step.label}
                  </div>
                  {(ss === 'active' || ss === 'done' || ss === 'error') && (
                    <div className={`text-[11px] mt-0.5 font-mono ${ss === 'error' ? 'text-red-500/70' : 'text-zinc-600'}`}>{step.sub}</div>
                  )}
                  {ss === 'active' && latestRequestId && step.key === 'leader' && status?.quorum.leader && (
                    <div className="mt-1.5 text-[10px] text-zinc-500 font-mono break-all">{status.quorum.leader.address.slice(0, 18)}...</div>
                  )}
                  {ss === 'active' && latestRequestId && step.key === 'quorum' && (
                    <div className="mt-1.5 text-[10px] text-zinc-500">{status?.quorum.confirm_count ?? 0}/{(status?.quorum.verifiers.length ?? 2)} confirmed</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        {latestRequestId && (
          <div className="mt-auto pt-6 border-t border-zinc-800 space-y-4">
            <div>
              <div className="text-[10px] uppercase text-zinc-600 mb-1">Request ID</div>
              <div className="font-mono text-[10px] text-zinc-500 break-all">{latestRequestId}</div>
              {status?.status && (
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-[10px] font-semibold text-zinc-300 uppercase tracking-wide">
                  <div className={`w-1.5 h-1.5 rounded-full ${status.status === 'ACCEPTED' ? 'bg-zinc-200' : 'animate-pulse bg-zinc-400'}`} />
                  {status.status}
                </div>
              )}
            </div>

            {/* Active On-chain Proof panel for current inference */}
            {(() => {
              const activeMsg = [...messages].reverse().find(m => m.role === 'assistant' && m.requestId === latestRequestId)
              const md = activeMsg?.metadata
              if (!md) return null
              const items = [
                { label: 'Task ID', value: md.taskId },
                { label: 'StoreKey Tx', value: md.storeKeyTx, href: md.storeKeyTx ? `https://sepolia.arbiscan.io/tx/${md.storeKeyTx}` : undefined },
                { label: 'Prompt CID', value: md.promptCID, href: md.promptCID ? `https://gateway.pinata.cloud/ipfs/${md.promptCID}` : undefined },
                { label: 'Leader', value: md.leader },
                { label: 'Verifiers', value: md.verifiers },
                { label: 'Model', value: md.modelId },
              ].filter(i => i.value)
              if (items.length === 0) return null
              return (
                <div className="border-t border-zinc-800 pt-4">
                  <div className="text-[10px] uppercase text-zinc-600 mb-2 flex items-center gap-1.5">
                    <ShieldCheck className="w-3 h-3" />
                    On-chain Proof
                  </div>
                  <AnimatePresence mode="popLayout">
                    <motion.div
                      key={latestRequestId}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.25 }}
                      className="space-y-1"
                    >
                      {items.map((item, i) => (
                        <motion.div
                          key={item.label}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.25, delay: i * 0.06 }}
                          className="flex items-center justify-between text-[10px] font-mono"
                        >
                          <span className="text-zinc-600 uppercase tracking-wider">{item.label}</span>
                          <div className="flex items-center gap-1.5">
                            {item.href ? (
                              <a
                                href={item.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
                              >
                                {item.value!.slice(0, 18)}{item.value!.length > 18 ? '…' : ''}
                              </a>
                            ) : (
                              <span className="text-zinc-400">{item.value!.slice(0, 18)}{item.value!.length > 18 ? '…' : ''}</span>
                            )}
                            <button
                              onClick={() => navigator.clipboard.writeText(item.value!)}
                              className="text-zinc-600 hover:text-zinc-300 transition-colors p-0.5"
                              title="Copy"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  </AnimatePresence>
                </div>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}
