# Blindference Payment Integration — Post-Mortem & Fix Report

> **Date**: 2026-05-25
> **Scope**: What broke when the Payment Service gateway was introduced, and exactly how to fix it.

---

## Executive Summary

The Payment Service gateway (Phase 1) introduced **three critical end-to-end breaking bugs** that prevent text inference from completing:

1. **Metadata is dropped by the Payment Service** → ICL falls into `pending_store_key` forever.
2. **Job ID mismatch between Payment Service and ICL** → completion callbacks always 404, jobs stuck in `RUNNING`.
3. **Frontend never calls `confirm-store-key`** in the new flow, and the ICL lacks `cofhe_prompt_key_inputs` due to (1).

Two additional bugs affect node operation and frontend type safety.

---

## How the Old System Worked (Pre-Payment)

### Architecture

```
Frontend ──▶ POST /v1/inference/requests ──▶ ICL ──▶ Nodes
                                               │
                                               ▼
                                         On-chain contracts
```

### Frontend Flow (Old)

1. **Encrypt prompt** locally (AES-256-GCM)
2. **Upload** encrypted blob to IPFS via `POST /v1/inference/upload-prompt`
3. **CoFHE-encrypt** AES key halves
4. **Call `PromptKeyStore.storeKey(taskId, ...)`** on-chain via MetaMask
5. **Submit to ICL** via `POST /v1/inference/requests` with:
   - `text_request.prompt_cid`
   - `text_request.encrypted_prompt_key {high, low}`
   - `metadata.prompt_key_store_tx` (the on-chain tx hash)
   - `metadata.cofhe_prompt_key_inputs {high, low}`
   - `task_id` (frontend-generated, matching the on-chain `storeKey` call)
6. **ICL creates request** with `status = "queued"`
7. If `storeKey` fails with `InvalidSigner` (expected), ICL sets `status = "pending_store_key"`
8. Frontend calls `POST /v1/inference/{request_id}/confirm-store-key` to transition back to `queued`
9. ICL dispatches to nodes, runs quorum, commits result
10. Frontend polls `GET /v1/inference/{request_id}` until `accepted`/`rejected`

### ICL Request Creation (Old)

In `quorum_service.py::_create_text_request()`:
- `task_id` = `payload.task_id` (from frontend) or keccak hash
- `metadata["text_request"]` = prompt CID + encrypted key halves
- `metadata["prompt_key_store_tx"]` = tx hash from frontend
- `metadata["cofhe_prompt_key_inputs"]` = original CoFHE ciphertext inputs
- `_resolve_text_prompt_key_inputs()` uses `metadata["cofhe_prompt_key_inputs"]` to build `keyInput`
- If `prompt_key_store_tx` exists, ICL trusts frontend already stored key on-chain
- If not, ICL attempts `store_text_prompt_key()` itself (usually fails with `InvalidSigner`)

---

## What Changed (Payment Service Gateway)

### New Architecture

```
Frontend ──▶ POST /v1/jobs/submit ──▶ Payment Service ──▶ POST /v1/inference/request ──▶ ICL
                                          │                                              │
                                          ▼                                              ▼
                                    Credits / Escrow / Insurance                    Callback on complete
```

### New Flow

1. Frontend encrypts prompt, uploads to IPFS, calls `storeKey` on-chain (same as old)
2. Frontend **submits to Payment Service** via `POST /v1/jobs/submit` with:
   - `task_id` (frontend-generated, for on-chain consistency)
   - `prompt_cid`, `encrypted_prompt_key_high/low`
   - `metadata` (including `prompt_key_store_tx`, `cofhe_prompt_key_inputs`, etc.)
   - `amount_credits`
3. Payment Service validates credits, deducts balance, creates escrow, purchases insurance
4. Payment Service **forwards to ICL** via `POST /v1/inference/request`
5. ICL creates internal `InferenceRequestCreate`, selects quorum, dispatches to nodes
6. ICL runs consensus, finalizes
7. ICL **calls back Payment Service** via `POST /v1/jobs/{job_id}/complete`
8. Payment Service distributes rewards or refunds credits
9. Frontend polls Payment Service for status

---

## Bug-by-Bug Breakdown

### Bug 1: Metadata is NOT forwarded to ICL (CRITICAL)

**File**: `network/packages/payment/services/job_service.py`
**Lines**: 144–158

```python
icl_payload = {
    "job_id": job_id,
    "developer_address": user_address,
    "prompt_cid": payload.prompt_cid,
    "model_id": model_id,
    "encrypted_prompt_key_high": payload.encrypted_prompt_key_high,
    "encrypted_prompt_key_low": payload.encrypted_prompt_key_low,
    "coverage_enabled": payload.insurance_opt_in,
    "permits": payload.permits,
    "min_tier": payload.min_tier,
    "zdr_required": payload.zdr_required,
    "verifier_count": payload.verifier_count,
}
if payload.task_id:
    icl_payload["task_id"] = payload.task_id
```

