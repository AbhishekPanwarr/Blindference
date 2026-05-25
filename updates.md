# Blindference Updates

This document tracks major releases and architectural changes to the Blindference protocol.

## Latest Release — Phase 5 (Payment Service Gateway)

### Phase 1 — Payment Service Gateway Architecture

The frontend no longer submits inference requests directly to the ICL. The **Payment Service** is now the single gateway:

- **Frontend** → `POST /v1/jobs/submit` → **Payment Service** validates credits, deducts balance, creates on-chain escrow, purchases insurance, then forwards to ICL
- **ICL** runs quorum inference, then calls `POST /v1/jobs/{id}/complete` back to Payment Service
- **Payment Service** distributes BLIND rewards on success, refunds credits on failure/timeout
- Job state machine: `PENDING_PAYMENT` → `RUNNING` → `COMPLETED` | `FAILED` | `REFUNDED`
- ICL internal endpoint `POST /v1/inference/request` — no payment fields, constructs request internally
- Old public payment endpoints removed: `/v1/deduct`, `/v1/escrow/create`, `/v1/insurance/purchase`, `/v1/rewards/distribute`

### Phase 2 — ICL Cleanup

- Removed `payment_mode`, `payment_currency`, `insurance_opt_in` from `InferenceRequestCreate`
- Removed old payment logic and `_distribute_reward()` from `quorum_service.py`
- Removed `TextInferenceRequestPayload` and `submitText()` from frontend API
- Updated `TextInferenceWizard.tsx` to use `jobApi.submit()`

### Phase 3 — Integration Testing

Discovered and fixed 5 integration bugs:
1. Decimal128 negation crash (`-amount_dec` fails on `Decimal128` objects)
2. Missing `logger` in ICL internal endpoint
3. Missing `metadata` passthrough lost `cofhe_prompt_key_inputs`
4. Missing `pending_store_key` status in `InferenceRequestResponse` Literal
5. Task ID mismatch — frontend vs Payment Service UUID generation. Added `task_id` to `JobSubmitRequest`
- Created `smoke-gateway-flow.mjs` for Payment Service E2E testing
- **Blocked**: Fhenix CoFHE testnet (`api.helios.fhenix.zone`) returns `ENOTFOUND`

### Phase 4 — Node CLI: Jobs & Earnings

- `payment/routers/nodes.py`: New `GET /v1/nodes/{address}/jobs?limit=20` endpoint for operator earnings history
- `JobRecord.rewards`: Per-node reward map (60% leader, 20% each verifier)
- `Blindference-node/cli.py`: New `jobs list` and `jobs claim` commands
- `Blindference-node/config.py`: Added `payment_service_url` field
- Node CLI uses local directory for config/keystore (not global `~/.blindference`)
- Receipt.status validation added to `registry.py`; fixed all 11 transaction functions
- Node attestation fix: real `NodeRegistry.updateAttestation()` call with 32-byte cert_hash padding
- Frontend gas estimation: EIP-1559 dynamic gas estimation on `BuyCreditsPage.tsx`
- `PAYMENT_TEST_GUIDE.md`: Comprehensive testing guide created

### Contract Deployments (Arbitrum Sepolia)

| Contract | Address | Purpose |
|----------|---------|---------|
| PromptKeyStore | `0x1E22dD12f448B15f1Ca8560fB6B4463834FaAf73` | Text inference key storage |
| ResultRegistry | `0xCebd831eCd00915E299b8Ef2666cAbf942dc7150` | On-chain result commitment |
| NodeAttestationRegistry | `0xB54e019e9717a8Ed4746bA9d7F1A3F83cf0a35E0` | Operator attestation |
| ExecutionCommitmentRegistry | `0xcd45aefE9a16772528fa30B7d47958a95e83440C` | Task dispatch |
| ReputationRegistry | `0xdaDb4D46D231d3fe6D3754E0861c8bCD36aF0604` | Operator scoring |
| AgentConfigRegistry | `0x85aE035d6a94c006B5d0808cAdF47F5c22536996` | Model configuration |
| RewardAccumulator | `0xFa25Fb53eF8dAc88E4f43bB7558Cf3930Bf3e817` | Reward distribution |
| BlindferenceInputVault | `0x8dD7B2A9B69C76A69d33B2DF46426Cbe657a902b` | CoFHE ACL input vault |

### Bug Fixes

