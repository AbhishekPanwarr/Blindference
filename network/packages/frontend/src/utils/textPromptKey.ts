import { Encryptable, FheTypes, type CofheClient, type EncryptedItemInput } from '../lib/cofhe'

// Patterns that indicate a transient CoFHE fetch error worth retrying.
const COFHE_FETCH_ERROR_PATTERNS = [
  'Failed to fetch',
  'Failed to fetch FHE key and CRS',
  'Error serializing FHE publicKey',
  'Error serializing CRS',
  'NetworkError',
]

type SerializedEncryptedInput = {
  ctHash: string
  securityZone: number
  utype: number
  signature: string
}

export type EncryptedPromptKeyPayload = {
  encryptedPromptKey: {
    high: string
    low: string
  }
  metadata: {
    cofhe_prompt_key_inputs: {
      high: SerializedEncryptedInput
      low: SerializedEncryptedInput
    }
  }
}

function isCofheFetchError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return COFHE_FETCH_ERROR_PATTERNS.some((p) => msg.includes(p))
}

export async function encryptPromptKeyForTextRequest(
  client: CofheClient,
  promptKey: Uint8Array,
): Promise<EncryptedPromptKeyPayload> {
  if (promptKey.byteLength !== 32) {
    throw new Error(`Prompt key must be 32 bytes, received ${promptKey.byteLength}`)
  }

  const high = bigintFromBytes(promptKey.subarray(0, 16))
  const low = bigintFromBytes(promptKey.subarray(16, 32))

  let highInput: EncryptedItemInput
  let lowInput: EncryptedItemInput

  try {
    const result = await client
      .encryptInputs([Encryptable.uint128(high), Encryptable.uint128(low)])
      .execute()
    highInput = result[0]
    lowInput = result[1]
  } catch (firstErr) {
    if (!isCofheFetchError(firstErr)) throw firstErr

    // Transient fetch error — try once more. The fresh client will
    // re-fetch the FHE public key + CRS without any stale cache.
    console.warn('[CoFHE] Encrypt failed with fetch error, retrying once:', firstErr)
    const result = await client
      .encryptInputs([Encryptable.uint128(high), Encryptable.uint128(low)])
      .execute()
    highInput = result[0]
    lowInput = result[1]
  }

  return {
    encryptedPromptKey: {
      high: highInput.ctHash.toString(),
      low: lowInput.ctHash.toString(),
    },
    metadata: {
      cofhe_prompt_key_inputs: {
        high: serializeEncryptedInput(highInput),
        low: serializeEncryptedInput(lowInput),
      },
    },
  }
}

export async function decryptOutputKey(
  client: CofheClient,
  highHandle: string,
  lowHandle: string,
): Promise<Uint8Array> {
  let permit = await client.permits.getOrCreateSelfPermit()

  // getOrCreateSelfPermit returns the active permit even if it is expired,
  // because the SDK only checks `type === 'self'`.  If the stored permit
  // has expired, remove it and create a fresh one.
  const nowSec = Math.floor(Date.now() / 1000)
  if (permit.expiration < nowSec) {
    await client.permits.removeActivePermit()
    permit = await client.permits.getOrCreateSelfPermit()
  }

  const high = await client.decryptForView(BigInt(highHandle), FheTypes.Uint128).withPermit(permit).execute()
  const low = await client.decryptForView(BigInt(lowHandle), FheTypes.Uint128).withPermit(permit).execute()
  return combineKeyHalves(high, low)
}

export async function downloadAndDecryptTextOutput(
  outputCid: string,
  key: Uint8Array,
): Promise<string> {
  const gatewayBaseUrl = (import.meta.env.VITE_IPFS_GATEWAY_URL || 'https://gateway.pinata.cloud/ipfs').replace(/\/$/, '')
  const response = await fetch(`${gatewayBaseUrl}/${outputCid}`)
  if (!response.ok) {
    throw new Error(`Failed to download encrypted output from IPFS: ${response.statusText}`)
  }

  const packed = new Uint8Array(await response.arrayBuffer())
  if (packed.byteLength < 32) {
    throw new Error('Encrypted output payload is too short')
  }

  const iv = packed.subarray(0, 16)
  const authTag = packed.subarray(16, 32)
  const ciphertext = packed.subarray(32)
  const cipherWithTag = new Uint8Array(ciphertext.length + authTag.length)
  cipherWithTag.set(ciphertext)
  cipherWithTag.set(authTag, ciphertext.length)

  const cryptoKey = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['decrypt'])
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    cryptoKey,
    cipherWithTag,
  )

  return new TextDecoder().decode(plaintext)
}

function serializeEncryptedInput(input: EncryptedItemInput): SerializedEncryptedInput {
  return {
    ctHash: input.ctHash.toString(),
    securityZone: input.securityZone,
    utype: Number(input.utype),
    signature: input.signature,
  }
}

function bigintFromBytes(bytes: Uint8Array): bigint {
  let value = 0n
  for (const byte of bytes) {
    value = (value << 8n) | BigInt(byte)
  }
  return value
}

function combineKeyHalves(high: bigint, low: bigint): Uint8Array {
  const output = new Uint8Array(32)
  writeBigIntToBytes(high, output, 0)
  writeBigIntToBytes(low, output, 16)
  return output
}

function writeBigIntToBytes(value: bigint, output: Uint8Array, offset: number) {
  let remaining = value
  for (let index = 15; index >= 0; index -= 1) {
    output[offset + index] = Number(remaining & 0xffn)
    remaining >>= 8n
  }
}
