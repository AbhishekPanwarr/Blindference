import crypto from 'node:crypto'

import { createCofheClient, createCofheConfig } from '@cofhe/sdk/node'
import { Encryptable, FheTypes } from '@cofhe/sdk'
import { chains } from '@cofhe/sdk/chains'
import { createPublicClient, createWalletClient, http, keccak256 } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { arbitrumSepolia } from 'viem/chains'

// ------------------------------------------------------------------
// Configuration
// ------------------------------------------------------------------
const prompt = process.argv.slice(2).join(' ').trim() || 'What are the key benefits of FHE?'
const rpcUrl = process.env.COFHE_RPC_URL || process.env.ARBITRUM_SEPOLIA_RPC
const paymentBaseUrl = process.env.PAYMENT_BASE_URL || 'http://127.0.0.1:8001'
const iclBaseUrl = process.env.ICL_BASE_URL || 'http://127.0.0.1:8000'
const pinataJwt = process.env.PINATA_JWT
const gatewayBaseUrl = (process.env.PINATA_GATEWAY_URL || 'https://gateway.pinata.cloud/ipfs').replace(/\/$/, '')
const privateKey = normalizePrivateKey(process.env.USER_PRIVATE_KEY || process.env.PRIVATE_KEY || process.env.ICL_PRIVATE_KEY || '')
const promptKeyStoreAddress = process.env.PROMPT_KEY_STORE_ADDRESS || '0x7120fAbdAD2FC5B05CD814A59457eB5fCd9Cfa7E'
const modelId = process.env.TEXT_MODEL_ID || 'groq:llama-3.3-70b-versatile'

if (!rpcUrl) throw new Error('Missing COFHE_RPC_URL or ARBITRUM_SEPOLIA_RPC')
if (!pinataJwt) throw new Error('Missing PINATA_JWT')

const account = privateKeyToAccount(privateKey)
const config = createCofheConfig({ supportedChains: [chains.arbSepolia] })
const cofheClient = createCofheClient(config)
const publicClient = createPublicClient({ chain: arbitrumSepolia, transport: http(rpcUrl) })
const walletClient = createWalletClient({ account, chain: arbitrumSepolia, transport: http(rpcUrl) })
await cofheClient.connect(publicClient, walletClient)

// ------------------------------------------------------------------
// Step 1: Encrypt prompt + upload to IPFS
// ------------------------------------------------------------------
// ------------------------------------------------------------------
// Step 1: Generate deterministic task_id (bytes32)
// ------------------------------------------------------------------
const taskId = keccak256(crypto.randomBytes(32))
console.log(JSON.stringify({ step: 'init', taskId, developer: account.address }, null, 2))

// ------------------------------------------------------------------
// Step 2: Encrypt prompt + upload to IPFS
// ------------------------------------------------------------------
const promptKey = crypto.randomBytes(32)
const encryptedPrompt = await encryptText(prompt, promptKey)
const packedPrompt = packPayload(encryptedPrompt)
const promptCid = await uploadToIpfs(packedPrompt, pinataJwt)

console.log(JSON.stringify({ step: 'encrypted', promptCid }, null, 2))

// ------------------------------------------------------------------
// Step 3: CoFHE-encrypt the prompt key halves
// ------------------------------------------------------------------
const highHalf = bytesToBigInt(promptKey.subarray(0, 16))
const lowHalf = bytesToBigInt(promptKey.subarray(16, 32))
const [highInput, lowInput] = await cofheClient
  .encryptInputs([
    Encryptable.uint128(highHalf),
    Encryptable.uint128(lowHalf),
  ])
  .execute()

// ------------------------------------------------------------------
// Step 4: Fetch quorum preview to get allowed nodes
// ------------------------------------------------------------------
let allowedNodes = []
try {
  const previewResponse = await fetch(`${iclBaseUrl}/v1/inference/quorum-preview?model_id=${encodeURIComponent(modelId)}&min_tier=0&verifier_count=2`)
  if (previewResponse.ok) {
    const preview = await previewResponse.json()
    allowedNodes = [preview.leader, ...preview.verifiers]
    console.log(JSON.stringify({ step: 'quorum_preview', allowedNodes }, null, 2))
  }
} catch (err) {
  console.warn('Quorum preview failed (non-critical):', err.message)
}
if (allowedNodes.length === 0) {
  allowedNodes = [account.address]
}

// ------------------------------------------------------------------
// Step 5: Store prompt key on-chain via PromptKeyStore
// ------------------------------------------------------------------
const storeTx = await storePromptKey({
  taskId,
  highInput,
  lowInput,
  allowedNodes,
  promptKeyStoreAddress,
  publicClient,
  walletClient,
})
console.log(JSON.stringify({ step: 'store_key', txHash: storeTx }, null, 2))

