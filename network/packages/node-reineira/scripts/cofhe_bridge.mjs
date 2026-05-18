import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

installLocalStorageShim()

const [{ createCofheClient, createCofheConfig }, { Encryptable, FheTypes }, { chains }, { PermitUtils }, { createPublicClient, createWalletClient, http, parseAbi }, { privateKeyToAccount }, { arbitrumSepolia, hardhat }] = await Promise.all([
  import('@cofhe/sdk/node'),
  import('@cofhe/sdk'),
  import('@cofhe/sdk/chains'),
  import('@cofhe/sdk/permits'),
  import('viem'),
  import('viem/accounts'),
  import('viem/chains'),
])

const promptKeyStoreAbi = parseAbi([
  'function storeKey(bytes32 jobId, (uint256 ctHash, uint8 securityZone, uint8 utype, bytes signature) encHigh, (uint256 ctHash, uint8 securityZone, uint8 utype, bytes signature) encLow, address[] allowedNodes)',
])

function installLocalStorageShim() {
  if (globalThis.localStorage && typeof globalThis.localStorage.setItem === 'function') {
    return
  }

  const storageDir = path.join(process.env.HOME || os.homedir() || '.', '.blindference-cofhe')
  const storageFile = path.join(storageDir, 'localstorage.json')

  const readStore = () => {
    try {
      if (!fs.existsSync(storageFile)) return {}
      return JSON.parse(fs.readFileSync(storageFile, 'utf8'))
    } catch {
      return {}
    }
  }

  const writeStore = (data) => {
    fs.mkdirSync(storageDir, { recursive: true })
    fs.writeFileSync(storageFile, JSON.stringify(data))
  }

  globalThis.localStorage = {
    getItem(key) {
      const store = readStore()
      return key in store ? String(store[key]) : null
    },
    setItem(key, value) {
      const store = readStore()
      store[key] = String(value)
      writeStore(store)
    },
    removeItem(key) {
      const store = readStore()
      delete store[key]
      writeStore(store)
    },
    clear() {
      writeStore({})
    },
  }
}

function parseJsonInput() {
  return new Promise((resolve, reject) => {
    let source = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => {
      source += chunk
    })
    process.stdin.on('end', () => {
      try {
        resolve(JSON.parse(source || '{}'))
      } catch (error) {
        reject(error)
      }
    })
    process.stdin.on('error', reject)
  })
}

function resolveChains(chainId) {
  if (Number(chainId) === 31337) {
    return {
      cofheChain: chains.hardhat,
      viemChain: hardhat,
    }
  }

  return {
    cofheChain: chains.arbSepolia,
    viemChain: arbitrumSepolia,
  }
}

function resolveFheType(utype) {
  if (typeof utype === 'number') return utype

  const normalized = String(utype).toLowerCase()
  const mapping = {
    bool: FheTypes.Bool,
    uint8: FheTypes.Uint8,
    uint16: FheTypes.Uint16,
    uint32: FheTypes.Uint32,
    uint64: FheTypes.Uint64,
    uint128: FheTypes.Uint128,
    uint160: FheTypes.Uint160,
    address: FheTypes.Uint160,
  }

  if (!(normalized in mapping)) {
    throw new Error(`Unsupported FHE type: ${utype}`)
  }

  return mapping[normalized]
}

