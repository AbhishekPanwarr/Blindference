from __future__ import annotations

import logging

from supabase._async.client import AsyncClient

logger = logging.getLogger("blindference.icl.supabase")

_supabase: AsyncClient | None = None


def get_supabase_client() -> AsyncClient:
    global _supabase
    if _supabase is None:
        from config import get_settings
        settings = get_settings()
        url = settings.SUPABASE_URL
        key = settings.SUPABASE_SERVICE_ROLE_KEY
        if not url or not key:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment or .env"
            )
        _supabase = AsyncClient(url, key)
        logger.info("Supabase client initialized")
    return _supabase


async def close_supabase() -> None:
    global _supabase
    if _supabase is not None:
        await _supabase.auth.close()
        _supabase = None
        logger.info("Supabase client closed")
