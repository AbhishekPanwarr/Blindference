from __future__ import annotations

import logging
from copy import deepcopy
from datetime import datetime
from decimal import Decimal
from types import SimpleNamespace
from uuid import UUID, uuid4

from db.supabase_client import get_supabase_client

logger = logging.getLogger("blindference.payment.database")


def _sanitize_for_json(obj):
    """Recursively convert non-JSON-serializable values for Supabase REST API."""
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, UUID):
        return str(obj)
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, dict):
        return {k: _sanitize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize_for_json(v) for v in obj]
    return obj


class SupabaseCollection:
    """Wraps Supabase's PostgREST API to look like a Motor/MongoDB collection."""

    def __init__(self, table_name: str):
        self.table_name = table_name

    async def insert_one(self, document: dict) -> SimpleNamespace:
        client = get_supabase_client()
        sanitized = _sanitize_for_json(document)
        result = await client.table(self.table_name).insert(sanitized).execute()
        data = result.data
        inserted_id = data[0].get("id") if data else None
        return SimpleNamespace(inserted_id=inserted_id)

    async def find_one(self, query: dict) -> dict | None:
        client = get_supabase_client()
        builder = client.table(self.table_name).select("*")
        for key, value in query.items():
            builder = builder.eq(key, value)
        result = await builder.limit(1).execute()
        if result.data:
            return result.data[0]
        return None

    async def update_one(self, query: dict, update: dict, upsert: bool = False) -> SimpleNamespace:
        client = get_supabase_client()

        flat_update: dict = {}
        if "$set" in update:
            flat_update.update(update["$set"])

        # Handle $inc via non-atomic read-modify-write (use RPC for production atomicity)
        if "$inc" in update:
            existing = await self.find_one(query)
            if existing:
                for key, delta in update["$inc"].items():
                    flat_update[key] = existing.get(key, 0) + delta
            elif upsert:
                for key, delta in update["$inc"].items():
                    flat_update[key] = delta
            else:
                return SimpleNamespace(matched_count=0, modified_count=0, upserted_id=None)

        set_on_insert: dict = {}
        if "$setOnInsert" in update:
            set_on_insert = dict(update["$setOnInsert"])

        if not flat_update and not upsert and not set_on_insert:
            return SimpleNamespace(matched_count=0, modified_count=0, upserted_id=None)

        # Handle dotted keys (nested JSONB updates) via read-modify-write
        dotted_keys = [k for k in flat_update if "." in k]
        if dotted_keys:
            existing = await self.find_one(query)
            if existing:
                for dotted_key, val in flat_update.items():
                    parts = dotted_key.split(".")
                    target = existing
                    for part in parts[:-1]:
                        if part not in target or not isinstance(target[part], dict):
                            target[part] = {}
                        target = target[part]
                    target[parts[-1]] = val
                # Remove dotted keys from flat_update; we'll write the whole top-level fields
                top_level_fields_to_rewrite = set(k.split(".")[0] for k in dotted_keys)
                for key in list(flat_update.keys()):
                    if "." in key:
                        flat_update.pop(key)
                for field in top_level_fields_to_rewrite:
                    flat_update[field] = existing[field]
            elif not upsert:
                return SimpleNamespace(matched_count=0, modified_count=0, upserted_id=None)

        # Try update first (only $set and resolved $inc values)
        if flat_update:
            sanitized_update = _sanitize_for_json(flat_update)
            builder = client.table(self.table_name).update(sanitized_update)
            for key, value in query.items():
                builder = builder.eq(key, value)
            result = await builder.execute()
            matched = len(result.data) if result.data else 0
            if matched > 0:
                return SimpleNamespace(matched_count=matched, modified_count=matched, upserted_id=None)

        # If no match and upsert=True, insert with query + flat_update + set_on_insert
        if upsert:
            insert_doc = dict(query)
            insert_doc.update(flat_update)
            insert_doc.update(set_on_insert)
            sanitized_insert = _sanitize_for_json(insert_doc)
            result = await client.table(self.table_name).insert(sanitized_insert).execute()
            inserted_id = result.data[0].get("id") if result.data else None
            return SimpleNamespace(matched_count=0, modified_count=0, upserted_id=inserted_id)

        return SimpleNamespace(matched_count=0, modified_count=0, upserted_id=None)

    def find(self, query: dict):
        return _SupabaseCursor(self.table_name, query)

    async def create_index(self, *_args, **_kwargs) -> None:
        pass


class _SupabaseCursor:
    def __init__(self, table_name: str, query: dict):
        self.table_name = table_name
        self.query = query
        self._fetched: list[dict] | None = None
        self._index = 0

    async def _fetch(self) -> list[dict]:
        if self._fetched is not None:
            return self._fetched
        client = get_supabase_client()
        builder = client.table(self.table_name).select("*")
        for key, value in self.query.items():
            builder = builder.eq(key, value)
        result = await builder.execute()
        self._fetched = result.data or []
        return self._fetched

    def __aiter__(self):
        self._index = 0
        return self

    async def __anext__(self) -> dict:
        if self._fetched is None:
            await self._fetch()
        if self._index >= len(self._fetched):
            raise StopAsyncIteration
        doc = deepcopy(self._fetched[self._index])
        self._index += 1
        return doc


class PaymentDatabase:
    def __init__(self):
        self._collections: dict[str, SupabaseCollection] = {}

    def __getitem__(self, name: str) -> SupabaseCollection:
        if name not in self._collections:
            self._collections[name] = SupabaseCollection(name)
        return self._collections[name]

    async def command(self, command_name: str) -> dict[str, int]:
        if command_name == "ping":
            try:
                client = get_supabase_client()
                await client.table("credits").select("count", count="exact").limit(1).execute()
                return {"ok": 1}
            except Exception as exc:
                logger.warning("Supabase ping failed: %s", exc)
                return {"ok": 0}
        raise ValueError(f"unsupported command: {command_name}")


def get_database():
    return PaymentDatabase()


async def ensure_indexes(database) -> None:
    pass


async def ping_database(database) -> bool:
    try:
        result = await database.command("ping")
        return result.get("ok", 0) == 1
    except Exception as exc:
        logger.warning("Database ping failed: %s", exc)
        return False


async def close_database() -> None:
    from db.supabase_client import close_supabase
    await close_supabase()
