import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { Lock, ShieldAlert, ShieldCheck, Copy, Cpu, CheckCircle2, Loader2, ChevronDown, Send, MessageSquare, BarChart2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Hex } from 'viem'
import axios from 'axios'
import { SectionLabel } from '../components/effects/GlowDivider'

import { inferenceApi, jobApi } from '../api/inferenceApi'
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
import { CreditBalance } from '../components/CreditBalance'
import { useCreateEscrow } from '../hooks/useCreateEscrow'
import { GlassCard } from '../components/ui/GlassCard'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'


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
  const iv = crypto.getRandomValues(new Uint8Array(12))
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
    if (key === 'icl') return stage === 'uploading' ? 'active' : stage === 'escrow' || stage === 'submitting' ? 'done' : 'pending'
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

  const [chatStage, setChatStage] = useState<'idle' | 'encrypting' | 'uploading' | 'escrow' | 'submitting'>('idle')
  const isChatBusy = chatStage !== 'idle'

  // Payment mode state
  const [paymentMode, setPaymentMode] = useState<'escrow' | 'credits'>('credits')
  const [paymentCurrency, setPaymentCurrency] = useState<'cusdc' | 'blind'>('cusdc')
  const [insuranceOptIn, setInsuranceOptIn] = useState(false)
  const { createEscrow, loading: escrowLoading, error: escrowError } = useCreateEscrow()

  const jobPriceCusdc = selectedModel.id === 'groq:llama-3.3-70b-versatile' ? 5_000
    : selectedModel.id === 'gemini:gemini-2.5-flash' ? 3_000
    : 1_000
  const jobPriceDisplay = paymentCurrency === 'blind'
    ? ((jobPriceCusdc / 1e6) * (1 - 0.20) / 0.01).toFixed(2)
    : (jobPriceCusdc / 1e6).toFixed(3)

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
      console.log('[Blindference] Encrypting prompt with AES-256-GCM…')

      const promptKey = generateKey()
      const encryptedPrompt = await encryptText(normalizedPrompt, promptKey)
      const packedPrompt = packPayload(encryptedPrompt)

      const encryptedPromptKey = await encryptPromptKeyForTextRequest(cofheClient, promptKey)
      const taskId = generateTaskId()
      console.log('[Blindference] CoFHE key encryption success:', { taskId })

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
        console.log('[Blindference] PromptKey stored on-chain: tx =', promptKeyStoreTx)
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
      console.log('[Blindference] Prompt uploaded to IPFS: CID =', promptCID)

      // ── Escrow mode: create and fund Reineira escrow before submitting ──
      let escrowId: string | null = null
      if (paymentMode === 'escrow') {
        setChatStage('escrow')
        updateAssistantStatus(assistantId, 'escrow')
        console.log('[Blindference] Creating Reineira escrow for payment…')

        const escrowResult = await createEscrow(BigInt(jobPriceCusdc), taskId)
        if (!escrowResult) {
          const msg = escrowError || 'Escrow creation failed. Please ensure you have enough USDC and try again.'
          setError(msg)
          failAssistantMessage(assistantId, msg)
          setChatStage('idle')
          return
        }
        escrowId = String(escrowResult.escrowId)
        console.log(`[Blindference] Escrow created: id=${escrowId}`)

        // After escrow creation (which takes time for MetaMask confirmations),
        // re-verify nodes are still available before submitting to ICL.
        try {
          const postEscrowPreview = await inferenceApi.getQuorumPreview({
            model_id: selectedModel.id,
            min_tier: 0,
            verifier_count: 2,
            zdr_required: false,
          })
          console.log('[Blindference] Post-escrow quorum re-verified:', postEscrowPreview.data)
        } catch (quorumErr) {
          const msg = axios.isAxiosError(quorumErr)
            ? quorumErr.response?.data?.detail
            : quorumErr instanceof Error
              ? quorumErr.message
              : String(quorumErr)
          console.error('[Blindference] Post-escrow quorum check failed:', msg)
          const errorMsg =
            'Inference nodes became unavailable while creating the escrow. ' +
            'Please re-bootstrap nodes (curl /admin/bootstrap-demo-nodes) and try again.'
          setError(errorMsg)
          failAssistantMessage(assistantId, errorMsg)
          setChatStage('idle')
          return
        }
      }

      setChatStage('submitting')
      console.log('[Blindference] Submitting job to Payment Service…')
      const response = await jobApi.submit({
        user_address: address,
        prompt_cid: promptCID,
        model_id: selectedModel.id,
        encrypted_prompt_key_high: encryptedPromptKey.encryptedPromptKey.high,
        encrypted_prompt_key_low: encryptedPromptKey.encryptedPromptKey.low,
        payment_mode: paymentMode,
        payment_currency: paymentCurrency,
        insurance_opt_in: insuranceOptIn,
        escrow_id: escrowId,
        task_id: taskId,
        min_tier: 0,
        zdr_required: false,
        verifier_count: 2,
        permits: [],
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
          source: 'frontend',
        },
      })

      const payload = response.data
      const jobId = payload.job_id

      if (!jobId) {
        throw new Error('The Payment Service response did not include a job identifier.')
      }

      console.log(`[Blindference] Job submitted: job_id = ${jobId}, status = ${payload.status}`)
      if (payload.escrow_id) {
        console.log(`[Blindference] Escrow created: escrow_id = ${payload.escrow_id}`)
      }

      updateAssistantMetadata(assistantId, {
        requestIdDisplay: jobId,
        leader: quorumPreview.data.leader,
        verifiers: quorumPreview.data.verifiers.join(', '),
      })

      updateAssistantStatus(assistantId, 'processing', jobId)
      setActiveRequestId(jobId)
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
      console.error('[Blindference] Job submission failed:', msg)
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
    <div className="flex h-[calc(100vh-3.5rem)] bg-brand-bg">
      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Scrollable area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-6 py-8">

            {/* Mode toggle pills */}
            <div className="flex items-center justify-center gap-2 mb-6" data-tutorial="mode-toggle">
              <button
                type="button"
                onClick={() => setMode('chat')}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-colors border ${
                  mode === 'chat'
                    ? 'bg-violet-500 text-white border-violet-500 glow-violet'
                    : 'glass-card-subtle text-white/50 border-white/10 hover:border-white/20 hover:text-white'
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
                    ? 'bg-violet-500 text-white border-violet-500 glow-violet'
                    : 'glass-card-subtle text-white/50 border-white/10 hover:border-white/20 hover:text-white'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                Risk Scoring
              </button>
              <div className="ml-auto">
                <CreditBalance />
              </div>
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
                      <h1 className="text-3xl font-semibold tracking-tight text-white font-heading">What do you want to infer?</h1>
                      <p className="text-sm text-white/50">
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
                            className="rounded-xl border border-white/10 glass-card px-4 py-2.5 text-xs text-white/50 hover:border-white/20 hover:text-white hover:bg-white/5 transition-all"
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
              <GlassCard className="gradient-accent-top p-6 space-y-5 max-w-2xl mx-auto" hoverEffect={false}>
                <div className="mb-2">
                  <SectionLabel>RISK ASSESSMENT</SectionLabel>
                  <h1 className="text-2xl font-semibold text-white font-heading mb-1 mt-1">Confidential Risk Scoring</h1>
                  <p className="text-sm text-white/50">Secure, end-to-end encrypted inference via FHE.</p>
                </div>

                {store.error && (
                  <div className="mb-4 flex items-center gap-3 rounded-lg border border-error/30 bg-error/10 p-4 text-sm text-error">
                    <ShieldAlert className="h-5 w-5" />
                    {store.error}
                  </div>
                )}

                {/* Model selector */}
                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">
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
                              ? 'border border-violet-500/30 bg-violet-500/5 shadow-[0_0_15px_rgba(139,92,246,0.1)]'
                              : 'border border-white/10 bg-[rgba(10,10,10,0.4)] hover:border-white/20'
                          )}
                          key={id}
                          onClick={() => store.setModelId(id)}
                          type="button"
                        >
                          <span className="text-base font-semibold capitalize text-white">
                            {id.replace('-', ' ')}
                          </span>
                          <span className="text-xs text-white/50">
                            {id === 'gemini-pro' ? 'Google API' : id === 'opt-125m' ? 'Local GPU' : 'DePIN execution'}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Applicant data */}
                <div className="space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">
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
                        <span className="text-xs font-medium text-white/50">{label}</span>
                        <input
                          className="input-glass w-full px-4 py-2.5 font-mono text-sm"
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
                <div className="flex items-start gap-4 rounded-xl border border-white/10 bg-[rgba(10,10,10,0.4)] p-4 hover:border-white/20 transition-colors">
                  <input
                    checked={store.coverageEnabled}
                    className="mt-1 cursor-pointer h-5 w-5 rounded border-white/10 bg-[rgba(10,10,10,0.6)] text-violet-500 focus:ring-violet-500/20 focus:ring-offset-black"
                    onChange={(e) => store.setCoverageEnabled(e.target.checked)}
                    type="checkbox"
                  />
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-white">Hallucination Coverage</h4>
                    <p className="text-xs leading-relaxed text-white/50">
                      Receive up to 500 USDC payout if the prediction is disputed and settled in your
                      favor. Premium is automatically calculated.
                    </p>
                  </div>
                </div>

                {/* Fee + submit */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-t border-white/10 pt-6 gap-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">
                      Estimated Fee
                    </span>
                    <div className="text-2xl font-mono text-white mt-1">
                      {totalDisplay}.00 <span className="text-white/50 text-lg">BLIND</span>
                    </div>
                  </div>

                  <button
                    className="btn-primary flex w-full sm:w-auto min-w-[220px] items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={store.isEncrypting || store.isSubmitting || !isReady || !address}
                    onClick={handleRiskSubmit}
                    type="button"
                  >
                    {store.isEncrypting ? (
                      <div className="flex items-center gap-2">
                        <Lock className="h-4 w-4 animate-pulse text-white" />
                        Encrypting...
                      </div>
                    ) : store.isSubmitting ? (
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Submitting
                      </div>
                    ) : (
                      'Run Encrypted Inference'
                    )}
                  </button>
                </div>
              </GlassCard>
            )}
          </div>
        </div>

        {/* Sticky bottom input (chat only) */}
        {mode === 'chat' && (
          <div className="border-t border-white/10 bg-brand-bg px-6 py-4">
            <div className="mx-auto max-w-2xl">

              {/* Error row */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2 text-xs text-error mb-2"
                  >
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Big rounded-3xl input */}
              <div className="rounded-3xl border border-white/10 glass-card backdrop-blur-md relative focus-within:border-violet-500/40 focus-within:shadow-[0_0_20px_rgba(139,92,246,0.1)] transition-all" data-tutorial="prompt-input">
                <textarea
                  rows={3}
                  className="w-full resize-none bg-transparent px-5 pt-4 pb-12 text-sm leading-relaxed text-white placeholder:text-white/30 focus:outline-none"
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

                {/* ── Row 1: Model picker + Send ── */}
                <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
                  {/* Model picker pill */}
                  <div className="relative" ref={modelRef} data-tutorial="model-picker">
                    <button
                      type="button"
                      onClick={() => setShowModelPicker((v) => !v)}
                      disabled={isChatBusy}
                      className="flex items-center gap-2 rounded-full border border-white/10 glass-card px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/5 transition-colors disabled:opacity-50"
                    >
                      <Cpu className="w-3.5 h-3.5 text-white/50" />
                      {selectedModel.label}
                      <ChevronDown className={`w-3.5 h-3.5 text-white/50 transition-transform ${showModelPicker ? 'rotate-180' : ''}`} />
                    </button>
                    <AnimatePresence>
                      {showModelPicker && (
                        <motion.div
                          initial={{ opacity: 0, y: 6, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 6, scale: 0.97 }}
                          transition={{ duration: 0.15 }}
                          className="absolute bottom-full left-0 mb-2 w-72 rounded-xl border border-white/10 bg-[rgba(10,10,10,0.9)] backdrop-blur-xl shadow-2xl z-50 overflow-hidden"
                        >
                          {Object.entries(TEXT_MODEL_OPTIONS).map(([k, o]) => (
                            <button
                              key={k}
                              type="button"
                              onClick={() => { setSelectedModelKey(k as TextModelKey); setShowModelPicker(false) }}
                              className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors ${selectedModelKey === k ? 'bg-white/5' : ''}`}
                            >
                              <Cpu className="w-4 h-4 text-white/50 mt-0.5 shrink-0" />
                              <div>
                                <div className="text-sm font-semibold text-white flex items-center gap-2">
                                  {o.label}{selectedModelKey === k && <CheckCircle2 className="w-3.5 h-3.5 text-violet-400" />}
                                </div>
                                <div className="text-xs text-white/50 mt-0.5">{o.provider} · {o.model}</div>
                              </div>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Right: status + send */}
                  <div className="flex items-center gap-3">
                    <AnimatePresence>
                      {isChatBusy && (
                        <motion.span
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex items-center gap-1.5 text-xs text-white/50"
                        >
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-500" />
                          {chatStage === 'encrypting' ? 'Sealing...' : chatStage === 'uploading' ? 'Uploading...' : chatStage === 'escrow' ? 'Escrow...' : 'Dispatching...'}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    <span className="flex items-center gap-1.5 text-[11px] text-white/40 bg-white/[0.04] border border-white/[0.08] rounded-full px-2.5 py-1 backdrop-blur-sm">
                      <Lock className="w-3 h-3" /> Private
                    </span>
                    <button
                      type="button"
                      onClick={handleChatSubmit}
                      disabled={isChatBusy || !isReady || !address || !prompt.trim()}
                      className="btn-primary flex items-center justify-center w-10 h-10 rounded-full p-0 disabled:opacity-40 disabled:cursor-not-allowed relative overflow-hidden"
                      data-tutorial="send-button"
                    >
                      {isChatBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                        <div className="flex items-center justify-center">
                          <img src="/logos/bf-app-logo.png" alt="B" className="w-4 h-4 object-contain opacity-90" />
                        </div>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Row 2: Payment config bar ── */}
              <div className="mt-3 flex flex-wrap items-center gap-2 sm:gap-3">
                {/* Payment mode toggle */}
                <div className="flex items-center rounded-full border border-white/10 glass-card p-1" data-tutorial="payment-mode">
                  <button
                    type="button"
                    onClick={() => setPaymentMode('credits')}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                      paymentMode === 'credits'
                        ? 'bg-violet-500 text-white'
                        : 'text-white/50 hover:text-white'
                    }`}
                  >
                    Credits
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMode('escrow')}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                      paymentMode === 'escrow'
                        ? 'bg-violet-500 text-white'
                        : 'text-white/50 hover:text-white'
                    }`}
                  >
                    Escrow
                  </button>
                </div>

                {/* Currency toggle (credits mode only) */}
                {paymentMode === 'credits' && (
                  <div className="flex items-center rounded-full border border-white/10 glass-card p-1" data-tutorial="currency-toggle">
                    <button
                      type="button"
                      onClick={() => setPaymentCurrency('cusdc')}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                        paymentCurrency === 'cusdc'
                          ? 'bg-violet-500/20 text-violet-400'
                          : 'text-white/50 hover:text-white'
                      }`}
                    >
                      cUSDC
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentCurrency('blind')}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                        paymentCurrency === 'blind'
                          ? 'bg-violet-500/20 text-violet-400'
                          : 'text-white/50 hover:text-white'
                      }`}
                    >
                      BLIND
                      <span className="ml-1 text-[10px] opacity-70">-20%</span>
                    </button>
                  </div>
                )}

                {/* Insure checkbox (credits mode only) */}
                {paymentMode === 'credits' && (
                  <label className="flex items-center gap-2 rounded-full border border-white/10 glass-card px-3 py-1.5 cursor-pointer hover:border-white/20 transition-colors" data-tutorial="insurance-toggle">
                    <input
                      type="checkbox"
                      checked={insuranceOptIn}
                      onChange={(e) => setInsuranceOptIn(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-white/10 bg-[rgba(10,10,10,0.6)] text-violet-500 focus:ring-violet-500/20"
                    />
                    <span className="text-xs text-white/60 font-medium">
                      Insure +2%
                    </span>
                  </label>
                )}

                {/* Fee estimate */}
                <div className="ml-auto flex items-center gap-2" data-tutorial="fee-display">
                  <span className="text-[10px] uppercase tracking-wider text-white/40 font-medium">
                    Est. Fee
                  </span>
                  <span className="text-sm font-mono text-white/80">
                    {paymentMode === 'credits'
                      ? `${(Number(jobPriceDisplay) * (1 + (insuranceOptIn ? 0.02 : 0))).toFixed(3)} ${paymentCurrency.toUpperCase()}`
                      : `${(jobPriceCusdc / 1e6).toFixed(3)} USDC`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT: Execution Trace sidebar */}
      <div className="hidden xl:flex w-80 shrink-0 flex-col p-4" data-tutorial="execution-trace">
        <GlassCard variant="heavy" className="gradient-accent-top flex-1 flex flex-col p-6 overflow-y-auto" hoverEffect={false}>
          <SectionLabel>EXECUTION TRACE</SectionLabel>
          <div className="h-4" />
          <div className="relative flex flex-col gap-0">
            {TRACE_STEPS.map((step, i) => {
              const latestAssistant = [...messages].reverse().find(m => m.role === 'assistant' && m.requestId === latestRequestId)
              const decrypted = latestAssistant?.status === 'done' || false
              const ss = stepStatus(step.key, chatStage, latestRequestId, jobStatus, decrypted)
              const isLast = i === TRACE_STEPS.length - 1
              return (
                <div key={step.key} className="flex gap-3 relative">
                  {!isLast && <div className="absolute left-[7px] top-5 w-[2px] h-full bg-white/10" />}
                  <div className="relative z-10 mt-0.5 shrink-0">
                    {ss === 'done' ? (
                      <div className="w-4 h-4 rounded-full bg-violet-500 flex items-center justify-center">
                        <CheckCircle2 className="w-3 h-3 text-black" />
                      </div>
                    ) : ss === 'active' ? (
                      <motion.div
                        animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
                        transition={{ repeat: Infinity, duration: 1.4 }}
                        className="w-4 h-4 rounded-full bg-violet-500 glow-violet"
                      />
                    ) : ss === 'error' ? (
                      <div className="w-4 h-4 rounded-full bg-error/80 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-error" />
                      </div>
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-white/10 glass-card" />
                    )}
                  </div>
                  <div className={`pb-7 ${ss === 'pending' ? 'opacity-40' : ''}`}>
                    <div className={`text-sm font-medium ${ss === 'done' ? 'text-white' : ss === 'active' ? 'text-white' : ss === 'error' ? 'text-error' : 'text-white/50'}`}>
                      {step.label}
                    </div>
                    {(ss === 'active' || ss === 'done' || ss === 'error') && (
                      <div className={`text-[11px] mt-0.5 font-mono ${ss === 'error' ? 'text-error/70' : 'text-white/30'}`}>{step.sub}</div>
                    )}
                    {ss === 'active' && latestRequestId && step.key === 'leader' && status?.quorum.leader && (
                      <div className="mt-1.5 text-[10px] text-white/40 font-mono break-all">{status.quorum.leader.address.slice(0, 18)}...</div>
                    )}
                    {ss === 'active' && latestRequestId && step.key === 'quorum' && (
                      <div className="mt-1.5 text-[10px] text-white/40">{(status?.quorum.confirm_count ?? 0)}/{(status?.quorum.verifiers.length ?? 2)} confirmed</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {latestRequestId && (
            <div className="mt-auto pt-6 border-t border-white/10 space-y-4">
              <div>
                <div className="text-[10px] uppercase text-white/40 mb-1">Request ID</div>
                <div className="font-mono text-[10px] text-white/50 break-all">{latestRequestId}</div>
                {status?.status && (
                  <Badge variant={status.status === 'ACCEPTED' ? 'success' : 'default'} className="mt-3 gap-1.5 px-3 py-1 text-[10px] uppercase tracking-wide">
                    <div className={`w-1.5 h-1.5 rounded-full ${status.status === 'ACCEPTED' ? 'bg-violet-500' : 'animate-pulse bg-violet-500'}`} />
                    {status.status}
                  </Badge>
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
                  <div className="border-t border-white/10 pt-4">
                    <div className="text-[10px] uppercase text-white/40 mb-2 flex items-center gap-1.5">
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
                            <span className="text-white/40 uppercase tracking-wider">{item.label}</span>
                            <div className="flex items-center gap-1.5">
                              {item.href ? (
                                <a
                                  href={item.href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-violet-400 hover:text-violet-300 underline underline-offset-2"
                                >
                                  {item.value!.slice(0, 18)}{item.value!.length > 18 ? '…' : ''}
                                </a>
                              ) : (
                                <span className="text-white/50">{item.value!.slice(0, 18)}{item.value!.length > 18 ? '…' : ''}</span>
                              )}
                              <button
                                onClick={() => navigator.clipboard.writeText(item.value!)}
                                className="text-white/30 hover:text-white transition-colors p-0.5"
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
        </GlassCard>
      </div>
    </div>
  )
}
