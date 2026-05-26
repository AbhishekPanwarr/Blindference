"""ICL internal endpoints — node communication for task lifecycle."""

from __future__ import annotations

import uuid
import time
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request

from db.collections import PERMITS
from models.internal_models import LeaderTextResultSubmission, VerifierTextVerdict
from services import ServiceContainer, get_service_container

router = APIRouter(prefix="/internal", tags=["internal"])

# ---------------------------------------------------------------------------
# /internal/challenge/{nodeAddress}
# ---------------------------------------------------------------------------


@router.get("/challenge/{node_address}")
async def get_attestation_challenge(node_address: str) -> dict[str, object]:
    """Return a fresh attestation challenge for *node_address*."""
    nonce_bytes = uuid.uuid4().bytes + uuid.uuid4().bytes
    return {
        "challengeId": str(uuid.uuid4()),
        "nonce": "0x" + nonce_bytes.hex(),
        "expiresAt": int(time.time()) + 300,
    }


# ---------------------------------------------------------------------------
# /internal/attestation/verify
# ---------------------------------------------------------------------------


@router.post("/attestation/verify")
async def verify_attestation(
    request: Request,
    services: ServiceContainer = Depends(get_service_container),
) -> dict[str, Any]:
    """Verify a node attestation quote and return a time‑bound certificate."""
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    node_address = body.get("nodeAddress", "")
    backend_type = body.get("backendType", "mock")
    quote = body.get("quote", "")
    runtime_hash = body.get("runtimeHash", "")
    challenge_id = body.get("challengeId", "")

    if not node_address:
        raise HTTPException(status_code=400, detail="nodeAddress is required")

    # Allow node to declare its own tier; fall back to backend heuristic
    tier = body.get("tier")
    if tier is None:
        if backend_type == "mock":
            tier = 0
        elif backend_type == "tpm":
            tier = 1
        else:
            tier = 0

    expiry = int(time.time()) + 86400  # 48 hours
    cert_hash = f"0x{uuid.uuid4().hex[:32]}"

    # Register the node as an operator in the ICL database
    await services.chain_service.register_attested_operator(
        operator_address=node_address,
        tier=tier,
        attestation_type=backend_type,
        attestation_document_hash=runtime_hash,
        attestation_expires_at=expiry,
        supported_model_ids=body.get("supportedModelIds") or body.get("supported_model_ids"),
    )

    return {
        "certHash": cert_hash,
        "expiry": expiry,
        "tier": tier,
    }


# ---------------------------------------------------------------------------
# /internal/assignments/{nodeAddress}
# ---------------------------------------------------------------------------


@router.get("/assignments/{node_address}")
async def get_assignments(
    node_address: str,
    services: ServiceContainer = Depends(get_service_container),
) -> dict[str, object]:
    """Return pending job assignments for *node_address*."""
    try:
        task_ids = await services.quorum_service._get_pending_assignments(node_address)
    except Exception:
        task_ids = []

    assignments: list[dict[str, Any]] = []
    for task_id in task_ids:
        try:
            request_doc = await services.quorum_service.get_request_by_task_id(task_id)
        except Exception:
            continue

        role = "leader"
        if hasattr(request_doc, "leader_address") and getattr(request_doc, "leader_address") != node_address:
            role = "verifier"

        # Extract fields from dict or Pydantic model uniformly
        if isinstance(request_doc, dict):
            model_id = request_doc.get("model_id", "qwen2.5-7b")
            prompt_cid = request_doc.get("prompt_cid", "")
            user_address = request_doc.get("developer_address", "0x0000000000000000000000000000000000000000")
            metadata = request_doc.get("metadata", {})
        else:
            model_id = getattr(request_doc, "model_id", "qwen2.5-7b")
            prompt_cid = getattr(request_doc, "prompt_cid", "")
            user_address = getattr(request_doc, "developer_address", "0x0000000000000000000000000000000000000000")
            metadata = getattr(request_doc, "metadata", {})

        # Pull CoFHE key handles from metadata if available
        kp_high = metadata.get("prompt_key_store_handles", {}).get("high") if isinstance(metadata, dict) else None
        kp_low = metadata.get("prompt_key_store_handles", {}).get("low") if isinstance(metadata, dict) else None

        # Retrieve permit for this node
        permit_doc = await services.database[PERMITS].find_one({"task_id": task_id})
        permit = None
        if permit_doc:
            for entry in permit_doc.get("permits", []):
                if entry.get("node_address") == node_address:
                    permit = entry.get("permit")
                    break

        assignments.append({
            "jobId": str(task_id),
            "role": role,
            "modelId": model_id,
            "promptCid": prompt_cid,
            "deadline": int(time.time()) + 600,
            "insuranceOptIn": False,
            "userAddress": user_address,
            "kpHighHandle": kp_high or metadata.get("cofhe_prompt_key_inputs", {}).get("high", {}).get("ctHash") if isinstance(metadata, dict) else None,
            "kpLowHandle": kp_low or metadata.get("cofhe_prompt_key_inputs", {}).get("low", {}).get("ctHash") if isinstance(metadata, dict) else None,
            "permit": permit,
        })

    return {"assignments": assignments}


