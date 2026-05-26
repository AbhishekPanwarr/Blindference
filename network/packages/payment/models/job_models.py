from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class JobSubmitRequest(BaseModel):
    """Request body for submitting a new inference job."""

    user_address: str
    prompt_cid: str
    model_id: str
    encrypted_prompt_key_high: str
    encrypted_prompt_key_low: str
    payment_mode: Literal["credits", "escrow"] = "credits"
    payment_currency: Literal["cusdc", "blind"] = "cusdc"
    insurance_opt_in: bool = False
    # Optional: deterministic task_id for on-chain key storage (bytes32 hex).
    # If omitted, the ICL will generate one internally.
    task_id: str | None = None
    # Optional: pre-created escrow ID for escrow payment mode
    escrow_id: str | None = None
    # Optional fields forwarded to ICL
    permits: list[dict] = Field(default_factory=list)
    min_tier: int = 0
    zdr_required: bool = False
    verifier_count: int = 2
    metadata: dict = Field(default_factory=dict)


class JobRecord(BaseModel):
    """MongoDB document schema for a job."""

    job_id: str
    user_address: str
    model_id: str
    amount_cusdc: str = "0"
    amount_blind: str = "0"
    insurance_opt_in: bool = False
    insurance_premium_cusdc: str = "0"
    escrow_id: int | None = None
    coverage_id: int | None = None
    status: Literal["PENDING_PAYMENT", "RUNNING", "COMPLETED", "FAILED", "REFUNDED"] = "PENDING_PAYMENT"
    leader_address: str | None = None
    verifier_addresses: list[str] = Field(default_factory=list)
    error_reason: str | None = None
    result_hash: str | None = None
    output_cid: str | None = None
    encrypted_output_key_high: str | None = None
    encrypted_output_key_low: str | None = None
    rewards_distributed: bool = False
    reward_tx_hashes: list[str] = Field(default_factory=list)
    rewards: dict[str, float] = Field(default_factory=dict)
    task_id: str | None = None
    created_at: datetime
    updated_at: datetime


class JobCompletionRequest(BaseModel):
    """Request body for ICL to report job completion."""

    status: Literal["success", "timeout", "rejected"]
    leader_address: str
    verifier_addresses: list[str]
    error_reason: str | None = None
    result_hash: str | None = None
    output_cid: str | None = None
    encrypted_output_key_high: str | None = None
    encrypted_output_key_low: str | None = None