// ------------------------------------------------------------------
// Step 6: Submit job via Payment Service gateway
// ------------------------------------------------------------------
const submitResponse = await fetch(`${paymentBaseUrl}/v1/jobs/submit`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user_address: account.address,
    prompt_cid: promptCid,
    model_id: modelId,
    encrypted_prompt_key_high: highInput.ctHash.toString(),
    encrypted_prompt_key_low: lowInput.ctHash.toString(),
    payment_mode: 'credits',
    payment_currency: 'blind',
    insurance_opt_in: false,
    task_id: taskId,
  }),
})

if (!submitResponse.ok) {
  const text = await submitResponse.text()
  if (submitResponse.status === 402) {
    throw new Error(
      `Payment Service returned 402 (Insufficient credits). ` +
      `Deposit cUSDC or BLIND credits first. Response: ${text}`
    )
  }
  throw new Error(`Payment Service submit failed: ${submitResponse.status} ${text}`)
}

const submitted = await submitResponse.json()
const jobId = submitted.job_id
if (!jobId) throw new Error(`Payment Service did not return a job id: ${JSON.stringify(submitted)}`)

console.log(JSON.stringify({ step: 'submitted', jobId, paymentStatus: submitted.status }, null, 2))

// ------------------------------------------------------------------
// Step 4: Poll Payment Service until COMPLETED or FAILED
// ------------------------------------------------------------------
const jobStatus = await waitForJobCompletion(jobId, paymentBaseUrl)
console.log(JSON.stringify({ step: 'finalized', jobStatus }, null, 2))

if (jobStatus.status !== 'COMPLETED') {
  throw new Error(
    `Job ${jobId} ended with status ${jobStatus.status}: ${jobStatus.error_reason || 'no error reason'}`
  )
}

// ------------------------------------------------------------------
// Step 5: Fetch output key handles from ICL (task_id == job_id)
// ------------------------------------------------------------------
const iclTaskResponse = await fetch(`${iclBaseUrl}/v1/inference/task/${jobId}`)
if (!iclTaskResponse.ok) {
  throw new Error(
    `ICL task lookup failed: ${iclTaskResponse.status} ${await iclTaskResponse.text()}`
  )
}
const iclTask = await iclTaskResponse.json()

if (!iclTask.encrypted_output_key_high || !iclTask.encrypted_output_key_low) {
  throw new Error(
    `ICL task missing output keys: ${JSON.stringify(iclTask)}`
  )
}

console.log(JSON.stringify({
  step: 'output_keys',
  encrypted_output_key_high: iclTask.encrypted_output_key_high,
  encrypted_output_key_low: iclTask.encrypted_output_key_low,
  output_cid: iclTask.output_cid,
}, null, 2))

// ------------------------------------------------------------------
// Step 6: Decrypt output key halves with CoFHE
// ------------------------------------------------------------------
const permit = await cofheClient.permits.getOrCreateSelfPermit(undefined, account.address, {
  issuer: account.address,
  name: 'Blindference Output Key Permit',
})

const decryptedHigh = await cofheClient
  .decryptForView(BigInt(iclTask.encrypted_output_key_high), FheTypes.Uint128)
  .withPermit(permit)
  .execute()
const decryptedLow = await cofheClient
  .decryptForView(BigInt(iclTask.encrypted_output_key_low), FheTypes.Uint128)
  .withPermit(permit)
  .execute()

const outputKey = combineHalves(decryptedHigh, decryptedLow)
console.log(JSON.stringify({ step: 'decrypted_key', outputKeyHex: outputKey.toString('hex') }, null, 2))

