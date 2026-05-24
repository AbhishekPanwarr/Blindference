from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class PaymentServiceSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().with_name(".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    MONGO_URI: str = "mongodb://localhost:27017"
    MONGO_DB_NAME: str = "blindference_payments"

    ARBITRUM_SEPOLIA_RPC: str = "http://127.0.0.1:8545"
    ICL_WALLET_PRIVATE_KEY: str = Field(default="", validation_alias="ICL_PRIVATE_KEY")
    BLIND_TOKEN_ADDRESS: str = "0x0000000000000000000000000000000000000000"
    CUSDC_TOKEN_ADDRESS: str = "0x42E47f9bA89712C317f60A72C81A610A2b68c48a"
    PAYOUT_CLAIMER_ADDRESS: str = "0x0000000000000000000000000000000000000000"
    INFERENCE_GATE_ADDRESS: str = "0x0000000000000000000000000000000000000000"

    BLIND_USD_RATE: float = 0.01
    BLIND_PAYMENT_DISCOUNT: float = 0.20
    JOB_PRICE_CUSDC: dict[str, int] = {
        "qwen2.5-7b": 1_000,
        "groq:llama-3.3-70b-versatile": 5_000,
        "gemini:gemini-2.5-flash": 3_000,
    }

    # Wallet that receives BLIND for package purchases (same as ICL wallet for testnet)
    PAYMENT_WALLET_ADDRESS: str = ""

    # Credit packages available for purchase
    CREDIT_PACKAGES: list[dict[str, Any]] = Field(default=[
        {
            "id": "starter",
            "name": "Starter",
            "base_calls": 100,
            "price_blind_wei": 100 * 10**18,
            "bonus_percent": 0,
        },
        {
            "id": "pro",
            "name": "Pro",
            "base_calls": 500,
            "price_blind_wei": 450 * 10**18,
            "bonus_percent": 5,
        },
        {
            "id": "enterprise",
            "name": "Enterprise",
            "base_calls": 5000,
            "price_blind_wei": 4000 * 10**18,
            "bonus_percent": 10,
        },
    ])

    MOCK_CHAIN: bool = False


@lru_cache
def get_settings() -> PaymentServiceSettings:
    return PaymentServiceSettings()
