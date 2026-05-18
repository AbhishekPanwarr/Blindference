import crypto from 'node:crypto'

import { createCofheClient, createCofheConfig } from '@cofhe/sdk/node'
import { Encryptable, FheTypes } from '@cofhe/sdk'
import { chains } from '@cofhe/sdk/chains'
import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { arbitrumSepolia } from 'viem/chains'

const prompt = process.argv.slice(2).join(' ').trim() || 'What are the key benefits of FHE?'
const rpcUrl = process.env.COFHE_RPC_URL || process.env.ARBITRUM_SEPOLIA_RPC
const iclBaseUrl = process.env.ICL_BASE_URL || 'http://127.0.0.1:8000'
const pinataJwt = process.env.PINATA_JWT
const gatewayBaseUrl = (process.env.PINATA_GATEWAY_URL || 'https://gateway.pinata.cloud/ipfs').replace(/\/$/, '')
const privateKey = normalizePrivateKey(process.env.ICL_PRIVATE_KEY || process.env.PRIVATE_KEY || '')
const modelId = process.env.TEXT_MODEL_ID || 'groq:llama-3.3-70b-versatile'

if (!rpcUrl) throw new Error('Missing COFHE_RPC_URL or ARBITRUM_SEPOLIA_RPC')
if (!pinataJwt) throw new Error('Missing PINATA_JWT')

const account = privateKeyToAccount(privateKey)
const config = createCofheConfig({ supportedChains: [chains.arbSepolia] })
const cofheClient = createCofheClient(config)
const publicClient = createPublicClient({ chain: arbitrumSepolia, transport: http(rpcUrl) })
const walletClient = createWalletClient({ account, chain: arbitrumSepolia, transport: http(rpcUrl) })
await cofheClient.connect(publicClient, walletClient)

const promptKey = crypto.randomBytes(32)
const encryptedPrompt = await encryptText(prompt, promptKey)
const packedPrompt = packPayload(encryptedPrompt)
const promptCid = await uploadToIpfs(packedPrompt, pinataJwt)

const highHalf = bytesToBigInt(promptKey.subarray(0, 16))
const lowHalf = bytesToBigInt(promptKey.subarray(16, 32))
const [highInput, lowInput] = await cofheClient
  .encryptInputs([
    Encryptable.uint128(highHalf),
    Encryptable.uint128(lowHalf),
  ])
  .execute()

const createResponse = await fetch(`${iclBaseUrl}/v1/inference/requests`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    developer_address: account.address,
    mode: 'text',
    model_id: modelId,
    text_request: {
      prompt_cid: promptCid,
      encrypted_prompt_key: {
        high: highInput.ctHash.toString(),
        low: lowInput.ctHash.toString(),
      },
      model_id: modelId,
      coverage_enabled: false,
    },
    min_tier: 1,
    zdr_required: false,
    verifier_count: 2,
    metadata: {
      cofhe_prompt_key_inputs: {
        high: serializeEncryptedInput(highInput),
        low: serializeEncryptedInput(lowInput),
      },
      prompt_length: prompt.length,
      vertical: 'blindference-text-demo',
    },
  }),
})

if (!createResponse.ok) {
  throw new Error(`ICL create failed: ${createResponse.status} ${await createResponse.text()}`)
}

const created = await createResponse.json()
const jobId = created.job_id || created.request_id
if (!jobId) throw new Error(`ICL did not return a job id: ${JSON.stringify(created)}`)

console.log(JSON.stringify({ step: 'submitted', jobId, promptCid, developer: account.address }, null, 2))

const status = await waitForAccepted(jobId, iclBaseUrl)
console.log(JSON.stringify({ step: 'accepted', status }, null, 2))

const permit = await cofheClient.permits.getOrCreateSelfPermit(undefined, account.address, {
  issuer: account.address,
  name: 'Blindference Output Key Permit',
})

const decryptedHigh = await cofheClient
  .decryptForView(BigInt(status.encrypted_output_key_high), FheTypes.Uint128)
  .withPermit(permit)
  .execute()
const decryptedLow = await cofheClient
  .decryptForView(BigInt(status.encrypted_output_key_low), FheTypes.Uint128)
  .withPermit(permit)
  .execute()

const outputKey = combineHalves(decryptedHigh, decryptedLow)
const outputText = await downloadAndDecrypt(status.output_cid, outputKey)
console.log(JSON.stringify({ step: 'decrypted', outputText }, null, 2))

async function waitForAccepted(jobId, iclBaseUrl) {
  const deadline = Date.now() + 3 * 60_000
  while (Date.now() < deadline) {
    const response = await fetch(`${iclBaseUrl}/v1/inference/${jobId}`)
    if (!response.ok) {
      throw new Error(`ICL status failed: ${response.status} ${await response.text()}`)
    }
    const payload = await response.json()
    if (payload.status === 'ACCEPTED') return payload
    if (payload.status === 'REJECTED' || payload.status === 'TIMEDOUT' || payload.status === 'DISPUTED') {
      throw new Error(`Job ${jobId} ended in status ${payload.status}: ${JSON.stringify(payload)}`)
    }
    await sleep(3000)
  }
  throw new Error(`Timed out waiting for job ${jobId} to reach ACCEPTED`)
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
  const iv = packed.subarray(0, 16)
  const authTag = packed.subarray(16, 32)
  const ciphertext = packed.subarray(32)
  const combined = Buffer.concat([Buffer.from(ciphertext), Buffer.from(authTag)])
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(Buffer.from(authTag))
  const plaintext = Buffer.concat([decipher.update(combined.subarray(0, combined.length - 16)), decipher.final()])
  return plaintext.toString('utf8')
}

async function encryptText(text, key) {
  const iv = crypto.randomBytes(16)
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
