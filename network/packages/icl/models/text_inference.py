from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class EncryptedPromptKey(BaseModel):
    high: str = Field(..., description="FHE-encrypted high 128 bits of the AES key (bigint string)")
    low: str = Field(..., description="FHE-encrypted low 128 bits of the AES key (bigint string)")


class TextInferenceRequest(BaseModel):
    prompt_cid: str = Field(..., description="IPFS CID of the AES-GCM encrypted prompt blob")
    encrypted_prompt_key: EncryptedPromptKey
    model_id: str | None = None
    coverage_enabled: bool = False


class QuorumCertificate(BaseModel):
    verifier_addresses: list[str]
    confirmations: int
    confidence: int


class LeaderSubmissionResponse(BaseModel):
    leader_address: str
    risk_score: int | None = None
    confidence: int | None = None
    summary: str | None = None
    provider: str | None = None
    model: str | None = None
    result_hash: str | None = None
    submitted_at: datetime | None = None


class VerifierVerdictResponse(BaseModel):
    verifier_address: str
    submitted: bool = False
    accepted: bool | None = None
    confidence: int | None = None
    reason: str | None = None
    risk_score: int | None = None
    result_hash: str | None = None
    provider: str | None = None
    model: str | None = None
    summary: str | None = None
    updated_at: datetime | None = None


class TextInferenceResult(BaseModel):
    job_id: str
    status: str
    output_cid: str | None = None
    commitment_hash: str | None = None
    encrypted_output_key_high: str | None = None
    encrypted_output_key_low: str | None = None
    quorum: QuorumCertificate | None = None
    dispute_deadline: int | None = None
    leader_submission: LeaderSubmissionResponse | None = None
    verifier_verdicts: list[VerifierVerdictResponse] = Field(default_factory=list)
    rejection_reason: str | None = None