**Problem**: `metadata` is completely omitted. The frontend sends:

```json
{
  "metadata": {
    "cofhe_prompt_key_inputs": {"high": {...}, "low": {...}},
    "prompt_key_store_tx": "0xabc...",
    "prompt_key_store_status": "stored_by_user",
    "prompt_key_store_address": "0x1E22...",
    "vertical": "blindference-text-demo",
    ...
  }
}
```

None of this reaches the ICL.

**Impact in ICL** (`quorum_service.py::_create_text_request()`, lines 358–406):

```python
existing_prompt_key_store_tx = metadata.get("prompt_key_store_tx")
key_input = self._resolve_text_prompt_key_inputs(metadata, ...)
```

- `metadata` is `{}` → `existing_prompt_key_store_tx` is `None`
- `metadata.get("cofhe_prompt_key_inputs")` is `None`
- Unless `MOCK_CHAIN=true`, `_resolve_text_prompt_key_inputs()` raises `ValueError`
- ICL tries `store_text_prompt_key()` itself → `InvalidSigner` → status = `pending_store_key`
- No one calls `confirm-store-key` → job hangs forever

**Fix**: Add `metadata` to `icl_payload`:

```python
icl_payload = {
    ...,
    "metadata": payload.metadata,
}
```

---

### Bug 2: Job ID Mismatch — Callbacks Always 404 (CRITICAL)

**Files**:
- `network/packages/payment/services/job_service.py` line 40
- `network/packages/icl/services/quorum_service.py` line ~1860 (`_notify_payment_service`)
- `network/packages/payment/models/job_models.py`

**Payment Service generates**:
```python
job_id = str(uuid.uuid4())  # e.g. "550e8400-e29b-41d4-a716-446655440000"
```

**ICL generates**:
```python
request_id = str(uuid.uuid4())  # ICL internal UUID
task_id = payload.task_id or keccak_hash(...)  # Usually frontend's task_id
```

**ICL callback** (`_notify_payment_service`):
```python
job_id = document["task_id"]  # This is the task_id, NOT Payment Service's job_id
url = f"{PAYMENT_SERVICE_CALLBACK_URL}/v1/jobs/{job_id}/complete"
```

**Payment Service `complete_job()`**:
```python
job = await self.get_job(job_id)  # Looks up by Payment Service UUID
# But job_id here is ICL's task_id → 404
```

**Impact**: Job stays in `RUNNING` forever. Frontend polls forever. No rewards distributed, no refunds given.

**Fix**: Store `task_id` in `JobRecord` and look up by it as fallback.

In `job_models.py`:
```python
class JobRecord(BaseModel):
    ...
    task_id: str | None = None
```

In `job_service.py::submit_job()`:
```python
job_record = JobRecord(
    job_id=job_id,
    task_id=payload.task_id,
    ...
)
```

In `job_service.py::complete_job()`:
```python
async def complete_job(self, job_id: str, payload: JobCompletionRequest) -> dict[str, Any]:
    job = await self.get_job(job_id)
    if job is None:
        job = await self.database[JOBS].find_one({"task_id": job_id})
    if job is None:
        raise ValueError(f"Job {job_id} not found")
```

---

### Bug 3: Frontend Never Calls `confirm-store-key` (CRITICAL)

**File**: `network/packages/frontend/src/pages/InferenceNewPage.tsx`

In the old flow, after submitting to ICL and getting `request_id`, the frontend called:
```typescript
await inferenceApi.confirmStoreKey(requestId, { prompt_key_store_tx: txHash })
```

In the new flow, the frontend:
1. Generates `taskId` and calls `storeKey` on-chain
2. Submits to Payment Service via `jobApi.submit()`
3. **Never calls `confirm-store-key`**

Even with Bug 1 fixed (metadata forwarded), the ICL's `_create_text_request` still checks:
```python
if existing_prompt_key_store_tx:
    # Trust frontend, set status = "queued"
else:
    # Try ICL's own storeKey → InvalidSigner → pending_store_key
```

If `metadata.prompt_key_store_tx` is present, ICL transitions to `queued` directly. So fixing Bug 1 also fixes Bug 3 implicitly — the ICL sees the tx hash and trusts it.

**Alternative fix**: Have Payment Service call `confirm-store-key` on behalf of the frontend after forwarding to ICL. But forwarding metadata is simpler and sufficient.

---

### Bug 4: Missing `permit` in Node Assignment Response (MAJOR)

