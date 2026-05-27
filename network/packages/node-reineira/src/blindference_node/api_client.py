from __future__ import annotations

import httpx

from blindference_node.config import NodeSettings


class PaymentServiceClient:
    """Client for the Blindference Payment Service REST API."""

    def __init__(self, settings: NodeSettings):
        self.base_url = settings.payment_service_url
        self.operator_address = (
            settings.operator_address
            or _derive_address(settings.operator_private_key or "")
            or "unknown"
        )

    async def get_stats(self) -> dict:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{self.base_url}/v1/nodes/{self.operator_address}/stats"
            )
            resp.raise_for_status()
            return resp.json()

    async def get_jobs(self, limit: int = 10) -> dict:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{self.base_url}/v1/nodes/{self.operator_address}/jobs?limit={limit}"
            )
            resp.raise_for_status()
            return resp.json()

    async def get_exists(self) -> bool:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{self.base_url}/v1/nodes/{self.operator_address}/exists"
            )
            resp.raise_for_status()
            data = resp.json()
            return bool(data.get("is_operator", False))


def _derive_address(private_key: str) -> str | None:
    if not private_key:
        return None
    try:
        from eth_account import Account
        return Account.from_key(private_key).address.lower()
    except Exception:
        return None
