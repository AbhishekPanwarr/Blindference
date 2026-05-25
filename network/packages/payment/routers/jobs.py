from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from models.job_models import JobCompletionRequest, JobSubmitRequest
from services.credit_service import InsufficientCredits

logger = logging.getLogger("blindference.payment.jobs_router")

router = APIRouter(prefix="/v1/jobs")


async def _get_job_service(request: Request):
    services = request.app.state.services
    return services.job_service


@router.post("/submit")
async def submit_job(payload: JobSubmitRequest, request: Request) -> dict[str, Any]:
    """Submit a new inference job via the Payment Service gateway."""
    job_service = await _get_job_service(request)
    try:
        result = await job_service.submit_job(payload)
        return result
    except InsufficientCredits as exc:
        logger.warning("Insufficient credits for job submit: %s", exc)
        raise HTTPException(status_code=402, detail=str(exc)) from exc
    except RuntimeError as exc:
        logger.error("Job submission failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Unexpected error during job submission")
        raise HTTPException(status_code=500, detail=f"Job submission failed: {exc}") from exc


@router.get("/{job_id}")
async def get_job(job_id: str, request: Request) -> dict[str, Any]:
    """Get the status and details of a job."""
    job_service = await _get_job_service(request)
    job = await job_service.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    return job


@router.post("/{job_id}/complete")
async def complete_job(job_id: str, payload: JobCompletionRequest, request: Request) -> dict[str, Any]:
    """ICL callback: mark a job as completed or failed."""
    job_service = await _get_job_service(request)
    try:
        result = await job_service.complete_job(job_id, payload)
        return result
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Unexpected error during job completion callback")
        raise HTTPException(status_code=500, detail=f"Job completion failed: {exc}") from exc