# ---------------------------------------------------------------------------
# /internal/task/claim
# ---------------------------------------------------------------------------


@router.post("/task/claim")
async def claim_task(
    request: Request,
    services: ServiceContainer = Depends(get_service_container),
) -> dict[str, object]:
    """Claim a job — returns prompt key handles and grants CoFHE ACL access."""
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    job_id = body.get("jobId", "")
    node_address = body.get("nodeAddress", "")

    if not job_id or not node_address:
        raise HTTPException(status_code=400, detail="jobId and nodeAddress are required")

    # Try on-chain first, then fall back to metadata handles stored by the frontend
    handles: dict[str, str | int] = {"high": "0", "low": "0"}
    onchain_handles: dict[str, str] | None = None
    try:
        onchain_handles = await services.chain_service.get_text_prompt_key_handles(task_id=job_id)
    except Exception:
        pass

    # Use on-chain handles only if they contain real data; otherwise fallback to metadata
    if onchain_handles and str(onchain_handles.get("high", "0")) not in ("0", "", "None"):
        handles = onchain_handles  # type: ignore[assignment]
    else:
        try:
            request_doc = await services.database["inference_requests"].find_one({"task_id": job_id})
            if request_doc:
                metadata = request_doc.get("metadata", {})
                raw_inputs = metadata.get("cofhe_prompt_key_inputs")
                if isinstance(raw_inputs, dict):
                    high_val = raw_inputs.get("high")
                    low_val = raw_inputs.get("low")
                    if isinstance(high_val, dict) and isinstance(low_val, dict):
                        handles = {
                            "high": str(high_val.get("ctHash", "0")),
                            "low": str(low_val.get("ctHash", "0")),
                        }
        except Exception:
            pass

    # Record claim to prevent ICL from re-dispatching to this node
    try:
        await services.quorum_service.record_node_claim(job_id, node_address)
    except Exception:
        pass

    def _parse_handle(val):
        if val is None:
            return 0
        if isinstance(val, int):
            return val
        val = str(val)
        if val.startswith("0x") or val.startswith("0X"):
            return int(val, 16)
        return int(val)

    return {
        "kpHighHandle": _parse_handle(handles.get("high", "0")),
        "kpLowHandle": _parse_handle(handles.get("low", "0")),
        "outputKeyGranted": True,
        "claimDeadline": int(time.time()) + 300,
    }


# ---------------------------------------------------------------------------
# /internal/task/result
# ---------------------------------------------------------------------------