**File**: `network/packages/icl/routers/internal.py` lines 127–137

The `GET /internal/assignments/{addr}` response includes:
```python
{
    "jobId": task_id,
    "role": role,
    "modelId": model_id,
    "promptCid": prompt_cid,
    "kpHighHandle": ...,
    "kpLowHandle": ...,
    "deadline": ...,
    # "permit": ???  <-- MISSING
}
```

Nodes need the CoFHE sharing permit to decrypt prompt keys. In the old system, permits were either:
- Passed in the push payload (when ICL pushed to node callback URL)
- Retrieved from a permits endpoint

The current assignment response doesn't include `permit` at all. Nodes calling `claim_task` get key handles but no permit → CoFHE decryption fails with 403.

**Fix**: Include permit in assignment response:

```python
# In internal.py::get_assignments()
permit_doc = await services.database[PERMITS].find_one({"task_id": task_id})
permit = None
if permit_doc:
    for entry in permit_doc.get("permits", []):
        if entry.get("node_address") == node_address:
            permit = entry.get("permit_data")
            break

assignments.append({
    ...
    "permit": permit,
})
```

Or, if the old system passed permits in the push payload (not the assignment response), verify the node-side `icl_client.py` expects `permit` in the claim response:

```python
# In node/icl_client.py or Blindference-node/icl_client.py
claim_result = await icl.claim_task(job_id, node_address)
permit = claim_result.get("permit")  # Is this expected?
```

Check the old `node-reineira/server.py` push handler to see if `permit` was in the push payload.

---

### Bug 5: Frontend Type Definition Missing `failed` Status (MINOR)

**File**: `network/packages/frontend/src/api/inferenceApi.ts` line 118

```typescript
status: 'queued' | 'accepted' | 'rejected' | 'disputed'
```

Missing `'failed'` which the ICL now returns (for quorum timeout / all nodes failed).

**Fix**:
```typescript
status: 'queued' | 'accepted' | 'rejected' | 'disputed' | 'failed' | 'pending_store_key'
```

---

## Summary of All Changes Needed

### 1. Payment Service — Forward Metadata

**File**: `network/packages/payment/services/job_service.py`
**Line**: ~156
**Change**:
```python
icl_payload = {
    ...,
    "metadata": payload.metadata,
}
```

### 2. Payment Service — Store task_id in JobRecord

**File**: `network/packages/payment/models/job_models.py`
**Add**:
```python
class JobRecord(BaseModel):
    ...
    task_id: str | None = None
```

**File**: `network/packages/payment/services/job_service.py`
**Add in `submit_job()`**:
```python
job_record = JobRecord(
    job_id=job_id,
    task_id=payload.task_id,
    ...
)
```

**File**: `network/packages/payment/services/job_service.py`
**Add in `complete_job()`**:
```python
job = await self.get_job(job_id)
if job is None:
    job = await self.database[JOBS].find_one({"task_id": job_id})
if job is None:
    raise ValueError(f"Job {job_id} not found")
```

### 3. ICL — Include `permit` in Assignment Response

**File**: `network/packages/icl/routers/internal.py`
**In `get_assignments()`**:
Look up permit from `PERMITS` collection for the requesting node and include it in the response.

### 4. Frontend — Add Missing Status Literals

**File**: `network/packages/frontend/src/api/inferenceApi.ts`
**Change**:
```typescript
status: 'queued' | 'accepted' | 'rejected' | 'disputed' | 'failed' | 'pending_store_key'
```

### 5. ICL — Verify Internal Endpoint Schema

**File**: `network/packages/icl/routers/inference.py`
**Endpoint**: `POST /v1/inference/request`

Verify that `InternalInferenceRequest` (or the flat dict) is properly converted to `InferenceRequestCreate` inside the ICL, and that `metadata` is passed through to `_create_text_request()`.

Current code (line ~130 in inference.py):
```python
async def create_internal_request(payload: InternalInferenceRequest):
    request_create = InferenceRequestCreate(
        mode="text",
        text_request=TextInferenceRequest(...),
        metadata=payload.metadata,  # Make sure this is passed!
        ...
    )
    return await quorum_service.create_request_status(request_create)
```

---

## Testing After Fixes

### Minimal Test (No Browser, No Nodes)