- **ICL in-memory DB**: Full MongoDB operator support (`$or`, `$in`, `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`)
- **Assignment dispatch**: `_get_pending_assignments()` returns `task_id` for correct node lookups
- **Pydantic model handling**: `get_assignments()` uses `getattr()` instead of `.get()` on Pydantic objects
- **Hex handle parsing**: `claim_task` handles `0x`-prefixed hex strings with `int(val, 16)`
- **ICL quorum preview**: Returns proper leader/verifier addresses when operators are active
- **Node CoFHE default**: `get_cofhe_client()` defaults to `CoFHEBridgeClient`, mock mode fully removed
- **Frontend mock removal**: `MockCoFHEClient` class deleted, all code paths use real CoFHE
- **Vite optimizeDeps**: Only `tfhe` excluded; `@cofhe/sdk` pre-bundled for CJS interop
- **TFHE WASM**: Absolute path `/node_modules/tfhe/tfhe_bg.wasm?url` survives cache invalidation

### Technical Decisions

- `blindference-node` PyPI package: standalone distribution for operator onboarding
- Mintlify over Docusaurus: better dark mode default, built-in search, modern components
- Docs split into **Compute** (node operators) and **Build** (agent developers): two distinct audiences
- `HEARTBEAT_GRACE_SECONDS: 300`: balances ICL restart resilience vs stale-node detection
- Node CoFHE mode `bridge` (TypeScript subprocess) is default; `python` (direct HTTP) is alternative
- `fheKeyStorage: null` prevents stale IndexedDB cache serialization errors
- `environment: 'MOCK'` on chain config: local ZK proof verification only (ciphertexts are real FHE)

### What's Left

The protocol components are in active development and may experience breaking changes as the system evolves:

- **Mintlify deployment**: Connect `blindference/docs/` to dashboard.mintlify.com with custom domain `docs.blindference.xyz`
- **PyPI token setup**: Add `PYPI_API_TOKEN` secret to GitHub repo, tag `v0.3.0` to trigger publish
- **Production quorum**: Full end-to-end test through result commitment and settlement (blocked by Alchemy rate limiting on free tier — needs dedicated API keys)
- **Frontend Vercel deploy**: Update `VITE_ICL_BASE_URL` for production ICL endpoint
- **Node operator onboarding**: Test `pip install blindference-node` flow on clean machine

---

## Previous Releases

### Wave 3 — CoFHE SDK Alignment & Text Inference

#### Major Changes

##### 1. Confidential Text Inference Pipeline (New)

- Browser-side AES-256 encryption: User prompts encrypted locally before leaving the device
- Pinata/IPFS blob storage: Encrypted prompts stored off-chain, only ciphertext handles on-chain
- CoFHE key access control: AES key split into uint128 halves, each half CoFHE-encrypted and stored in `PromptKeyStore`
- Quorum decryption: Leader + 2 verifiers each receive CoFHE sharing permits to decrypt their key half
- Model inference: Nodes run identical inference via Groq Llama 3 or Google Gemini
- Output key escrow: Leader stores output AES key in PromptKeyStore for user-only decryption
- Frontend reveal: User decrypts output key via CoFHE and reveals the generated text

##### 2. CoFHE SDK Alignment

Updated to `@cofhe/sdk@0.5.1` with critical fixes:

- `fheKeyStorage: null` in SDK config to prevent stale IndexedDB cache serialization errors
- `environment: 'MOCK'` on chain config enables local ZK proof verification (ciphertexts are real FHE)
- `useWorkers: false` — ZK proof generation runs on main thread (Web Workers broken in Vite dev)
- Absolute WASM URL path `/node_modules/tfhe/tfhe_bg.wasm?url` survives cache invalidation
- Vite `optimizeDeps` excludes only `tfhe`, pre-bundles `@cofhe/sdk` normally for CJS interop

##### 3. Node Auto-Re-Attestation

- Auto-detect missing/expired attestation certificates on startup
- Automatically re-attest via ICL challenge/response
- Watchdog re-attests within 6 hours of expiry
- No CLI flag needed — default behavior

##### 4. ICL Persistence and Resilience

- MongoDB Atlas integration for persistent operator records
- `HEARTBEAT_GRACE_SECONDS: 300` (5 min) — ICL can restart without losing active nodes
- In-memory fallback when MongoDB unavailable (local development)
- Fixed in-memory database query operators (`$or`, `$in`, array membership)

##### 5. Professional Documentation

- Removed all "Wave 2" / "Wave 3" branding from code and documentation
- Renamed `wave2_network/` monorepo directory to `network/`
- Comprehensive README, ARCHITECTURE.md, DEPLOYMENT.md
- This updates.md changelog file

#### Contract Deployments (Arbitrum Sepolia)