// ------------------------------------------------------------------
// Step 7: Download and decrypt output from IPFS
// ------------------------------------------------------------------
const outputText = await downloadAndDecrypt(iclTask.output_cid, outputKey)
console.log(JSON.stringify({ step: 'decrypted_output', outputText }, null, 2))

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
async function storePromptKey({ taskId, highInput, lowInput, allowedNodes, promptKeyStoreAddress, publicClient, walletClient }) {
  const toContractInput = (item) => ({
    ctHash: item.ctHash,
    securityZone: item.securityZone ?? 0,
    utype: Number(item.utype),
    signature: item.signature,
  })

  const latestBlock = await publicClient.getBlock({ blockTag: 'latest' })
  const fallbackPriorityFee = 2_000_000n
  const maxPriorityFeePerGas = await publicClient.estimateMaxPriorityFeePerGas().catch(() => fallbackPriorityFee)
  const priorityFeePerGas = maxPriorityFeePerGas > 0n ? maxPriorityFeePerGas : fallbackPriorityFee
  const baseFeePerGas = latestBlock.baseFeePerGas
  const feeParams = baseFeePerGas != null
    ? {
        maxPriorityFeePerGas: priorityFeePerGas,
        maxFeePerGas: baseFeePerGas * 2n + priorityFeePerGas + 1_000_000n,
      }
    : { gasPrice: await publicClient.getGasPrice() }

  const hash = await walletClient.writeContract({
    account: walletClient.account,
    address: promptKeyStoreAddress,
    abi: [
      {
        inputs: [
          { name: 'jobId', type: 'bytes32' },
          { name: 'encHigh', type: 'tuple', components: [{ name: 'ctHash', type: 'uint256' }, { name: 'securityZone', type: 'uint8' }, { name: 'utype', type: 'uint8' }, { name: 'signature', type: 'bytes' }] },
          { name: 'encLow', type: 'tuple', components: [{ name: 'ctHash', type: 'uint256' }, { name: 'securityZone', type: 'uint8' }, { name: 'utype', type: 'uint8' }, { name: 'signature', type: 'bytes' }] },
          { name: 'allowedNodes', type: 'address[]' },
        ],
        name: 'storeKey',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
    ],
    functionName: 'storeKey',
    args: [
      taskId,
      toContractInput(highInput),
      toContractInput(lowInput),
      allowedNodes,
    ],
    ...feeParams,
  })

  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') {
    throw new Error(`PromptKeyStore transaction failed for task ${taskId}`)
  }
  return hash
}

async function waitForJobCompletion(jobId, baseUrl) {
  const deadline = Date.now() + 5 * 60_000  // 5 minutes
  while (Date.now() < deadline) {
    const response = await fetch(`${baseUrl}/v1/jobs/${jobId}`)
    if (!response.ok) {
      throw new Error(`Payment Service status failed: ${response.status} ${await response.text()}`)
    }
    const payload = await response.json()
    if (payload.status === 'COMPLETED') return payload
    if (payload.status === 'FAILED' || payload.status === 'REFUNDED') return payload
    await sleep(3000)
  }
  throw new Error(`Timed out waiting for job ${jobId} to complete`)
}

async function uploadToIpfs(bytes, jwt) {
  const formData = new FormData()
  formData.append('file', new Blob([bytes]), 'blindference-text-prompt.bin')
  formData.append('network', 'public')
  formData.append('name', 'blindference-text-prompt.bin')

  const response = await fetch('https://uploads.pinata.cloud/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
    body: formData,
  })
  if (!response.ok) {
    throw new Error(`IPFS upload failed: ${response.status} ${await response.text()}`)
  }
  const payload = await response.json()
  if (!payload?.data?.cid) throw new Error(`Unexpected Pinata response: ${JSON.stringify(payload)}`)
  return payload.data.cid
}

async function downloadAndDecrypt(cid, key) {
  const response = await fetch(`${gatewayBaseUrl}/${cid}`)
  if (!response.ok) {
    throw new Error(`IPFS download failed: ${response.status} ${response.statusText}`)
  }
  const packed = new Uint8Array(await response.arrayBuffer())
  if (packed.byteLength < 28) {
    throw new Error('Encrypted output payload is too short')
  }
  const iv = packed.subarray(0, 12)
  const authTag = packed.subarray(12, 28)
  const ciphertext = packed.subarray(28)
  const combined = Buffer.concat([Buffer.from(ciphertext), Buffer.from(authTag)])
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(Buffer.from(authTag))
  const plaintext = Buffer.concat([decipher.update(combined.subarray(0, combined.length - 16)), decipher.final()])
  return plaintext.toString('utf8')
}

async function encryptText(text, key) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return { iv, authTag, ciphertext }
}

function packPayload({ iv, authTag, ciphertext }) {
  return Buffer.concat([iv, authTag, ciphertext])
}

function serializeEncryptedInput(input) {
  return {
    ctHash: input.ctHash.toString(),
    securityZone: input.securityZone,
    utype: Number(input.utype),
    signature: input.signature,
  }
}

function bytesToBigInt(bytes) {
  let value = 0n
  for (const byte of bytes) value = (value << 8n) | BigInt(byte)
  return value
}

function combineHalves(high, low) {
  const output = Buffer.alloc(32)
  writeHalf(high, output, 0)
  writeHalf(low, output, 16)
  return output
}

function writeHalf(value, output, offset) {
  let remaining = BigInt(value)
  for (let i = 15; i >= 0; i -= 1) {
    output[offset + i] = Number(remaining & 0xffn)
    remaining >>= 8n
  }
}

function normalizePrivateKey(value) {
  const normalized = String(value).trim().replace(/^['"]|['"]$/g, '')
  if (!normalized) throw new Error('Missing private key for smoke test')
  return normalized.startsWith('0x') ? normalized : `0x${normalized}`
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
