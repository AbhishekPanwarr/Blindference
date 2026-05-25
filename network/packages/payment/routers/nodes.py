from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Request

from db.collections import JOBS
from services import get_service_container

logger = logging.getLogger("blindference.payment.nodes")

router = APIRouter(prefix="/v1/nodes")


@router.get("/{address}/jobs")
async def list_node_jobs(
    address: str,
    limit: int = 20,
    request: Request = None,
) -> dict[str, Any]:
    """Return jobs where the given node address was leader or verifier."""
    if request is None:
        raise HTTPException(status_code=500, detail="Request context unavailable")

    services = request.app.state.services
    database = services.database
    checksum = address.lower()

    cursor = database[JOBS].find(
        {
            "$or": [
                {"leader_address": checksum},
                {"verifier_addresses": checksum},
            ]
        }
    ).sort("updated_at", -1).limit(max(1, min(limit, 100)))

    jobs: list[dict[str, Any]] = []
    async for doc in cursor:
        doc.pop("_id", None)
        job_id = doc.get("job_id", "")
        leader = (doc.get("leader_address") or "").lower()
        verifiers = [v.lower() for v in doc.get("verifier_addresses", [])]
        status = doc.get("status", "UNKNOWN")

        role = "leader" if checksum == leader else "verifier" if checksum in verifiers else "unknown"

        # Earnings: only for finalised jobs with rewards recorded
        rewards_map = doc.get("rewards") or {}
        amount_earned = None
        if status in ("COMPLETED", "FAILED", "REFUNDED"):
            amount_earned = rewards_map.get(checksum)
            if amount_earned is None:
                amount_earned = 0.0

        jobs.append({
            "job_id": job_id,
            "role": role,
            "status": status,
            "amount_blind_earned": amount_earned,
            "model_id": doc.get("model_id"),
            "completed_at": doc.get("updated_at"),
        })

    return {"node_address": checksum, "count": len(jobs), "jobs": jobs}


@router.get("/{address}/earnings")
async def get_node_earnings(
    address: str,
    request: Request = None,
) -> dict[str, Any]:
    """Return total BLIND earned and job count for a node."""
    if request is None:
        raise HTTPException(status_code=500, detail="Request context unavailable")

    services = request.app.state.services
    database = services.database
    checksum = address.lower()

    cursor = database[JOBS].find(
        {
            "status": "COMPLETED",
            "$or": [
                {"leader_address": checksum},
                {"verifier_addresses": checksum},
            ],
        }
    )

    total_blind = 0.0
    jobs_count = 0
    async for doc in cursor:
        rewards_map = doc.get("rewards") or {}
        amount = rewards_map.get(checksum)
        if amount is not None:
            total_blind += float(amount)
            jobs_count += 1

    return {"total_blind_earned": total_blind, "jobs_count": jobs_count}
