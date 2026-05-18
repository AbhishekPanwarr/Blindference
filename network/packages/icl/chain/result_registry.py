"""Client for Blindference ResultRegistry — on-chain inference result storage."""

from __future__ import annotations

from typing import Any

from chain.web3_client import Web3Client
from config import Settings


class ResultRegistryClient:
    """Wraps calls to ``ResultRegistry`` for recording verified inference outcomes."""

    def __init__(self, web3_client: Web3Client, settings: Settings):
        self._web3 = web3_client
        self._settings = settings
        addr = getattr(settings, "RESULT_REGISTRY_ADDRESS", None)
        if addr:
            self._contract = web3_client.get_contract("ResultRegistry", addr)
        else:
            self._contract = None

    @property
    def enabled(self) -> bool:
        return self._contract is not None

    def commit_result(
        self,
        *,
        task_id: str,
        result_hash: str,
        leader: str,
        verifiers: list[str],
        confirm_count: int,
        reject_count: int,
        aggregated_confidence: int,
        model_id: str,
    ) -> dict[str, Any]:
        """Mark a task as accepted in ResultRegistry.

        Calls ``ResultRegistry.commitResult(taskId, resultHash, leader, verifiers, confirms, rejects, confidence, modelId)``.
        Only callable by the ICL service address (``onlyIclService`` modifier).
        """
        if not self.enabled:
            return {"status": "skipped", "reason": "ResultRegistry not configured"}

        function = self._contract.functions.commitResult(
            self._web3.ensure_bytes32(task_id),
            self._web3.ensure_bytes32(result_hash),
            self._web3.checksum_address(leader),
            [self._web3.checksum_address(v) for v in verifiers],
            confirm_count,
            reject_count,
            aggregated_confidence,
            self._web3.ensure_bytes32(model_id),
        )
        return self._web3.send_transaction(function)

    def commit_rejection(
        self,
        *,
        task_id: str,
        leader: str,
        verifiers: list[str],
        model_id: str,
        reason: str,
    ) -> dict[str, Any]:
        """Mark a task as rejected in ResultRegistry."""
        if not self.enabled:
            return {"status": "skipped"}

        function = self._contract.functions.commitRejection(
            self._web3.ensure_bytes32(task_id),
            self._web3.checksum_address(leader),
            [self._web3.checksum_address(v) for v in verifiers],
            self._web3.ensure_bytes32(model_id),
            reason,
        )
        return self._web3.send_transaction(function)

    def is_condition_met(self, task_id: str) -> bool:
        """Check if a task is in ACCEPTED status."""
        if not self.enabled:
            return False
        try:
            return self._contract.functions.isConditionMet(
                self._web3.ensure_bytes32(task_id), 70, 2
            ).call()
        except Exception:
            return False
