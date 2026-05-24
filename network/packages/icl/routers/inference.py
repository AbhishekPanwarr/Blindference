from __future__ import annotations

import logging
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from web3 import Web3

try:
    from blindference_utils.ipfs import upload_to_ipfs
except ImportError:
    shared_py_root = Path(__file__).resolve().parents[2] / "shared-py"
    if str(shared_py_root) not in sys.path:
        sys.path.insert(0, str(shared_py_root))
    from blindference_utils.ipfs import upload_to_ipfs  # type: ignore[no-redef]

from middleware.rate_limit import rate_limit_guard
from models.request_models import (
    InferenceCommitRequest,
    LeaderResultSubmissionRequest,
    InferencePermitAttachmentRequest,
    InferenceRequestCreate,
    VerifierVerdictSubmissionRequest,
)
from models.response_models import (
    InferenceCommitResponse,
    InferenceRequestResponse,
    IpfsUploadResponse,
    QuorumPreviewResponse,
)
from models.text_inference import TextInferenceResult
from services import ServiceContainer, get_service_container

router = APIRouter(prefix="/v1/inference", tags=["inference"])


@router.post("/upload-prompt", response_model=IpfsUploadResponse)
async def upload_encrypted_prompt(
    file: UploadFile = File(...),
    _: bool = Depends(rate_limit_guard),
) -> IpfsUploadResponse:
    try:
        data = await file.read()
        if not data:
            raise ValueError("Uploaded prompt payload is empty")
        cid = upload_to_ipfs(data)
        return IpfsUploadResponse(cid=cid)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=502, detail=f"Prompt upload failed: {error}") from error


@router.get("", response_model=list[InferenceRequestResponse])
async def list_inference_requests(
    _: bool = Depends(rate_limit_guard),
    services: ServiceContainer = Depends(get_service_container),
) -> list[InferenceRequestResponse]:
    return await services.quorum_service.list_requests()


