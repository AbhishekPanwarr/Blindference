from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

logger = logging.getLogger("blindference.icl.chain")

from eth_account import Account

from chain.agent_config_registry import AgentConfigRegistryClient
from chain.execution_commitment_registry import (
    ROLE_CROSS_VERIFIER,
    ROLE_EXECUTOR,
    ExecutionCommitmentRegistryClient,
)
from chain.node_attestation_registry import NodeAttestationRegistryClient
from chain.prompt_key_store import PromptKeyStoreClient
from chain.result_registry import ResultRegistryClient
from chain.reputation_registry import ReputationRegistryClient
from chain.reward_accumulator import RewardAccumulatorClient
from chain.web3_client import Web3Client
from config import Settings
from db.collections import OPERATORS
from models.db_models import OperatorRecord

PUBLIC_COUNTERPARTY = "0x0000000000000000000000000000000000000000"
NODE_AVAILABILITY_ATTESTATION = "blindference.node.availability.v1"
SECONDS_PER_DAY = 86_400
TIER_MIN_STAKE = {
    0: 5_000,
    1: 15_000,
    2: 50_000,
}


class ChainService:
    def __init__(self, settings: Settings, database):
        self.settings = settings
        self.database = database
        self.web3_client = Web3Client(settings)
        self.node_attestation_registry = NodeAttestationRegistryClient(self.web3_client, settings)
        self.execution_commitment_registry = ExecutionCommitmentRegistryClient(self.web3_client, settings)
        self.prompt_key_store = PromptKeyStoreClient(self.web3_client, settings)
        self.agent_config_registry = AgentConfigRegistryClient(self.web3_client, settings)
        self.reputation_registry = ReputationRegistryClient(self.web3_client, settings)
        self.reward_accumulator = RewardAccumulatorClient(self.web3_client, settings)
        self.result_registry = ResultRegistryClient(self.web3_client, settings)
        self._mock_invocations: dict[int, dict[str, Any]] = {}
        self._mock_prompt_key_stores: dict[str, dict[str, Any]] = {}

    async def is_connected(self) -> bool:
        if self.settings.MOCK_CHAIN:
            return True
        return await asyncio.to_thread(self.web3_client.is_connected)

    async def model_registry_ready(self) -> bool:
        if self.settings.MOCK_CHAIN:
            return True
        return await asyncio.to_thread(self.agent_config_registry.is_deployed)

    async def reward_accumulator_ready(self) -> bool:
        if self.settings.MOCK_CHAIN:
            return True
        return await asyncio.to_thread(self.reward_accumulator.is_deployed)

    async def get_active_nodes(self, min_tier: int, zdr_required: bool) -> list[str]:
        now = datetime.now(timezone.utc)
        active_addresses: list[str] = []

        cursor = self.database[OPERATORS].find({})
        async for operator in cursor:
            if not operator.get("active", False):
                continue
            if max(operator.get("model_tiers", [-1])) < min_tier:
                continue
            if zdr_required and not operator.get("zdr_compliant", False):
                continue

            heartbeat = operator.get("last_heartbeat", now)
            if isinstance(heartbeat, str):
                heartbeat = datetime.fromisoformat(heartbeat.replace("Z", "+00:00"))
            if isinstance(heartbeat, datetime) and heartbeat.tzinfo is None:
                heartbeat = heartbeat.replace(tzinfo=timezone.utc)
            heartbeat_stale = (now - heartbeat).total_seconds() > self.settings.HEARTBEAT_GRACE_SECONDS

            # Attestation expiry fallback — if attestation is still valid,
            # allow the node even if heartbeats were missed (e.g. ICL downtime).
            attestation_expires_at = operator.get("attestation_expires_at")
            attestation_still_valid = False
            if attestation_expires_at is not None:
                if isinstance(attestation_expires_at, str):
                    attestation_expires_at = datetime.fromisoformat(
                        attestation_expires_at.replace("Z", "+00:00")
                    )
                if isinstance(attestation_expires_at, datetime):
                    attestation_still_valid = attestation_expires_at > now
                elif isinstance(attestation_expires_at, (int, float)):
                    attestation_still_valid = attestation_expires_at > now.timestamp()

            # Node is excluded only if BOTH heartbeat is stale AND attestation expired.
            if heartbeat_stale and not attestation_still_valid:
                continue

            # Mock-attested nodes are always considered valid — the on-chain
            # NodeAttestationRegistry does not recognise mock quotes.
            if self.settings.MOCK_CHAIN or operator.get("attestation_type") == "mock":
                is_valid = True
            else:
                is_valid = await asyncio.to_thread(
                    self.node_attestation_registry.has_valid,
                    operator["operator_address"],
                    operator["attestation_type"],
                    operator["attestation_counterparty"],
                )
            if is_valid:
                active_addresses.append(self.web3_client.checksum_address(operator["operator_address"]))

        return active_addresses

    async def get_node_snapshot(self, node_address: str) -> dict[str, Any]:
        operator = await self.database[OPERATORS].find_one(
            {"operator_address": self.web3_client.checksum_address(node_address)}
        )
        if operator is None:
            raise KeyError(f"node {node_address} not found")

        reputation = (
            {"score": max(operator.get("tasks_accepted", 0), 1), "cycles_guilty": operator.get("tasks_rejected", 0)}
            if self.settings.MOCK_CHAIN
            else await asyncio.to_thread(
                self.reputation_registry.reputation_of,
                operator["operator_address"],
            )
        )
        # Mock-attested nodes are always considered valid — the on-chain
        # NodeAttestationRegistry does not recognise mock quotes.
        if self.settings.MOCK_CHAIN or operator.get("attestation_type") == "mock":
            is_valid = True
        else:
            is_valid = await asyncio.to_thread(
                self.node_attestation_registry.has_valid,
                operator["operator_address"],
                operator["attestation_type"],
                operator["attestation_counterparty"],
            )
        heartbeat = operator["last_heartbeat"]
        registered_at = operator["registered_at"]
        if isinstance(heartbeat, str):
            heartbeat = datetime.fromisoformat(heartbeat.replace("Z", "+00:00"))
        if isinstance(heartbeat, datetime) and heartbeat.tzinfo is None:
            heartbeat = heartbeat.replace(tzinfo=timezone.utc)
        if isinstance(registered_at, str):
            registered_at = datetime.fromisoformat(registered_at.replace("Z", "+00:00"))
        if isinstance(registered_at, datetime) and registered_at.tzinfo is None:
            registered_at = registered_at.replace(tzinfo=timezone.utc)

        now = datetime.now(timezone.utc)
        is_recent = (now - heartbeat).total_seconds() <= self.settings.HEARTBEAT_GRACE_SECONDS

        return {
            "operator_address": operator["operator_address"],
            "model_tiers": list(operator["model_tiers"]),
            "location": operator["location"],
            "zdr_compliant": bool(operator["zdr_compliant"]),
            "jurisdiction": operator["jurisdiction"],
            "min_stake": int(operator["min_stake"]),
            "registered_at": int(registered_at.timestamp()),
            "last_heartbeat": int(heartbeat.timestamp()),
            "active": bool(operator["active"]) and is_valid and is_recent,
            "metrics": {
                "tasks_completed": int(operator.get("tasks_completed", 0)),
                "tasks_accepted": int(operator.get("tasks_accepted", 0)),
                "tasks_rejected": int(operator.get("tasks_rejected", 0)),
                "reputation_score": int(reputation["score"]) * 100,
                "total_slash_amount": int(reputation["cycles_guilty"]),
                "last_heartbeat": int(heartbeat.timestamp()),
            },
        }

    async def register_task(
        self,
        *,
        task_id: str,
        developer_address: str,
        leader_address: str,
        cross_verifier_address: str,
        model_id: str,
    ) -> dict[str, Any]:
        del developer_address
        invocation_id = self.web3_client.task_id_to_invocation_id(task_id)
        if self.settings.MOCK_CHAIN:
            self._mock_invocations[invocation_id] = {
                "status": "dispatched",
                "executor": leader_address,
                "cross_verifier": cross_verifier_address,
                "agent_id": self._agent_id_for_model(model_id),
                "verified_output": None,
                "tx_hash": None,
                "escrow_id": invocation_id,
            }
            return {"invocation_id": invocation_id, "tx_hash": None, "status": "dispatched"}
        current_status = await asyncio.to_thread(
            self.execution_commitment_registry.status_of,
            invocation_id,
        )
        if current_status != "none":
            return {"invocation_id": invocation_id, "tx_hash": None, "status": current_status}

        commit_deadline = int(
            (datetime.now(timezone.utc) + timedelta(seconds=self.settings.EXECUTION_COMMIT_WINDOW_SECONDS)).timestamp()
        )
        reveal_deadline = commit_deadline + self.settings.EXECUTION_REVEAL_WINDOW_SECONDS
        tx_result = await asyncio.to_thread(
            self.execution_commitment_registry.dispatch,
            invocation_id=invocation_id,
            escrow_id=invocation_id,
            agent_id=self._agent_id_for_model(model_id),
            executor=leader_address,
            cross_verifier=cross_verifier_address,
            commit_deadline=commit_deadline,
            reveal_deadline=reveal_deadline,
        )
        return {
            "invocation_id": invocation_id,
            "tx_hash": tx_result["tx_hash"],
            "status": "dispatched",
        }

    async def grant_permit(
        self,
        node_address: str,
        encrypted_features: list[dict[str, str | int]],
        metadata: dict[str, Any] | None = None,
    ) -> list[dict[str, str]]:
        node = self.web3_client.checksum_address(node_address)
        metadata = metadata or {}
        shared_permits = metadata.get("cofhe_shared_permits", {})
        serialized_permit = None
        if isinstance(shared_permits, dict):
            serialized_permit = (
                shared_permits.get(node)
                or shared_permits.get(node.lower())
                or shared_permits.get("*")
            )

        permits: list[dict[str, str]] = []
        for feature in encrypted_features:
            ct_hash = str(feature["ctHash"])
            if self.settings.MOCK_CHAIN:
                status = "granted-mock"
            elif serialized_permit:
                status = "shared-permit-attached"
            else:
                status = "missing-user-shared-permit"
            permits.append(
                {
                    "ct_hash": ct_hash,
                    "grantee": node,
                    "status": status,
                    "permit": str(serialized_permit) if serialized_permit else "",
                }
            )
        return permits

    async def store_text_prompt_key(
        self,
        *,
        task_id: str,
        encrypted_high_input: dict[str, Any],
        encrypted_low_input: dict[str, Any],
        allowed_nodes: list[str],
    ) -> dict[str, Any]:
        normalized_nodes = [self.web3_client.checksum_address(address) for address in allowed_nodes]
        if self.settings.MOCK_CHAIN:
            tx_hash = self.web3_client.ensure_hex_prefix(
                self.web3_client.keccak_text(f"mock-prompt-key-store:{task_id}:{':'.join(normalized_nodes)}")
            )
            self._mock_prompt_key_stores[task_id] = {
                "encrypted_high_input": encrypted_high_input,
                "encrypted_low_input": encrypted_low_input,
                "allowed_nodes": normalized_nodes,
                "tx_hash": tx_hash,
            }
            return {
                "tx_hash": tx_hash,
                "status": "stored",
                "stored_high_handle": str(encrypted_high_input["ctHash"]),
                "stored_low_handle": str(encrypted_low_input["ctHash"]),
            }

        if not self.prompt_key_store.enabled:
            raise ValueError(
                "PROMPT_KEY_STORE_ADDRESS is not configured; cannot store text prompt keys on-chain"
            )

        tx_result = await asyncio.to_thread(
            self.prompt_key_store.store_key,
            job_id=task_id,
            encrypted_high_input=encrypted_high_input,
            encrypted_low_input=encrypted_low_input,
            allowed_nodes=normalized_nodes,
        )
        stored_handles = await asyncio.to_thread(
            self.prompt_key_store.get_encrypted_key_handles,
            job_id=task_id,
        )
        return {
            "tx_hash": tx_result["tx_hash"],
            "status": "stored",
            "stored_high_handle": stored_handles["high"],
            "stored_low_handle": stored_handles["low"],
        }

    async def get_text_prompt_key_handles(self, *, task_id: str) -> dict[str, str]:
        if self.settings.MOCK_CHAIN:
            stored = self._mock_prompt_key_stores.get(task_id)
            if stored is None:
                raise KeyError(f"mock prompt key for task {task_id} not found")
            return {
                "high": str(stored["encrypted_high_input"]["ctHash"]),
                "low": str(stored["encrypted_low_input"]["ctHash"]),
            }

        if not self.prompt_key_store.enabled:
            raise ValueError(
                "PROMPT_KEY_STORE_ADDRESS is not configured; cannot read text prompt keys on-chain"
            )

        return await asyncio.to_thread(
            self.prompt_key_store.get_encrypted_key_handles,
            job_id=task_id,
        )

    async def store_output_key(
        self,
        *,
        task_id: str,
        high_handle: int,
        low_handle: int,
        user_address: str,
    ) -> dict[str, Any]:
        """Store the leader's encrypted output key on-chain via PromptKeyStore.storeOutputKey.

        The contract enforces onlyICL, so this must be called by the ICL coordinator wallet.
        """
        if self.settings.MOCK_CHAIN:
            tx_hash = self.web3_client.ensure_hex_prefix(
                self.web3_client.keccak_text(f"mock-output-key-store:{task_id}")
            )
            return {
                "tx_hash": tx_hash,
                "status": "stored",
                "stored_high_handle": str(high_handle),
                "stored_low_handle": str(low_handle),
            }

        if not self.prompt_key_store.enabled:
            raise ValueError(
                "PROMPT_KEY_STORE_ADDRESS is not configured; cannot store output key on-chain"
            )

        return await asyncio.to_thread(
            self.prompt_key_store.store_output_key,
            job_id=task_id,
            high_handle=high_handle,
            low_handle=low_handle,
            user_address=user_address,
        )

    async def grant_prompt_key_access(
        self,
        *,
        job_id: str,
        node_address: str,
    ) -> dict[str, Any]:
        """Grant CoFHE decryption access to a node after it claims a job.

        Calls PromptKeyStore.grantDecryptAccess(jobId, node) on-chain.
        Returns silently if the contract is not deployed or in mock mode.
        """
        try:
            if self.settings.MOCK_CHAIN:
                return {"status": "granted-mock"}

            if not self.prompt_key_store.enabled:
                return {"status": "skipped-no-contract"}

            tx_result = await asyncio.to_thread(
                self.prompt_key_store.grant_decrypt_access,
                job_id=job_id,
                node_address=node_address,
            )
            return {"status": "granted", "tx_hash": tx_result.get("tx_hash")}
        except Exception as exc:
            logger.warning(
                "grantDecryptAccess failed for job %s, node %s: %s",
                job_id, node_address, exc,
            )
            return {"status": "skipped-error"}

    async def finalize_execution(
        self,
        *,
        task_id: str,
        result_hash: str,
        leader: str,
        cross_verifier: str,
        accepted: bool,
    ) -> dict[str, Any]:
        invocation_id = self.web3_client.task_id_to_invocation_id(task_id)
        if self.settings.MOCK_CHAIN:
            status = "verified" if accepted else "escalated"
            tx_hash = self.web3_client.ensure_hex_prefix(
                self.web3_client.keccak_text(f"mock-chain:{task_id}:{result_hash}:{status}")
            )
            self._mock_invocations[invocation_id] = {
                **self._mock_invocations.get(invocation_id, {}),
                "status": status,
                "executor": leader,
                "cross_verifier": cross_verifier,
                "verified_output": result_hash,
                "tx_hash": tx_hash,
                "escrow_id": invocation_id,
            }
            result = await self.get_result(task_id)
            result["tx_hash"] = tx_hash
            return result
        leader_private_key = self._private_key_for_operator(leader)
        verifier_private_key = self._private_key_for_operator(cross_verifier)

        leader_salt = self.web3_client.keccak_text(f"{task_id}:{leader}:executor")
        verifier_salt = self.web3_client.keccak_text(f"{task_id}:{cross_verifier}:verifier")
        verifier_output = (
            result_hash
            if accepted
            else self.web3_client.keccak_text(f"blindference:reject:{task_id}:{result_hash}")
        )

        leader_digest = await asyncio.to_thread(
            self.execution_commitment_registry.commit_digest,
            role=ROLE_EXECUTOR,
            node=leader,
            output_handle=result_hash,
            salt=leader_salt,
        )
        verifier_digest = await asyncio.to_thread(
            self.execution_commitment_registry.commit_digest,
            role=ROLE_CROSS_VERIFIER,
            node=cross_verifier,
            output_handle=verifier_output,
            salt=verifier_salt,
        )

        await asyncio.to_thread(
            self.execution_commitment_registry.commit,
            invocation_id=invocation_id,
            role=ROLE_EXECUTOR,
            digest=leader_digest,
            private_key=leader_private_key,
        )
        await asyncio.to_thread(
            self.execution_commitment_registry.commit,
            invocation_id=invocation_id,
            role=ROLE_CROSS_VERIFIER,
            digest=verifier_digest,
            private_key=verifier_private_key,
        )
        await asyncio.to_thread(
            self.execution_commitment_registry.reveal,
            invocation_id=invocation_id,
            role=ROLE_EXECUTOR,
            output_handle=result_hash,
            salt=leader_salt,
            private_key=leader_private_key,
        )
        final_tx = await asyncio.to_thread(
            self.execution_commitment_registry.reveal,
            invocation_id=invocation_id,
            role=ROLE_CROSS_VERIFIER,
            output_handle=verifier_output,
            salt=verifier_salt,
            private_key=verifier_private_key,
        )

        result = await self.get_result(task_id)
        result["tx_hash"] = final_tx["tx_hash"]
        return result

    async def is_execution_valid(self, task_id: str) -> bool:
        result = await self.get_result(task_id)
        return result["status"] == "verified"

    async def get_result(self, task_id: str) -> dict[str, Any]:
        invocation_id = self.web3_client.task_id_to_invocation_id(task_id)
        if self.settings.MOCK_CHAIN:
            invocation = dict(self._mock_invocations.get(invocation_id, {}))
            invocation.setdefault("status", "none")
            invocation.setdefault("verified_output", None)
            invocation.setdefault("executor", "0x0000000000000000000000000000000000000000")
            invocation.setdefault("cross_verifier", "0x0000000000000000000000000000000000000000")
            invocation.setdefault("agent_id", 0)
            invocation.setdefault("escrow_id", invocation_id)
            invocation["invocation_id"] = invocation_id
            return invocation
        invocation = await asyncio.to_thread(
            self.execution_commitment_registry.invocation,
            invocation_id,
        )
        verified_output = await asyncio.to_thread(
            self.execution_commitment_registry.verified_output,
            invocation_id,
        )
        invocation["invocation_id"] = invocation_id
        invocation["verified_output"] = verified_output
        return invocation

    async def bootstrap_demo_nodes(self, count: int = 3) -> dict[str, list[str]]:
        templates = [
            {
                "private_key": private_key,
                "model_tiers": [2] if index == 0 else [1],
                "location": ["US-WEST", "US-EAST", "EU-CENTRAL"][index],
                "zdr_compliant": index != 2,
                "jurisdiction": ["US-CA", "US-NY", "DE-BE"][index],
            }
            for index, private_key in enumerate(self.settings.demo_operator_private_keys[:count])
        ]

        registered_addresses: list[str] = []
        tx_hashes: list[str] = []

        for template in templates:
            operator = self.web3_client.account_from_private_key(template["private_key"])
            operator_address = self.web3_client.checksum_address(operator.address)
            now = int(datetime.now(timezone.utc).timestamp())
            effective_at = now
            expires_at = now + (30 * SECONDS_PER_DAY)
            attestation_type = self.web3_client.keccak_text(NODE_AVAILABILITY_ATTESTATION)
            metadata = {
                "operator_address": operator_address,
                "model_tiers": template["model_tiers"],
                "location": template["location"],
                "zdr_compliant": template["zdr_compliant"],
                "jurisdiction": template["jurisdiction"],
            }
            document_hash = self.web3_client.keccak_text(json.dumps(metadata, sort_keys=True))
            if self.settings.MOCK_CHAIN:
                tx_result = {
                    "tx_hash": self.web3_client.ensure_hex_prefix(
                        self.web3_client.keccak_text(f"mock-attestation:{operator_address}:{now}")
                    )
                }
            else:
                digest = await asyncio.to_thread(
                    self.node_attestation_registry.digest,
                    node_address=operator_address,
                    attestation_type=attestation_type,
                    document_hash=document_hash,
                    counterparty=PUBLIC_COUNTERPARTY,
                    effective_at=effective_at,
                    expires_at=expires_at,
                )
                signature = self.web3_client.sign_digest(digest, private_key=template["private_key"])
                tx_result = await asyncio.to_thread(
                    self.node_attestation_registry.commit,
                    node_address=operator_address,
                    attestation_type=attestation_type,
                    document_hash=document_hash,
                    counterparty=PUBLIC_COUNTERPARTY,
                    effective_at=effective_at,
                    expires_at=expires_at,
                    signature=bytes(signature),
                )

            operator_record = OperatorRecord(
                operator_address=operator_address,
                model_tiers=template["model_tiers"],
                location=template["location"],
                zdr_compliant=template["zdr_compliant"],
                jurisdiction=template["jurisdiction"],
                min_stake=self._min_stake_for_tiers(template["model_tiers"]),
                registered_at=datetime.now(timezone.utc),
                last_heartbeat=datetime.now(timezone.utc),
                attestation_type=attestation_type,
                attestation_document_hash=document_hash,
                attestation_effective_at=effective_at,
                attestation_expires_at=expires_at,
                active=True,
            )
            await self.database[OPERATORS].update_one(
                {"operator_address": operator_address},
                {"$set": operator_record.model_dump()},
                upsert=True,
            )

            registered_addresses.append(operator_address)
            tx_hashes.append(tx_result["tx_hash"])

        return {
            "registered_addresses": registered_addresses,
            "tx_hashes": tx_hashes,
        }

    async def record_quorum_outcome(self, leader: str, verifiers: list[str], accepted: bool) -> None:
        await self._increment_operator_metrics(leader, accepted)
        for verifier in verifiers:
            await self._increment_operator_metrics(verifier, True)

    async def refresh_operator_heartbeat(self, operator_address: str) -> None:
        checksum_address = self.web3_client.checksum_address(operator_address)
        await self.database[OPERATORS].update_one(
            {"operator_address": checksum_address},
            {
                "$set": {
                    "last_heartbeat": datetime.now(timezone.utc),
                    "active": True,
                }
            },
        )

    async def register_attested_operator(
        self,
        *,
        operator_address: str,
        tier: int,
        attestation_type: str,
        attestation_document_hash: str,
        attestation_expires_at: int,
        supported_model_ids: list[str] | None = None,
    ) -> None:
        """Create or update an operator record after successful attestation.

        Uses the same ``OperatorRecord`` model + ``model_dump()`` pattern as
        ``bootstrap_demo_nodes`` so all downstream code handles the serialized
        fields identically.
        """
        checksum = self.web3_client.checksum_address(operator_address)
        now = int(datetime.now(timezone.utc).timestamp())

        model_tiers = [tier] if tier >= 0 else [0]

        operator_record = OperatorRecord(
            operator_address=checksum,
            model_tiers=model_tiers,
            supported_model_ids=list(supported_model_ids) if supported_model_ids else [],
            location="unknown",
            zdr_compliant=False,
            jurisdiction="global",
            min_stake=0,
            registered_at=datetime.now(timezone.utc),
            last_heartbeat=datetime.now(timezone.utc),
            attestation_type=self.web3_client.keccak_text(NODE_AVAILABILITY_ATTESTATION),
            attestation_document_hash=self.web3_client.keccak_text(attestation_document_hash),
            attestation_counterparty=PUBLIC_COUNTERPARTY,
            attestation_effective_at=now,
            attestation_expires_at=attestation_expires_at,
            tasks_completed=0,
            tasks_accepted=0,
            tasks_rejected=0,
            active=True,
        )

        await self.database[OPERATORS].update_one(
            {"operator_address": checksum},
            {"$set": operator_record.model_dump()},
            upsert=True,
        )
        logger.info("Operator %s registered after attestation (tier=%d)", checksum, tier)

    async def _increment_operator_metrics(self, operator_address: str, accepted: bool) -> None:
        operator = await self.database[OPERATORS].find_one(
            {"operator_address": self.web3_client.checksum_address(operator_address)}
        )
        if operator is None:
            return
        tasks_completed = int(operator.get("tasks_completed", 0)) + 1
        tasks_accepted = int(operator.get("tasks_accepted", 0)) + (1 if accepted else 0)
        tasks_rejected = int(operator.get("tasks_rejected", 0)) + (0 if accepted else 1)
        await self.database[OPERATORS].update_one(
            {"operator_address": operator["operator_address"]},
            {
                "$set": {
                    "tasks_completed": tasks_completed,
                    "tasks_accepted": tasks_accepted,
                    "tasks_rejected": tasks_rejected,
                    "last_heartbeat": datetime.now(timezone.utc),
                }
            },
        )

    async def write_result_to_registry(
        self,
        *,
        task_id: str,
        result_hash: str,
        leader: str,
        verifiers: list[str],
        accepted: bool,
        model_id: str,
        rejection_reason: str | None = None,
    ) -> dict[str, Any]:
        """Write the verification outcome to the on‑chain ResultRegistry.

        This is the trigger for Reineira settlement — InferenceGate reads
        ResultRegistry.isConditionMet() to decide if the escrow should release.
        """
        if self.settings.MOCK_CHAIN:
            logger.info("ResultRegistry write skipped (mock chain): task=%s accepted=%s", task_id, accepted)
            return {"status": "mock"}

        if not self.result_registry.enabled:
            logger.warning("ResultRegistry not configured — settlement will not work")
            return {"status": "skipped"}

        if accepted:
            return await asyncio.to_thread(
                self.result_registry.commit_result,
                task_id=task_id,
                result_hash=result_hash,
                leader=leader,
                verifiers=verifiers,
                confirm_count=2,
                reject_count=0,
                aggregated_confidence=95,
                model_id=model_id,
            )
        else:
            return await asyncio.to_thread(
                self.result_registry.commit_rejection,
                task_id=task_id,
                leader=leader,
                verifiers=verifiers,
                model_id=model_id,
                reason=rejection_reason or "quorum rejected",
            )

    def _private_key_for_operator(self, operator_address: str) -> str:
        target = self.web3_client.checksum_address(operator_address)
        for private_key in self.settings.demo_operator_private_keys:
            account = Account.from_key(private_key)
            if self.web3_client.checksum_address(account.address) == target:
                return private_key
        raise KeyError(f"missing private key for operator {operator_address}")

    def _agent_id_for_model(self, model_id: str) -> int:
        if "gemini" in model_id.lower():
            return 2
        return 1

    def _min_stake_for_tiers(self, model_tiers: list[int]) -> int:
        return max((TIER_MIN_STAKE.get(tier, 0) for tier in model_tiers), default=0)
