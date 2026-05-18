# Blindference Frontend — Architecture & Component Map

## Tech Stack

- **React 19** + **TypeScript**
- **Vite 6** — bundler
- **wagmi** + **viem** — wallet connection + chain interaction
- **@cofhe/sdk@0.5.2** — Fhenix CoFHE encryption/decryption
- **TailwindCSS** + **shadcn/ui** — styling
- **Framer Motion** — animations
- **TanStack Router** — routing

## Route Structure

```
/                       → HomePage (landing)
/inference/new          → InferenceNewPage (create job)
/inference/:requestId   → InferenceStatusPage (track job)
```

## Key Components

### 1. TextInferenceWizard (`components/inference/TextInferenceWizard.tsx`)

The main text submission flow. ~430 lines.

**States:** `idle → encrypting → uploading → submitting`

**Data flow:**
```
User enters prompt
  → AES-256-GCM encrypt prompt
  → Upload encrypted blob to ICL (Pinata)
  → CoFHE-encrypt AES key halves via @cofhe/sdk
  → Store key halves on-chain via PromptKeyStore.storeKey()
  → Submit to ICL
  → Navigate to status page
```

**Sub-components needed:**
- `PromptInput` — textarea with encryption awareness
- `ModelSelector` — dropdown with model options (local + cloud)
- `AdvancedSection` — collapsible escrow ID input
- `SubmitButton` — with loading states
- `ErrorBanner` — inline error display

### 2. CoFHE Client Hook (`hooks/useCofheClient.ts`)

Manages the CoFHE SDK lifecycle:
- `isReady` — SDK connected and FHE key cached
- `client` — CofheClient instance (null until connected)
- `error` — initialization errors
- `retry()` — manual reconnection trigger

### 3. Wallet Connection (`lib/wagmi.ts`)

wagmi config with:
- Arbitrum Sepolia (421614) as primary chain
- Hardhat (31337) for local development
- Injected + WalletConnect connectors

### 4. API Client (`api/inferenceApi.ts`)

Typed endpoints:
- `submitText()` → POST /v1/inference/requests
- `getQuorumPreview()` → GET /v1/inference/quorum-preview
- `uploadPromptBlob()` → POST /v1/inference/upload-prompt
- `getStatus()` → GET /v1/inference/{requestId}

### 5. Encryption Pipeline

```
utils/textPromptKey.ts:
  - encryptPromptKeyForTextRequest() → CoFHE SDK encryptInputs
  - decryptPromptKeyForTextRequest() → CoFHE SDK decryptForView

lib/promptKeyStore.ts:
  - storePromptKeyForTextRequest() → walletClient.writeContract to PromptKeyStore
```

### 6. Status Page (`pages/InferenceStatusPage.tsx`)

Polls ICL for job status. Displays:
- Quorum assignment (leader + verifier addresses)
- Verifier verdicts (confirm/reject)
- Output CID + commitment hash
- Encrypted output key (for user decryption)
- Chain transaction hash

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `VITE_ICL_BASE_URL` | ✅ | ICL API base URL |
| `VITE_ARBITRUM_SEPOLIA_RPC_URL` | ✅ | Arb Sepolia RPC for viem |
| `VITE_CHAIN_ID` | ✅ | Chain ID (421614) |
| `VITE_PROMPT_KEY_STORE_ADDRESS` | ✅ | Deployed PromptKeyStore |
| `VITE_COFHE_MOCK` | ❌ | (removed — always uses real CoFHE) |
| `VITE_WALLET_CONNECT_PROJECT_ID` | ❌ | WalletConnect ID |
| `VITE_IPFS_GATEWAY_URL` | ❌ | IPFS gateway for downloads |

## CoFHE Initialization

`useCofheClient` connects to the Fhenix CoFHE coprocessor via `@cofhe/sdk/web`.
- `isReady` indicates the SDK has connected and cached the FHE public key
- `error` surfaces initialization failures (wrong chain, network issues)
- `retry()` allows manual reconnection attempts
