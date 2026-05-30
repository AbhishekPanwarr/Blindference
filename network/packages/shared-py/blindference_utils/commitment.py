from __future__ import annotations

import hashlib


def _normalize_output(text: str) -> str:
    """Collapse all whitespace to a single space and strip edges.

    Groq (and other LLMs) often add extra newlines, leading/trailing spaces,
    or double spaces across separate API calls even with temperature=0.
    Normalizing before SHA-256 prevents trivial formatting variance from
    causing quorum rejections.
    """
    return " ".join(text.strip().split())


def hash_output(text: str) -> bytes:
    return hashlib.sha256(_normalize_output(text).encode("utf-8")).digest()


def build_commitment_hash(output_cid: str, output_hash: bytes) -> str:
    return hashlib.sha256(output_cid.encode("utf-8") + output_hash).hexdigest()