```bash
# 1. Start ICL
uvicorn main:app --host 127.0.0.1 --port 8000

# 2. Start Payment Service
uvicorn main:app --host 127.0.0.1 --port 8001

# 3. Submit a job with metadata
python -c "
import requests, json
resp = requests.post('http://127.0.0.1:8001/v1/jobs/submit', json={
    'task_id': '0x' + 'a'*64,
    'user_address': '0x1234567890123456789012345678901234567890',
    'model_id': 'groq:llama-3.3-70b-versatile',
    'prompt_cid': 'QmTest',
    'encrypted_prompt_key_high': '123',
    'encrypted_prompt_key_low': '456',
    'metadata': {
        'prompt_key_store_tx': '0xabc',
        'cofhe_prompt_key_inputs': {'high': {'ctHash': '0x1'}, 'low': {'ctHash': '0x2'}}
    },
    'amount_credits': 10
})
print(resp.json())
"

# 4. Check ICL has the request with metadata
python -c "
import requests
resp = requests.get('http://127.0.0.1:8000/v1/inference/requests')
data = resp.json()
print(data['requests'][0]['metadata'])
"
# Should show: prompt_key_store_tx and cofhe_prompt_key_inputs

# 5. Check callback works
# (Simulate ICL completing by calling Payment Service callback)
```

### Full Test (With Frontend + Nodes)

1. Open frontend, connect MetaMask
2. Submit text inference
3. Watch Network tab: `POST /v1/jobs/submit` should return `job_id`
4. Check ICL logs: request created with `status=queued` (not `pending_store_key`)
5. Nodes should receive assignment and claim
6. ICL should reach consensus
7. ICL should call back Payment Service successfully (no 404)
8. Payment Service should mark job `COMPLETED`
9. Frontend polling should show `COMPLETED`
10. Node earnings endpoint should show the job

---

## Files to Modify

| File | Change |
|------|--------|
| `network/packages/payment/services/job_service.py` | Forward `metadata` in `icl_payload`; store `task_id` in `JobRecord`; lookup by `task_id` in `complete_job` |
| `network/packages/payment/models/job_models.py` | Add `task_id: str \| None = None` to `JobRecord` |
| `network/packages/icl/routers/internal.py` | Include `permit` in assignment response |
| `network/packages/frontend/src/api/inferenceApi.ts` | Add `'failed'` and `'pending_store_key'` to status Literal |
| `network/packages/icl/routers/inference.py` | Verify `InternalInferenceRequest` → `InferenceRequestCreate` conversion passes metadata |

---

## Appendix: Old vs New Request Flow Comparison

| Step | Old System | New System | Status |
|------|-----------|------------|--------|
| Frontend encrypts prompt | ✅ Same | ✅ Same | Working |
| Frontend uploads to IPFS | ✅ Same | ✅ Same | Working |
| Frontend calls `storeKey` | ✅ Same | ✅ Same | Working |
| Frontend submits request | `POST /v1/inference/requests` → ICL | `POST /v1/jobs/submit` → Payment Service | Working |
| Payment validates credits | N/A (in ICL) | `credit_service.check_balance()` | Working |
| Payment forwards to ICL | N/A | `POST /v1/inference/request` | **BROKEN: metadata missing** |
| ICL creates request | `InferenceRequestCreate` from frontend payload | `InferenceRequestCreate` from `InternalInferenceRequest` | **BROKEN: metadata empty** |
| ICL stores prompt key | Uses `metadata.prompt_key_store_tx` | Tries itself, fails, `pending_store_key` | **BROKEN: metadata missing** |
| Frontend confirms store key | `POST /v1/inference/{id}/confirm-store-key` | **Never called** | **BROKEN** (but fixable via metadata) |
| ICL dispatches to nodes | Pushes to node callback URLs | Same | Working |
| Nodes claim/execute | Same | Same | **BROKEN: no permit in assignment** |
| ICL finalizes | Calls `_attempt_finalize_text_request` | Same | Working |
| ICL notifies Payment | N/A | `POST /v1/jobs/{job_id}/complete` | **BROKEN: job_id mismatch** |
| Payment distributes rewards | N/A | `_distribute_rewards()` | **BROKEN: callback 404** |
| Frontend polls status | `GET /v1/inference/{id}` | `GET /v1/jobs/{job_id}` | Working |

---

## For Other LLMs

When you pick up this codebase:

1. **Apply the 5 fixes above** in order.
2. **Test the minimal path first** (Python script hitting Payment Service → ICL).
3. **Then test with frontend + nodes**.
4. The **CoFHE testnet being down** (`api.helios.fhenix.zone` ENOTFOUND) is an external blocker — you can still verify all Payment Service + ICL + callback logic without it by:
   - Using `MOCK_CHAIN=true`
   - Or testing the API contracts without actual node execution
5. **Node permits**: If nodes still can't decrypt after these fixes, check that `GET /internal/assignments/{addr}` returns a `permit` field, and that the node `icl_client.py` uses it.

The core issue is simple: **the Payment Service was added as a gateway but the `metadata` passthrough was forgotten, and the job/task ID correlation was not designed**. The fixes are ~20 lines total.
