from __future__ import annotations

import os

import requests


def _pinata_jwt() -> str:
    jwt = os.getenv("PINATA_JWT")
    if not jwt:
        raise RuntimeError("PINATA_JWT is not set")
    return jwt


def _gateway_base_url() -> str:
    return os.getenv("PINATA_GATEWAY_URL", "https://gateway.pinata.cloud/ipfs").rstrip("/")


def upload_to_ipfs(data: bytes) -> str:
    """Upload *data* to IPFS via Pinata pinning service.

    Uses the classic Pinata ``pinFileToIPFS`` endpoint which is stable
    across API versions.  Falls back gracefully if Pinata returns a
    structured error.
    """
    jwt = _pinata_jwt()
    response = requests.post(
        "https://api.pinata.cloud/pinning/pinFileToIPFS",
        files={"file": ("blindference.bin", data)},
        headers={"Authorization": f"Bearer {jwt}"},
        timeout=60,
    )

    # Pinata returns 403 for revoked keys, 401 for malformed JWTs
    if response.status_code in (401, 403):
        raise RuntimeError(
            f"Pinata authentication failed ({response.status_code}). "
            "Your JWT may be revoked or expired. Generate a new key at "
            "https://pinata.cloud/keys and update PINATA_JWT."
        )

    response.raise_for_status()

    payload = response.json()
    # Classic Pinata returns IpfsHash directly; v3 wraps in {"data": {"cid": ...}}
    cid = payload.get("IpfsHash") or payload.get("data", {}).get("cid")
    if not cid:
        raise RuntimeError(f"IPFS upload failed: unexpected response {payload}")

    return str(cid)


def download_from_ipfs(cid: str) -> bytes:
    response = requests.get(
        f"{_gateway_base_url()}/{cid}",
        timeout=60,
    )
    response.raise_for_status()
    return response.content
