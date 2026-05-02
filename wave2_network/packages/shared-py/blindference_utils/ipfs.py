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
    response = requests.post(
        "https://uploads.pinata.cloud/v3/files",
        files={"file": ("blindference.bin", data)},
        data={"network": "public", "name": "blindference.bin"},
        headers={"Authorization": f"Bearer {_pinata_jwt()}"},
        timeout=60,
    )
    response.raise_for_status()

    payload = response.json()
    cid = payload.get("data", {}).get("cid")
    if not cid:
        raise RuntimeError(f"IPFS upload failed: {payload}")

    return str(cid)


def download_from_ipfs(cid: str) -> bytes:
    response = requests.get(
        f"{_gateway_base_url()}/{cid}",
        timeout=60,
    )
    response.raise_for_status()
    return response.content
