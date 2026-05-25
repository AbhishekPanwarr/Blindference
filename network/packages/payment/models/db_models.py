from datetime import datetime

from pydantic import BaseModel, Field


class CreditAccountRecord(BaseModel):
    """Credit account record — all wei amounts stored as strings to avoid MongoDB int64 overflow."""

    user_address: str
    balance_cusdc: str = "0"
    balance_blind: str = "0"
    total_deposited_cusdc: str = "0"
    total_deposited_blind: str = "0"
    total_spent_cusdc: str = "0"
    total_spent_blind: str = "0"
    last_updated: datetime
    created_at: datetime | None = None