@router.get("/quorum-preview", response_model=QuorumPreviewResponse)
async def get_quorum_preview(
    model_id: str,
    min_tier: int = 1,
    verifier_count: int = 2,
    zdr_required: bool = False,
    services: ServiceContainer = Depends(get_service_container),
) -> QuorumPreviewResponse:
    try:
        preview = await services.quorum_service.preview_quorum(
            min_tier=min_tier,
            zdr_required=zdr_required,
            verifier_count=verifier_count,
            model_id=model_id,
        )
        return QuorumPreviewResponse(
            leader=preview["leader_address"],
            verifiers=preview["verifier_addresses"],
            candidates=preview["candidate_addresses"],
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.post("/requests", response_model=InferenceRequestResponse | TextInferenceResult)
async def create_inference_request(
    payload: InferenceRequestCreate,
    _: bool = Depends(rate_limit_guard),
    services: ServiceContainer = Depends(get_service_container),
) -> InferenceRequestResponse | TextInferenceResult:
    try:
        if payload.payment_mode == "credits":
            payment_url = services.settings.PAYMENT_SERVICE_URL
            async with httpx.AsyncClient(timeout=30.0) as client:
                # 1. Compute price and deduct credits
                deduct_resp = await client.post(
                    f"{payment_url}/v1/deduct",
                    json={
                        "user_address": payload.developer_address,
                        "model_id": payload.model_id,
                        "currency": payload.payment_currency,
                        "reason": f"inference_job:{payload.model_id}",
                    },
                )
                if deduct_resp.status_code == 402:
                    raise HTTPException(status_code=402, detail=deduct_resp.json().get("detail", "Insufficient credits"))
                deduct_resp.raise_for_status()
                deduct_data = deduct_resp.json()
                amount_cusdc = deduct_data.get("amount_cusdc", 0)
                amount_blind = deduct_data.get("amount_blind", 0)

                # 2. Create Reineira escrow
                escrow_resp = await client.post(
                    f"{payment_url}/v1/escrow/create",
                    json={
                        "amount_cusdc": amount_cusdc,
                        "job_id": payload.task_id or "",
                        "owner_address": payload.developer_address,
                        "resolver_address": services.settings.PAYMENT_SERVICE_URL,  # TODO: proper resolver
                    },
                )
                escrow_resp.raise_for_status()
                escrow_result = escrow_resp.json()

            # Store credit payment info in metadata for tracking
            payload.metadata = {
                **dict(payload.metadata),
                "payment_mode": "credits",
                "payment_currency": payload.payment_currency,
                "amount_cusdc": amount_cusdc,
                "amount_blind": amount_blind,
                "escrow_id": escrow_result.get("escrow_id"),
                "escrow_creation_tx": escrow_result.get("tx_hash"),
            }
        return await services.quorum_service.create_request_status(payload)
    except HTTPException:
        raise
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.post("/{request_id}/leader-result")
async def submit_leader_result(
    request_id: str,
    payload: LeaderResultSubmissionRequest,
    _: bool = Depends(rate_limit_guard),
    services: ServiceContainer = Depends(get_service_container),
) -> dict[str, object]:
    try:
        return await services.quorum_service.submit_leader_result(request_id, payload)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.post("/{request_id}/verdicts")
async def submit_verifier_verdict(
    request_id: str,
    payload: VerifierVerdictSubmissionRequest,
    _: bool = Depends(rate_limit_guard),
    services: ServiceContainer = Depends(get_service_container),
) -> dict[str, object]:
    try:
        return await services.quorum_service.submit_verifier_verdict(request_id, payload)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.get("/task/{task_id}", response_model=InferenceRequestResponse | TextInferenceResult)
async def get_inference_request_by_task_id(
    task_id: str,
    services: ServiceContainer = Depends(get_service_container),
) -> InferenceRequestResponse | TextInferenceResult:
    try:
        return await services.quorum_service.get_request_status_by_task_id(task_id)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.get("/{request_id}", response_model=InferenceRequestResponse | TextInferenceResult)
async def get_inference_request(
    request_id: str,
    services: ServiceContainer = Depends(get_service_container),
) -> InferenceRequestResponse | TextInferenceResult:
    try:
        return await services.quorum_service.get_request_status(request_id)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.post("/{request_id}/confirm-store-key")
async def confirm_prompt_key_store(
    request_id: str,
    payload: dict[str, Any],
    services: ServiceContainer = Depends(get_service_container),
) -> InferenceRequestResponse | TextInferenceResult:
    """Confirm that the frontend has stored the prompt key on-chain.

    The ICL will verify the tx (optional), grant decrypt access to each
    quorum node, and dispatch the request.
    """
    try:
        return await services.quorum_service.confirm_prompt_key_store(
            request_id,
            payload.get("prompt_key_store_tx", ""),
        )
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.patch("/{task_id}/permit")
async def attach_inference_permit(
    task_id: str,
    payload: InferencePermitAttachmentRequest,
    _: bool = Depends(rate_limit_guard),
    services: ServiceContainer = Depends(get_service_container),
) -> dict[str, str]:
    try:
        return await services.quorum_service.attach_permit(task_id, payload)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.post("/{request_id}/commit", response_model=InferenceCommitResponse)
async def commit_inference_request(
    request_id: str,
    payload: InferenceCommitRequest,
    _: bool = Depends(rate_limit_guard),
    services: ServiceContainer = Depends(get_service_container),
) -> InferenceCommitResponse:
    try:
        return await services.quorum_service.commit_request(request_id, payload)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.post("/{request_id}/dispute")
async def dispute_inference_request(
    request_id: str,
    payload: dict[str, Any],
    _: bool = Depends(rate_limit_guard),
    services: ServiceContainer = Depends(get_service_container),
) -> dict[str, Any]:
    """File a dispute for an accepted inference job.

    The dispute window is 72 hours from coverage creation.
    Mock resolution: disputes with non-empty evidence are auto-approved.
    """
    evidence = payload.get("evidence", "")
    evidence_hash = Web3.keccak(text=evidence).hex()

    try:
        # Load the job document
        request_doc = await services.database["inference_requests"].find_one(
            {"request_id": request_id}
        )
        if not request_doc:
            raise HTTPException(status_code=404, detail="Request not found")

        # Check if coverage_id exists
        metadata = request_doc.get("metadata", {})
        coverage_id = metadata.get("coverage_id")
        if not coverage_id:
            raise HTTPException(status_code=400, detail="No insurance coverage for this job")

        # Check dispute window (72 hours from coverage creation)
        # For mock, use request creation time as proxy
        created_at = request_doc.get("created_at")
        if created_at:
            from datetime import datetime, timezone, timedelta
            if isinstance(created_at, str):
                created_at = datetime.fromisoformat(created_at)
            deadline = created_at + timedelta(hours=72)
            if datetime.now(timezone.utc) > deadline:
                raise HTTPException(status_code=400, detail="Dispute window expired (72h)")

        # Check if already disputed
        if request_doc.get("status") == "disputed":
            raise HTTPException(status_code=400, detail="Request already disputed")

        # Submit dispute on-chain via ResultRegistry
        task_id = request_doc.get("task_id", "")
        if task_id:
            try:
                # Call ResultRegistry.submitDispute
                # This requires the ICL wallet
                tx_hash = await services.chain_service.submit_dispute(
                    task_id=task_id,
                    evidence_hash=evidence_hash,
                    evidence_uri=f"ipfs://dispute/{request_id}",
                )
                logger.info("Dispute submitted on-chain: tx=%s request=%s", tx_hash, request_id)
            except Exception as exc:
                logger.warning("On-chain dispute submission failed (non-critical): %s", exc)

        # Mock resolution: approve if evidence is non-empty
        if evidence_hash == Web3.keccak(text="").hex():
            verdict = "rejected"
            upheld = False
        else:
            verdict = "approved"
            upheld = True

        # Update request status
        await services.database["inference_requests"].update_one(
            {"request_id": request_id},
            {
                "$set": {
                    "status": "disputed" if not upheld else "disputed_resolved",
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "dispute_evidence": evidence,
                    "dispute_evidence_hash": evidence_hash,
                    "dispute_verdict": verdict,
                    "dispute_upheld": upheld,
                }
            },
        )

        # If dispute upheld, refund credits via Payment Service
        if upheld:
            try:
                amount_cusdc = metadata.get("amount_cusdc", 0)
                if amount_cusdc > 0:
                    async with httpx.AsyncClient(timeout=30.0) as client:
                        refund_resp = await client.post(
                            f"{services.settings.PAYMENT_SERVICE_URL}/v1/credits/refund",
                            json={
                                "user_address": request_doc.get("developer_address", ""),
                                "amount_cusdc": amount_cusdc,
                                "reason": f"dispute_refund:{request_id}",
                            },
                        )
                        if refund_resp.status_code == 200:
                            logger.info(
                                "Credits refunded for dispute: request=%s amount=%d",
                                request_id,
                                amount_cusdc,
                            )
            except Exception as exc:
                logger.warning("Credit refund failed (non-critical): %s", exc)

        return {
            "status": "disputed",
            "request_id": request_id,
            "verdict": verdict,
            "upheld": upheld,
            "evidence_hash": evidence_hash,
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Dispute failed for request=%s: %s", request_id, exc)
        raise HTTPException(status_code=500, detail=f"Dispute failed: {exc}") from exc
