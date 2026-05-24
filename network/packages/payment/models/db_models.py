from datetime import datetime

from pydantic import BaseModel, Field


class CreditAccountRecord(BaseModel):
    user_address: str
    balance_cusdc: int = 0
    balance_blind: int = 0
    total_deposited_cusdc: int = 0
    total_deposited_blind: int = 0
    total_spent_cusdc: int = 0
    total_spent_blind: int = 0
    last_updated: datetime
    created_at: datetime | None = None
