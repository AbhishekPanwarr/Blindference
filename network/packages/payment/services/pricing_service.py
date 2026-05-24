from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger("blindference.payment.pricing")


class PricingService:
    def __init__(self, settings):
        self.settings = settings

    def _get_job_price_cusdc(self, model_id: str | None) -> int:
        return self.settings.JOB_PRICE_CUSDC.get(model_id or "qwen2.5-7b", 1_000)

    def compute_price(self, model_id: str | None, currency: str) -> dict[str, Any]:
        """Compute job price in (cusdc_amount, blind_amount).

        Returns:
            dict with keys: amount_cusdc, amount_blind, currency, model_id, price_cusdc
        """
        base_cusdc = self._get_job_price_cusdc(model_id)
        if currency.lower() == "blind":
            discounted_cusdc = int(base_cusdc * (1 - self.settings.BLIND_PAYMENT_DISCOUNT))
            blind_amount = int((discounted_cusdc / 1e6) / self.settings.BLIND_USD_RATE * 1e18)
            return {
                "amount_cusdc": 0,
                "amount_blind": blind_amount,
                "currency": "blind",
                "model_id": model_id,
                "price_cusdc": base_cusdc,
            }
        return {
            "amount_cusdc": base_cusdc,
            "amount_blind": 0,
            "currency": "cusdc",
            "model_id": model_id,
            "price_cusdc": base_cusdc,
        }

    def get_price_table(self) -> dict[str, int]:
        """Return the full price table."""
        return dict(self.settings.JOB_PRICE_CUSDC)