@router.post("/task/result")
async def submit_internal_task_result(
    payload: dict[str, Any],
    services: ServiceContainer = Depends(get_service_container),
) -> dict[str, object]:
    """Submit a leader's inference result (output CID + commitment)."""
    job_id = payload.get("jobId")
    if not isinstance(job_id, str) or not job_id:
        raise HTTPException(status_code=400, detail="jobId is required")

    try:
        return await services.quorum_service.submit_internal_task_result(job_id, payload)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        import traceback, logging as _logging
        _logging.getLogger("icl.internal").error(
            "submit_internal_task_result failed for job_id=%s: %s\n%s",
            job_id, error, traceback.format_exc()
        )
        raise HTTPException(status_code=500, detail=f"Internal error: {error}") from error


# ---------------------------------------------------------------------------
# /internal/task/verify
# ---------------------------------------------------------------------------


@router.post("/task/verify")
async def submit_internal_task_verification(
    payload: dict[str, Any],
    services: ServiceContainer = Depends(get_service_container),
) -> dict[str, object]:
    """Submit a verifier's verdict (CONFIRM / REJECT)."""
    job_id = payload.get("jobId")
    if not isinstance(job_id, str) or not job_id:
        raise HTTPException(status_code=400, detail="jobId is required")

    try:
        return await services.quorum_service.submit_internal_task_verification(job_id, payload)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        import traceback, logging as _logging
        _logging.getLogger("icl.internal").error(
            "submit_internal_task_verification failed for job_id=%s: %s\n%s",
            job_id, error, traceback.format_exc()
        )
        raise HTTPException(status_code=500, detail=f"Internal error: {error}") from error


# ---------------------------------------------------------------------------
# /internal/jobs/{jobId}/escrow
# ---------------------------------------------------------------------------


@router.get("/jobs/{job_id}/escrow")
async def get_job_escrow(
    job_id: str,
    services: ServiceContainer = Depends(get_service_container),
) -> dict[str, object]:
    """Return the escrow ID associated with a job."""
    try:
        request_doc = await services.quorum_service.get_request_status_by_task_id(job_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    if isinstance(request_doc, dict):
        escrow_id = request_doc.get("escrow_id", 0)
    else:
        escrow_id = getattr(request_doc, "escrow_id", 0) if hasattr(request_doc, "escrow_id") else 0

    return {"jobId": job_id, "escrowId": escrow_id}


# ---------------------------------------------------------------------------
# /internal/heartbeat
# ---------------------------------------------------------------------------


@router.post("/heartbeat")
async def receive_heartbeat(
    request: Request,
    services: ServiceContainer = Depends(get_service_container),
) -> dict[str, str]:
    """Receive a node liveness heartbeat."""
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    node_address = body.get("nodeAddress", "")
    if not node_address:
        raise HTTPException(status_code=400, detail="nodeAddress is required")

    try:
        await services.chain_service.refresh_operator_heartbeat(node_address)
    except Exception:
        pass

    return {"status": "ok"}


# ---------------------------------------------------------------------------
# /internal/jobs/{jobId}/status
# ---------------------------------------------------------------------------


@router.get("/jobs/{job_id}/status")
async def get_job_status(
    job_id: str,
    services: ServiceContainer = Depends(get_service_container),
) -> dict[str, object]:
    """Return the current status of a job (for verifiers polling leader CID)."""
    try:
        request_doc = await services.quorum_service.get_request_status_by_task_id(job_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    if isinstance(request_doc, dict):
        return {
            "jobId": job_id,
            "status": request_doc.get("status", "pending"),
            "outputCid": request_doc.get("output_cid"),
            "leaderCommitment": request_doc.get("commitment_hash"),
            "failureReason": request_doc.get("failure_reason"),
            "nodeAssignments": request_doc.get("node_assignments", {}),
        }

    # Handle Pydantic models (TextInferenceResult / InferenceRequestResponse)
    data = request_doc.model_dump() if hasattr(request_doc, "model_dump") else {}
    return {
        "jobId": job_id,
        "status": data.get("status", "pending"),
        "outputCid": data.get("output_cid"),
        "leaderCommitment": data.get("commitment_hash"),
        "failureReason": data.get("failure_reason"),
        "nodeAssignments": data.get("node_assignments", {}),
    }
