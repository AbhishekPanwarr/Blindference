from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException

from db.collections import JOBS
from db.database import get_database

logger = logging.getLogger("blindference.payment.developers")

router = APIRouter(prefix="/v1/developers")


@router.get("/{address}/stats")
async def get_developer_stats(address: str) -> dict[str, Any]:
    """Return aggregated statistics for jobs submitted by a developer via the SDK."""
    database = get_database()
    normalized_address = address.lower()

    try:
        # Fetch all jobs for this user where source == "sdk"
        all_jobs = []
        async for doc in database[JOBS].find({"user_address": normalized_address}):
            all_jobs.append(doc)
    except Exception as exc:
        logger.error("Failed to query jobs for developer %s: %s", address, exc)
        raise HTTPException(status_code=500, detail="Database query failed") from exc

    sdk_jobs = [job for job in all_jobs if job.get("source") == "sdk"]

    completed = sum(1 for job in sdk_jobs if job.get("status") == "COMPLETED")
    failed = sum(1 for job in sdk_jobs if job.get("status") == "FAILED")
    rejected = sum(1 for job in sdk_jobs if job.get("status") == "REFUNDED")

    total_cusdc_spent = sum(
        float(job.get("amount_cusdc", "0") or "0")
        for job in sdk_jobs
        if job.get("status") in ("COMPLETED", "FAILED", "REFUNDED")
    )
    total_blind_spent = sum(
        float(job.get("amount_blind", "0") or "0")
        for job in sdk_jobs
        if job.get("status") in ("COMPLETED", "FAILED", "REFUNDED")
    )

    stats = {
        "address": normalized_address,
        "total_jobs": len(sdk_jobs),
        "completed": completed,
        "failed": failed,
        "rejected": rejected,
        "total_cusdc_spent": total_cusdc_spent,
        "total_blind_spent": total_blind_spent,
    }

    logger.info("Developer stats for %s: %s", address, stats)
    return stats