| Contract | Address | Added |
|----------|---------|-------|
| PromptKeyStore | `0x1E22dD12f448B15f1Ca8560fB6B4463834FaAf73` | Text inference key storage |
| ResultRegistry | `0xCebd831eCd00915E299b8Ef2666cAbf942dc7150` | On-chain result commitment |
| NodeAttestationRegistry | `0xB54e019e9717a8Ed4746bA9d7F1A3F83cf0a35E0` | Operator attestation |
| ExecutionCommitmentRegistry | `0xcd45aefE9a16772528fa30B7d47958a95e83440C` | Task dispatch |
| ReputationRegistry | `0xdaDb4D46D231d3fe6D3754E0861c8bCD36aF0604` | Operator scoring |
| AgentConfigRegistry | `0x85aE035d6a94c006B5d0808cAdF47F5c22536996` | Model configuration |
| RewardAccumulator | `0xFa25Fb53eF8dAc88E4f43bB7558Cf3930Bf3e817` | Reward distribution |

#### Bug Fixes

- **ICL in-memory DB**: `_matches()` now supports MongoDB operators (`$or`, `$in`, `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`) and array membership queries
- **Assignment dispatch**: `_get_pending_assignments()` returns `task_id` (not `request_id`) so node lookups succeed
- **Pydantic model handling**: `get_assignments()` uses `getattr()` for Pydantic models instead of `.get()` which fails on objects
- **Hex handle parsing**: `claim_task` now parses `0x`-prefixed hex strings with `int(val, 16)` instead of `int(val)`
- **ICL quorum preview**: Returns proper leader/verifier addresses when operators are active
- **Node CoFHE default**: `get_cofhe_client()` defaults to `CoFHEBridgeClient`, mock mode fully removed
- **Frontend mock removal**: `MockCoFHEClient` class deleted, all code paths use real CoFHE

#### Technical Decisions

- `fheKeyStorage: null` over `environment: 'MOCK'` — prevents stale cache; real ZK proof still runs locally
- `storeKey` before `getQuorumPreview` — ensures MetaMask opens to prove CoFHE ciphertexts are valid
- Only `tfhe` excluded from Vite `optimizeDeps` — `@cofhe/sdk` must be pre-bundled for CJS deps
- `HEARTBEAT_GRACE_SECONDS: 300` — balances ICL restart resilience vs stale-node detection
- Node CoFHE mode `bridge` (TypeScript subprocess) is default; `python` (direct HTTP) is alternative

---

### Wave 2 — Initial Implementation

#### Text Inference Foundation

- Added browser-side AES-256 prompt encryption
- Added Pinata/IPFS encrypted blob storage
- Added `PromptKeyStore` contract for CoFHE-encrypted key halves
- Added node-side prompt key decryption under CoFHE ACL
- Added frontend text submission UI with Groq/Gemini model selection
- Added frontend output key decryption and answer reveal
- Added background demo stack scripts

#### Risk Scoring Foundation

- Initial confidential risk scoring pipeline
- Browser CoFHE feature encryption (credit score, loan amount, account age, defaults)
- Quorum consensus with 1 leader + 2 verifiers
- On-chain commitment and coverage via Reineira
- Multi-recipient sharing permit flow

#### Infrastructure Foundation

- Reineira protocol integration
- Fhenix CoFHE stack integration
- FastAPI ICL coordinator
- React/Vite frontend with wagmi wallet connection
- Node runtime with Groq/Gemini inference bridge
- Foundry contract suite with deployment scripts

#### 1. Confidential Text Inference Pipeline (New)

The biggest addition is a complete end-to-end confidential text generation flow:

- **Browser-side AES-256 encryption**: User prompts are encrypted locally before leaving the device
- **Pinata/IPFS blob storage**: Encrypted prompts stored off-chain, only ciphertext handles on-chain
- **CoFHE key access control**: AES key split into uint128 halves, each half CoFHE-encrypted and stored in `PromptKeyStore`
- **Quorum decryption**: Leader + 2 verifiers each receive CoFHE sharing permits to decrypt their key half
- **Model inference**: Nodes run identical inference via Groq Llama 3 or Google Gemini
- **Output key escrow**: Leader stores output AES key in PromptKeyStore for user-only decryption
- **Frontend reveal**: User decrypts output key via CoFHE and reveals the generated text

#### 2. CoFHE SDK Alignment

Updated to `@cofhe/sdk@0.5.1` with critical fixes:

- `fheKeyStorage: null` in SDK config to prevent stale IndexedDB cache serialization errors
- `environment: 'MOCK'` on chain config enables local ZK proof verification (ciphertexts are real FHE)
- `useWorkers: false` — ZK proof generation runs on main thread (Web Workers broken in Vite dev)
- Absolute WASM URL path `/node_modules/tfhe/tfhe_bg.wasm?url` survives cache invalidation
- Vite `optimizeDeps` excludes only `tfhe`, pre-bundles `@cofhe/sdk` normally for CJS interop

