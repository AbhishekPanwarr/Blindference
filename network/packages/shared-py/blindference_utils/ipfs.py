from __future__ import annotations

import os
import logging

import requests

logger = logging.getLogger("blindference.ipfs")


def _pinata_jwt() -> str:
    jwt = os.getenv("PINATA_JWT")
    if not jwt:
        # Log all env vars starting with PINATA for debugging
        pinata_vars = {k: v[:20] + "..." for k, v in os.environ.items() if "PINATA" in k.upper()}
        logger.error("PINATA_JWT is not set. Found PINATA-related env vars: %s", pinata_vars)
        raise RuntimeError("PINATA_JWT is not set")
    
    # Debug log (don't expose full JWT in production, but we need to diagnose)
    logger.info("PINATA_JWT loaded: length=%d, starts_with=%s, ends_with=%s, has_quotes=%s",
                len(jwt), jwt[:10], jwt[-10:], str(jwt.startswith('"') or jwt.startswith("'")))
    
    # Strip quotes if accidentally included
    jwt = jwt.strip().strip('"').strip("'")
    return jwt


IPFS_GATEWAYS = [
    os.getenv("PINATA_GATEWAY_URL", "https://ipfs.io/ipfs").rstrip("/"),
    "https://ipfs.io/ipfs",
    "https://gateway.pinata.cloud/ipfs",
    "https://dweb.link/ipfs",
]


def _upload_gateway() -> str:
    return os.getenv("PINATA_GATEWAY_URL", "https://ipfs.io/ipfs").rstrip("/")


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
        resp_text = response.text[:500]  # Capture response body for debugging
        logger.error("Pinata auth failed: status=%s, response=%s, jwt_length=%d",
                     response.status_code, resp_text, len(jwt))
        raise RuntimeError(
            f"Pinata authentication failed ({response.status_code}). Response: {resp_text}. "
            "Your JWT may be revoked or expired. Generate a new key at "
            "https://pinata.cloud/keys and update PINATA_JWT."
        )

    response.raise_for_status()

    payload = response.json()
    # Classic Pinata returns IpfsHash directly; v3 wraps in {"data": {"cid": ...}}
    cid = payload.get("IpfsHash") or payload.get("data", {}).get("cid")
    if not cid:
        raise RuntimeError(f"IPFS upload failed: unexpected response {payload}")

    logger.info("IPFS upload successful: cid=%s via Pinata", cid)
    return str(cid)


def download_from_ipfs(cid: str, max_attempts: int = 3) -> bytes:
    """Download *cid* from IPFS with multi-gateway retry.

    Tries each gateway in ``IPFS_GATEWAYS`` up to *max_attempts* times
    with exponential backoff, starting with the preferred gateway.
    This handles propagation delays between pinning APIs and public
    gateways in cloud environments like Railway.
    """
    import time

    last_error: Exception | None = None
    for attempt in range(max_attempts):
        for gateway in IPFS_GATEWAYS:
            url = f"{gateway}/{cid}"
            try:
                logger.debug("IPFS download attempt %d/%d via %s", attempt + 1, max_attempts, gateway)
                response = requests.get(url, timeout=30)
                if response.status_code == 200:
                    logger.info("IPFS download success: cid=%s via %s (attempt %d)", cid, gateway, attempt + 1)
                    return response.content
                logger.warning("IPFS download non-200: cid=%s gateway=%s status=%s", cid, gateway, response.status_code)
            except Exception as exc:
                logger.warning("IPFS download error: cid=%s gateway=%s exc=%s", cid, gateway, exc)
                last_error = exc
        if attempt < max_attempts - 1:
            sleep_secs = 2 ** attempt  # 1s, 2s, 4s
            logger.info("IPFS download retrying in %ds (cid=%s)", sleep_secs, cid)
            time.sleep(sleep_secs)

    raise RuntimeError(
        f"IPFS download failed after {max_attempts} attempts across {len(IPFS_GATEWAYS)} gateways (cid={cid}). "
        f"Last error: {last_error}"
    )