function normalizePrivateKey(privateKey) {
  let normalized = String(privateKey ?? '').trim().replace(/^['"]|['"]$/g, '')
  if (normalized.startsWith('0x') || normalized.startsWith('0X')) {
    normalized = normalized.slice(2)
  }
  if (!/^[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error(`Invalid operator private key format: expected 64 hex chars, got ${normalized.length}`)
  }
  return `0x${normalized.toLowerCase()}`
}

async function createClient({ rpcUrl, privateKey, chainId }) {
  const { cofheChain, viemChain } = resolveChains(chainId)
  const config = createCofheConfig({
    supportedChains: [cofheChain],
  })
  const client = createCofheClient(config)
  const normalizedPrivateKey = normalizePrivateKey(privateKey)
  const account = privateKeyToAccount(normalizedPrivateKey)
  const publicClient = createPublicClient({
    chain: viemChain,
    transport: http(rpcUrl),
  })
  const walletClient = createWalletClient({
    account,
    chain: viemChain,
    transport: http(rpcUrl),
  })

  await client.connect(publicClient, walletClient)
  return { client, publicClient, walletClient, account }
}

async function decryptForView(payload) {
  const { client, publicClient, walletClient } = await createClient(payload)
  if (!payload.permit) {
    throw new Error('Missing shared permit for decryption')
  }

  const recipientPermit = await client.permits.importShared(payload.permit, { publicClient, walletClient })
  const values = []

  try {
    for (const feature of payload.features ?? []) {
      const unsealed = await client
        .decryptForView(BigInt(feature.ctHash), resolveFheType(feature.utype))
        .withPermit(recipientPermit)
        .execute()
      values.push(unsealed.toString())
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('403')) {
      throw new Error(
        'Threshold network rejected decryptForView with HTTP 403. ' +
        'The sharing permit imported correctly, but the ciphertext still does not appear to ' +
        'have issuer ACL access on-chain. This request likely skipped BlindferenceInputVault, ' +
        'or the request was submitted before the vault transaction was mined.'
      )
    }
    throw error
  }

  return { values }
}

async function decryptPromptKey(payload) {
  const { client, publicClient, walletClient, account } = await createClient(payload)
  const permit = await client.permits.getOrCreateSelfPermit(undefined, account.address, {
    issuer: account.address,
    name: payload.permitName || 'Blindference Prompt Key Permit',
  })

  const high = await client
    .decryptForView(BigInt(payload.highHandle), FheTypes.Uint128)
    .withPermit(permit)
    .execute()
  const low = await client
    .decryptForView(BigInt(payload.lowHandle), FheTypes.Uint128)
    .withPermit(permit)
    .execute()

  return {
    high: high.toString(),
    low: low.toString(),
    permitHash: permit.hash,
  }
}

async function encryptUint128(payload) {
  const { client } = await createClient(payload)
  const values = Array.isArray(payload.values) ? payload.values : []
  const encrypted = await client
    .encryptInputs(values.map((value) => Encryptable.uint128(BigInt(value))))
    .execute()

  return {
    results: encrypted.map((item) => ({
      ctHash: item.ctHash.toString(),
      securityZone: item.securityZone,
      utype: Number(item.utype),
      signature: item.signature,
    })),
  }
}

async function createSharingPermit(payload) {
  const { client, publicClient, walletClient, account } = await createClient(payload)
  const permit = await client.permits.createSharing(
    {
      issuer: payload.issuer || account.address,
      recipient: payload.recipient,
      name: payload.name || 'Blindference Shared Permit',
    },
    { publicClient, walletClient },
  )

  return {
    permit: PermitUtils.export(permit),
  }
}

async function storePromptKey(payload) {
  const { publicClient, walletClient } = await createClient(payload)
  const latestBlock = await publicClient.getBlock({ blockTag: 'latest' })
  const fallbackPriorityFeePerGas = 2_000_000n
  const maxPriorityFeePerGas = await publicClient
    .estimateMaxPriorityFeePerGas()
    .catch(() => fallbackPriorityFeePerGas)
  const priorityFeePerGas = maxPriorityFeePerGas > 0n ? maxPriorityFeePerGas : fallbackPriorityFeePerGas
  const baseFeePerGas = latestBlock.baseFeePerGas
  const feeParams =
    baseFeePerGas != null
      ? {
          maxPriorityFeePerGas: priorityFeePerGas,
          maxFeePerGas: baseFeePerGas * 2n + priorityFeePerGas + 1_000_000n,
        }
      : {
          gasPrice: await publicClient.getGasPrice(),
        }

  const txHash = await walletClient.writeContract({
    account: walletClient.account,
    address: payload.promptKeyStoreAddress,
    abi: promptKeyStoreAbi,
    chain: walletClient.chain,
    functionName: 'storeKey',
    args: [
      payload.taskId,
      toContractInput(payload.encryptedHighInput),
      toContractInput(payload.encryptedLowInput),
      payload.allowedNodes,
    ],
    ...feeParams,
  })

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
  if (receipt.status !== 'success') {
    throw new Error(`PromptKeyStore transaction failed for task ${payload.taskId}`)
  }

  return { txHash }
}

function toContractInput(input) {
  return {
    ctHash: BigInt(input.ctHash),
    securityZone: Number(input.securityZone ?? 0),
    utype: Number(input.utype),
    signature: input.signature,
  }
}

async function main() {
  try {
    const payload = await parseJsonInput()
    let result

    switch (payload.action) {
      case 'decrypt_for_view':
        result = await decryptForView(payload)
        break
      case 'create_sharing_permit':
        result = await createSharingPermit(payload)
        break
      case 'decrypt_prompt_key':
        result = await decryptPromptKey(payload)
        break
      case 'encrypt_uint128':
        result = await encryptUint128(payload)
        break
      case 'store_prompt_key':
        result = await storePromptKey(payload)
        break
      default:
        throw new Error(`Unsupported action: ${payload.action}`)
    }

    process.stdout.write(`${JSON.stringify({ ok: true, ...result })}\n`)
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`)
    process.stdout.write(`${JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) })}\n`)
    process.exitCode = 1
  }
}

await main()