#### 3. Node Auto-Re-Attestation

Nodes now self-heal without manual intervention:

- Auto-detect missing/expired attestation certificates on startup
- Automatically re-attest via ICL challenge/response
- Watchdog re-attests within 6 hours of expiry
- No CLI flag needed — default behavior

#### 4. ICL Persistence and Resilience

- MongoDB Atlas integration for persistent operator records
- `HEARTBEAT_GRACE_SECONDS: 300` (5 min) — ICL can restart without losing active nodes
- In-memory fallback when MongoDB unavailable (local development)
- Fixed in-memory database query operators (`$or`, `$in`, array membership)

#### 5. Professional Documentation

- Removed all "Wave 2" / "Wave 3" branding from code and documentation
- Renamed `wave2_network/` monorepo directory to `network/`
- Comprehensive README, ARCHITECTURE.md, DEPLOYMENT.md
- This updates.md changelog file

### Contract Deployments (Arbitrum Sepolia)

| Contract | Address | Added |
|----------|---------|-------|
| PromptKeyStore | `0x1E22dD12f448B15f1Ca8560fB6B4463834FaAf73` | Text inference key storage |
| ResultRegistry | `0xCebd831eCd00915E299b8Ef2666cAbf942dc7150` | On-chain result commitment |
| NodeAttestationRegistry | `0xB54e019e9717a8Ed4746bA9d7F1A3F83cf0a35E0` | Operator attestation |
| ExecutionCommitmentRegistry | `0xcd45aefE9a16772528fa30B7d47958a95e83440C` | Task dispatch |
| ReputationRegistry | `0xdaDb4D46D231d3fe6D3754E0861c8bCD36aF0604` | Operator scoring |
| AgentConfigRegistry | `0x85aE035d6a94c006B5d0808cAdF47F5c22536996` | Model configuration |
| RewardAccumulator | `0xFa25Fb53eF8dAc88E4f43bB7558Cf3930Bf3e817` | Reward distribution |

### Bug Fixes

- **ICL in-memory DB**: `_matches()` now supports MongoDB operators (`$or`, `$in`, `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`) and array membership queries
- **Assignment dispatch**: `_get_pending_assignments()` returns `task_id` (not `request_id`) so node lookups succeed
- **Pydantic model handling**: `get_assignments()` uses `getattr()` for Pydantic models instead of `.get()` which fails on objects
- **Hex handle parsing**: `claim_task` now parses `0x`-prefixed hex strings with `int(val, 16)` instead of `int(val)`
- **ICL quorum preview**: Returns proper leader/verifier addresses when operators are active
- **Node CoFHE default**: `get_cofhe_client()` defaults to `CoFHEBridgeClient`, mock mode fully removed
- **Frontend mock removal**: `MockCoFHEClient` class deleted, all code paths use real CoFHE

### Technical Decisions

- `fheKeyStorage: null` over `environment: 'MOCK'` — prevents stale cache; real ZK proof still runs locally
- `storeKey` before `getQuorumPreview` — ensures MetaMask opens to prove CoFHE ciphertexts are valid
- Only `tfhe` excluded from Vite `optimizeDeps` — `@cofhe/sdk` must be pre-bundled for CJS deps
- `HEARTBEAT_GRACE_SECONDS: 300` — balances ICL restart resilience vs stale-node detection
- Node CoFHE mode `bridge` (TypeScript subprocess) is default; `python` (direct HTTP) is alternative

---

## Previous Releases

### Text Inference Foundation

- Added browser-side AES-256 prompt encryption
- Added Pinata/IPFS encrypted blob storage
- Added `PromptKeyStore` contract for CoFHE-encrypted key halves
- Added node-side prompt key decryption under CoFHE ACL
- Added frontend text submission UI with Groq/Gemini model selection
- Added frontend output key decryption and answer reveal
- Added background demo stack scripts

### Risk Scoring Foundation

- Initial confidential risk scoring pipeline
- Browser CoFHE feature encryption (credit score, loan amount, account age, defaults)
- Quorum consensus with 1 leader + 2 verifiers
- On-chain commitment and coverage via Reineira
- Multi-recipient sharing permit flow

### Infrastructure Foundation

- Reineira protocol integration
- Fhenix CoFHE stack integration
- FastAPI ICL coordinator
- React/Vite frontend with wagmi wallet connection
- Node runtime with Groq/Gemini inference bridge
- Foundry contract suite with deployment scripts
