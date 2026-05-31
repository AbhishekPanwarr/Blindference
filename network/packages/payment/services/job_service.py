from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

import httpx

from db.collections import JOBS
from models.job_models import JobCompletionRequest, JobRecord, JobSubmitRequest
from services.credit_service import InsufficientCredits

logger = logging.getLogger("blindference.payment.jobs")


class JobService:
    """Orchestrates the job lifecycle: submit, track, and settle inference jobs."""

    def __init__(self, database, credit_service, chain_service, pricing_service, settings):
        self.database = database
        self.credit_service = credit_service
        self.chain_service = chain_service
        self.pricing_service = pricing_service
        self.settings = settings
        self.icl_url = getattr(settings, "ICL_URL", "http://127.0.0.1:8000")

    async def submit_job(self, payload: JobSubmitRequest) -> dict[str, Any]:
        """Submit a new inference job.

        1. Validate payment / deduct credits.
        2. Create escrow (if cUSDC).
        3. Purchase insurance (if opted in).
        4. Create job record.
        5. Forward to ICL.
        6. Return job_id.
        """
        job_id = str(uuid.uuid4())
        user_address = payload.user_address.lower()
        model_id = payload.model_id

        # On-chain bytes32 identifier: reuse frontend task_id (already bytes32 hex)
        # or convert the UUID job_id to a valid bytes32 hex string as fallback.
        if payload.task_id:
            on_chain_job_id = payload.task_id
        else:
            # UUID without hyphens is 32 hex chars; pad to 64 with leading zeros
            hex_body = job_id.replace("-", "").lower()
            hex_body = hex_body.zfill(64)
            on_chain_job_id = "0x" + hex_body

        # 1. Compute price
        price = self.pricing_service.compute_price(model_id, payload.payment_currency)
        amount_cusdc = price.get("amount_cusdc", 0)
        amount_blind = price.get("amount_blind", 0)

        # Insurance premium
        insurance_premium_cusdc = 0
        if payload.insurance_opt_in and amount_cusdc > 0:
            insurance_premium_cusdc = int(amount_cusdc * 0.02)

        total_cusdc = amount_cusdc + insurance_premium_cusdc

        # 2. Validate payment
        if payload.payment_mode == "credits":
            has_balance = await self.credit_service.check_balance(
                user_address,
                amount_cusdc=str(total_cusdc),
                amount_blind=str(amount_blind),
            )
            if not has_balance:
                raise InsufficientCredits(
                    f"Insufficient credits: need {total_cusdc} cUSDC / {amount_blind} BLIND"
                )

            # Deduct immediately
            await self.credit_service.deduct(
                user_address=user_address,
                amount_cusdc=str(total_cusdc),
                amount_blind=str(amount_blind),
                reason=f"job_submit:{job_id}",
            )
        elif payload.payment_mode == "escrow":
            if not payload.escrow_id:
                raise ValueError("escrow_id is required for escrow payment mode")
            # In escrow mode, the user pre-created the escrow on-chain.
            # No credit check or deduction needed.
            logger.info(
                "Escrow payment mode for job=%s: using pre-created escrow_id=%s",
                job_id, payload.escrow_id,
            )

        # 3. Create escrow (synchronous, wait for tx)
        escrow_id = None
        escrow_tx_hash = None
        if payload.payment_mode == "credits" and amount_cusdc > 0:
            try:
                escrow_result = await self.chain_service.create_and_fund_escrow(
                    amount_cusdc=total_cusdc,
                    job_id=on_chain_job_id,
                    owner_address=user_address,
                    resolver_address=self.settings.INFERENCE_GATE_ADDRESS,
                )
                escrow_id = escrow_result.get("escrow_id")
                escrow_tx_hash = escrow_result.get("tx_hash")
                logger.info(
                    "Escrow created for job=%s: escrow_id=%s tx=%s",
                    job_id, escrow_id, escrow_tx_hash,
                )
            except Exception as exc:
                logger.error("Escrow creation failed for job=%s: %s", job_id, exc)
                # Refund credits if escrow fails
                if payload.payment_mode == "credits":
                    await self.credit_service.refund(
                        user_address=user_address,
                        amount_cusdc=str(total_cusdc),
                        amount_blind=str(amount_blind),
                        reason=f"escrow_failed:{job_id}",
                    )
                raise RuntimeError(f"Escrow creation failed: {exc}") from exc
        elif payload.payment_mode == "escrow":
            escrow_id = payload.escrow_id

        # 4. Purchase insurance (if opted in)
        # Insurance is disabled in escrow mode per user requirements.
        coverage_id = None
        if payload.payment_mode == "credits" and payload.insurance_opt_in and escrow_id:
            try:
                insurance_result = await self.chain_service.purchase_insurance(
                    escrow_id=escrow_id,
                    job_price=amount_cusdc,
                    job_id=on_chain_job_id,
                    user_address=user_address,
                )
                coverage_id = insurance_result.get("coverage_id")
                logger.info(
                    "Insurance purchased for job=%s: coverage_id=%s",
                    job_id, coverage_id,
                )
            except Exception as exc:
                logger.error("Insurance purchase failed for job=%s: %s", job_id, exc)
                # Non-fatal: continue without insurance

        # 5. Create job record
        now = datetime.now(timezone.utc)
        job_record = JobRecord(
            job_id=job_id,
            task_id=payload.task_id,
            user_address=user_address,
            model_id=model_id,
            amount_cusdc=str(total_cusdc),
            amount_blind=str(amount_blind),
            insurance_opt_in=payload.insurance_opt_in,
            insurance_premium_cusdc=str(insurance_premium_cusdc),
            payment_mode=payload.payment_mode,
            payment_currency=payload.payment_currency,
            escrow_id=escrow_id,
            coverage_id=coverage_id,
            status="RUNNING",
            source=payload.source or "frontend",
            created_at=now,
            updated_at=now,
        )
        job_dict = job_record.model_dump()
        job_dict.pop("source", None)  # Supabase jobs table has no 'source' column (PGRST204)
        await self.database[JOBS].insert_one(job_dict)
        logger.info("Job record created: job_id=%s task_id=%s", job_id, payload.task_id)

        # 6. Forward to ICL with retry
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
            "metadata": payload.metadata,
        }
        if payload.task_id:
            icl_payload["task_id"] = payload.task_id

        icl_success = False
        last_error = None
        for attempt in range(1, 4):
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.post(
                        f"{self.icl_url}/v1/inference/request",
                        json=icl_payload,
                    )
                    resp.raise_for_status()
                    icl_success = True
                    logger.info(
                        "Job forwarded to ICL: job_id=%s attempt=%d status=%d",
                        job_id, attempt, resp.status_code,
                    )
                    break
            except Exception as exc:
                last_error = exc
                logger.warning(
                    "ICL forward failed for job=%s attempt=%d: %s",
                    job_id, attempt, exc,
                )
                if attempt < 3:
                    await asyncio.sleep(2 ** attempt)  # Exponential backoff

        if not icl_success:
            # Mark job as failed and refund (credits mode only)
            await self.database[JOBS].update_one(
                {"job_id": job_id},
                {
                    "$set": {
                        "status": "FAILED",
                        "error_reason": f"ICL forward failed: {last_error}",
                        "updated_at": datetime.now(timezone.utc),
                    }
                },
            )
            if payload.payment_mode == "credits":
                await self.credit_service.refund(
                    user_address=user_address,
                    amount_cusdc=str(total_cusdc),
                    amount_blind=str(amount_blind),
                    reason=f"icl_forward_failed:{job_id}",
                )
            raise RuntimeError(f"Failed to forward job to ICL after 3 attempts: {last_error}")

        return {
            "job_id": job_id,
            "status": "RUNNING",
            "escrow_id": escrow_id,
            "coverage_id": coverage_id,
        }

    async def get_job(self, job_id: str) -> dict[str, Any] | None:
        """Return a job record by ID."""
        record = await self.database[JOBS].find_one({"job_id": job_id})
        if record is None:
            return None
        record.pop("id", None)
        return record

    async def get_job_by_any_id(self, identifier: str) -> dict[str, Any] | None:
        """Look up a job by job_id (UUID) or task_id (bytes32 hex)."""
        # 1. Try primary key (UUID)
        record = await self.database[JOBS].find_one({"job_id": identifier})
        if record is not None:
            record.pop("id", None)
            return record
        # 2. Try task_id (frontend bytes32 hex) — any status
        record = await self.database[JOBS].find_one({"task_id": identifier})
        if record is not None:
            record.pop("id", None)
            return record
        return None

    async def complete_job(self, job_id: str, payload: JobCompletionRequest) -> dict[str, Any]:
        """Handle ICL completion callback.

        - Success: spend credits, distribute rewards, reset node failures.
        - Timeout/Rejected: refund credits, record failures, slash if needed.
        """
        job = await self.get_job_by_any_id(job_id)
        if job is None:
            logger.warning("complete_job: no job found for identifier=%s", job_id)
            raise ValueError(f"Job {job_id} not found")

        # Use the actual DB job_id (UUID) for updates — the ICL callback may pass task_id
        actual_job_id = job["job_id"]

        if job.get("status") != "RUNNING":
            logger.warning("Job %s already finalized (status=%s), skipping", actual_job_id, job.get("status"))
            return {"job_id": actual_job_id, "status": job.get("status"), "note": "already_finalized"}

        user_address = job["user_address"]
        amount_cusdc = int(job.get("amount_cusdc", 0))
        amount_blind = int(job.get("amount_blind", 0))
        payment_mode = job.get("payment_mode", "credits")

        now = datetime.now(timezone.utc)

        if payload.status == "success":
            # Credits already deducted — mark as spent (no refund needed)
            # Distribute BLIND rewards
            reward_result = await self._distribute_rewards(
                job_id=actual_job_id,
                leader_address=payload.leader_address,
                verifier_addresses=payload.verifier_addresses,
            )

            # Reset node failures for participating nodes
            await self._reset_node_failures(
                [payload.leader_address] + payload.verifier_addresses
            )

            # Escrow mode: call PayoutClaimer.claim() to release escrowed cUSDC
            claim_result = None
            job_escrow_id = job.get("escrow_id")
            if amount_cusdc > 0 and job_escrow_id:
                try:
                    claim_result = await self.chain_service.claim_payout(
                        escrow_id=str(job_escrow_id),
                        job_id=job.get("task_id") or actual_job_id,
                    )
                    logger.info(
                        "PayoutClaimer.claim() result for job=%s: %s",
                        actual_job_id, claim_result.get("status"),
                    )
                except Exception as exc:
                    logger.error("PayoutClaimer.claim() failed for job=%s: %s", actual_job_id, exc)
                    claim_result = {"status": "failed", "error": str(exc)}

            # Build per-node reward map (human-readable BLIND)
            rewards_map: dict[str, float] = {}
            if reward_result.get("status") == "distributed":
                rewards_map[payload.leader_address.lower()] = 0.6
                for v_addr in payload.verifier_addresses[:2]:
                    rewards_map[v_addr.lower()] = 0.2

            # Update job record (use actual DB job_id, not the ICL task_id)
            result = await self.database[JOBS].update_one(
                {"job_id": actual_job_id},
                {
                    "$set": {
                        "status": "COMPLETED",
                        "leader_address": payload.leader_address,
                        "verifier_addresses": payload.verifier_addresses,
                        "result_hash": payload.result_hash,
                        "output_cid": payload.output_cid,
                        "encrypted_output_key_high": payload.encrypted_output_key_high,
                        "encrypted_output_key_low": payload.encrypted_output_key_low,
                        "rewards_distributed": reward_result.get("status") == "distributed",
                        "reward_tx_hashes": [
                            d.get("tx_hash")
                            for d in reward_result.get("distributions", [])
                            if d.get("tx_hash")
                        ],
                        "rewards": rewards_map,
                        "claim_result": claim_result,
                        "updated_at": now,
                    }
                },
            )
            if result.matched_count == 0:
                logger.error("Job update failed: no document matched for job_id=%s", actual_job_id)
                raise RuntimeError(f"Job update failed for {actual_job_id}")

            return {
                "job_id": actual_job_id,
                "status": "COMPLETED",
                "rewards": reward_result,
                "claim_result": claim_result,
            }

        else:  # timeout or rejected
            # Refund credits only for credits mode (escrow funds are resolved on-chain)
            if payment_mode == "credits" and (amount_cusdc > 0 or amount_blind > 0):
                try:
                    await self.credit_service.refund(
                        user_address=user_address,
                        amount_cusdc=str(amount_cusdc),
                        amount_blind=str(amount_blind),
                        reason=f"job_{payload.status}:{actual_job_id}",
                    )
                except Exception as exc:
                    logger.error("Refund failed for job=%s: %s", actual_job_id, exc)

            # Record failures for timed-out nodes
            if payload.status == "timeout":
                await self._record_node_failures(
                    [payload.leader_address] + payload.verifier_addresses
                )

            result = await self.database[JOBS].update_one(
                {"job_id": actual_job_id},
                {
                    "$set": {
                        "status": "FAILED" if payload.status == "timeout" else "REFUNDED",
                        "error_reason": payload.error_reason or payload.status,
                        "leader_address": payload.leader_address,
                        "verifier_addresses": payload.verifier_addresses,
                        "updated_at": now,
                    }
                },
            )
            if result.matched_count == 0:
                logger.error("Job update failed: no document matched for job_id=%s", actual_job_id)
                raise RuntimeError(f"Job update failed for {actual_job_id}")

            return {
                "job_id": actual_job_id,
                "status": "FAILED" if payload.status == "timeout" else "REFUNDED",
                "refunded_cusdc": amount_cusdc,
                "refunded_blind": amount_blind,
            }

    async def _distribute_rewards(
        self,
        job_id: str,
        leader_address: str,
        verifier_addresses: list[str],
    ) -> dict[str, Any]:
        """Distribute BLIND rewards to participating nodes.

        Reads the actual job price from the database; falls back to 1 BLIND
        if no record is found or amount_blind is zero.
        """
        job = await self.get_job_by_any_id(job_id)
        if job is None:
            logger.warning("No job record found for reward distribution: %s", job_id)
            amount_blind_wei = 1 * 10 ** 18  # fallback: 1 BLIND
        else:
            amount_blind_wei = int(job.get("amount_blind", 0))
            if amount_blind_wei == 0:
                amount_blind_wei = 1 * 10 ** 18  # fallback: 1 BLIND
        try:
            result = await self.chain_service.distribute_reward(
                leader_address=leader_address,
                verifier_addresses=verifier_addresses,
                amount_blind_wei=amount_blind_wei,
                job_id=job_id,
            )
            logger.info(
                "Rewards distributed for job=%s: status=%s distributions=%d",
                job_id,
                result.get("status"),
                len(result.get("distributions", [])),
            )
            return result
        except Exception as exc:
            logger.error("Reward distribution failed for job=%s: %s", job_id, exc)
            return {"status": "failed", "job_id": job_id, "error": str(exc)}

    async def _reset_node_failures(self, node_addresses: list[str]) -> None:
        """Reset consecutive failure counters for successful nodes."""
        # TODO: integrate with BlindferenceStaking.resetFailures()
        # For now, just log
        for addr in node_addresses:
            logger.info("Resetting failures for node %s", addr)

    async def _record_node_failures(self, node_addresses: list[str]) -> None:
        """Record failures for timed-out nodes and slash if ≥3."""
        # TODO: integrate with BlindferenceStaking.recordFailure()
        # For now, just log
        for addr in node_addresses:
            logger.warning("Recording failure for node %s", addr)
