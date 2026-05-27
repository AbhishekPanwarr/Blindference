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

    # Fetch all jobs and filter in Python (avoids $or and array-containment operators)
    all_jobs: list[dict[str, Any]] = []
    async for doc in database[JOBS].find({}):
        leader = (doc.get("leader_address") or "").lower()
        verifiers = [v.lower() for v in doc.get("verifier_addresses", [])]
        if leader == checksum or checksum in verifiers:
            all_jobs.append(doc)

    # Sort by updated_at descending and apply limit in Python
    all_jobs.sort(key=lambda d: d.get("updated_at", ""), reverse=True)
    all_jobs = all_jobs[:max(1, min(limit, 100))]

    jobs: list[dict[str, Any]] = []
    for doc in all_jobs:
        doc.pop("id", None)
        job_id = doc.get("job_id", "")
        leader = (doc.get("leader_address") or "").lower()
        verifiers = [v.lower() for v in doc.get("verifier_addresses", [])]
        status = doc.get("status", "UNKNOWN")

        role = "leader" if checksum == leader else "verifier" if checksum in verifiers else "unknown"

        # Earnings: only for finalised jobs with rewards recorded
        rewards_map = doc.get("rewards") or {}
        amount_earned = None
        if status in ("COMPLETED", "FAILED", "REFUNDED"):
            for k, v in (rewards_map or {}).items():
                if k.lower() == checksum:
                    amount_earned = v
                    break
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

    # Fetch all completed jobs and filter in Python
    total_blind = 0.0
    jobs_count = 0
    seen: set[str] = set()
    async for doc in database[JOBS].find({"status": "COMPLETED"}):
        leader = (doc.get("leader_address") or "").lower()
        verifiers = [v.lower() for v in doc.get("verifier_addresses", [])]
        if leader == checksum or checksum in verifiers:
            job_id = doc.get("job_id", "")
            if job_id in seen:
                continue
            seen.add(job_id)
            rewards_map = doc.get("rewards") or {}
            # Rewards keys may also be checksummed
            amount = None
            for k, v in (rewards_map or {}).items():
                if k.lower() == checksum:
                    amount = v
                    break
            if amount is not None:
                total_blind += float(amount)
                jobs_count += 1

    return {"total_blind_earned": total_blind, "jobs_count": jobs_count}


@router.get("/{address}/exists")
async def check_node_exists(
    address: str,
    request: Request = None,
) -> dict[str, bool]:
    """Check if an address is a registered operator in the ICL operators table."""
    if request is None:
        raise HTTPException(status_code=500, detail="Request context unavailable")

    checksum = address.lower()

    # Payment Service shares the Supabase project with ICL and has RLS disabled,
    # so we can query the operators table directly.
    from db.supabase_client import get_supabase_client

    client = get_supabase_client()
    result = await client.table("operators").select("operator_address").ilike("operator_address", checksum).limit(1).execute()
    is_operator = bool(result.data) if result.data else False
    return {"is_operator": is_operator}


@router.get("/{address}/stats")
async def get_node_stats(
    address: str,
    request: Request = None,
) -> dict[str, Any]:
    """Return aggregated stats for a node: jobs, earnings, on-chain stake, failures."""
    if request is None:
        raise HTTPException(status_code=500, detail="Request context unavailable")

    services = request.app.state.services
    database = services.database
    chain_service = services.chain_service
    checksum = address.lower()

    # 1. Job stats from jobs table
    total_jobs = 0
    success = 0
    failed = 0
    total_earned = 0.0

    async for doc in database[JOBS].find({}):
        leader = (doc.get("leader_address") or "").lower()
        verifiers = [v.lower() for v in doc.get("verifier_addresses", [])]
        if leader == checksum or checksum in verifiers:
            total_jobs += 1
            status = doc.get("status", "")
            if status == "COMPLETED":
                success += 1
                rewards = doc.get("rewards") or {}
                amount = None
                for k, v in (rewards or {}).items():
                    if k.lower() == checksum:
                        amount = v
                        break
                if amount is not None:
                    total_earned += float(amount)
            elif status in ("FAILED", "REFUNDED"):
                failed += 1

    # 2. On-chain staking info
    stake_info = chain_service.get_stake_info(checksum)
    current_stake_blind = "0"
    slash_count = 0
    slashed = False
    if stake_info:
        staked_wei = stake_info.get("staked", 0)
        current_stake_blind = f"{float(staked_wei) / 1e18:.4f}"
        consecutive_failures = stake_info.get("consecutiveFailures", 0)
        slash_count = int(consecutive_failures)
        slashed = consecutive_failures >= 3

    return {
        "total_jobs": total_jobs,
        "success": success,
        "failed": failed,
        "slashed": slashed,
        "slash_count": slash_count,
        "current_stake_blind": current_stake_blind,
        "total_earned_blind": f"{total_earned:.4f}",
    }
