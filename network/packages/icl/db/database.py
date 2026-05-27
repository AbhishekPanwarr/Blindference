from __future__ import annotations

import logging
from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from types import SimpleNamespace
from uuid import UUID, uuid4

from db.collections import (
    DISPUTES,
    INFERENCE_REQUESTS,
    MODEL_CATALOG,
    NODE_RUNTIMES,
    OPERATORS,
    PERMITS,
    QUORUM_ASSIGNMENTS,
    QUORUM_CERTIFICATES,
    VERIFIER_VERDICTS,
)
from db.supabase_client import get_supabase_client

logger = logging.getLogger("blindference.icl.database")


@dataclass(slots=True)
class InMemoryCursor:
    documents: list[dict]
    index: int = 0

    def __aiter__(self):
        return self

    async def __anext__(self) -> dict:
        if self.index >= len(self.documents):
            raise StopAsyncIteration
        document = deepcopy(self.documents[self.index])
        self.index += 1
        return document


class InMemoryCollection:
    def __init__(self):
        self.documents: list[dict] = []

    async def create_index(self, *_args, **_kwargs) -> None:
        return None

    async def insert_one(self, document: dict) -> SimpleNamespace:
        stored = deepcopy(document)
        stored.setdefault("id", uuid4().hex)
        self.documents.append(stored)
        return SimpleNamespace(inserted_id=stored["id"])

    async def find_one(self, query: dict) -> dict | None:
        for document in self.documents:
            if self._matches(document, query):
                return deepcopy(document)
        return None

    async def update_one(self, query: dict, update: dict, upsert: bool = False) -> SimpleNamespace:
        for index, document in enumerate(self.documents):
            if self._matches(document, query):
                new_document = deepcopy(document)
                # Apply $set
                if "$set" in update:
                    new_document.update(deepcopy(update["$set"]))
                # Apply $inc (add/subtract numeric fields)
                if "$inc" in update:
                    for key, delta in deepcopy(update["$inc"]).items():
                        new_document[key] = new_document.get(key, 0) + delta
                # Apply $setOnInsert
                if "$setOnInsert" in update:
                    for key, val in deepcopy(update["$setOnInsert"]).items():
                        if key not in new_document:
                            new_document[key] = val
                self.documents[index] = new_document
                return SimpleNamespace(matched_count=1, modified_count=1, upserted_id=None)

        if upsert:
            new_document = deepcopy(query)
            if "$set" in update:
                new_document.update(deepcopy(update["$set"]))
            if "$inc" in update:
                for key, delta in deepcopy(update["$inc"]).items():
                    new_document[key] = new_document.get(key, 0) + delta
            if "$setOnInsert" in update:
                for key, val in deepcopy(update["$setOnInsert"]).items():
                    if key not in new_document:
                        new_document[key] = val
            new_document.setdefault("id", uuid4().hex)
            self.documents.append(new_document)
            return SimpleNamespace(matched_count=0, modified_count=0, upserted_id=new_document["id"])

        return SimpleNamespace(matched_count=0, modified_count=0, upserted_id=None)

    def find(self, query: dict) -> InMemoryCursor:
        matched = [document for document in self.documents if self._matches(document, query)]
        return InMemoryCursor(deepcopy(matched))

    def _matches(self, document: dict, query: dict) -> bool:
        return self._matches_dict(document, query)

    def _matches_dict(self, document: dict, query: dict) -> bool:
        for key, value in query.items():
            if key == "$or":
                if not any(self._matches_dict(document, subq) for subq in value):
                    return False
            elif key == "$and":
                if not all(self._matches_dict(document, subq) for subq in value):
                    return False
            elif key == "$in":
                return False
            elif isinstance(value, dict):
                doc_val = document.get(key)
                if not self._matches_operator(doc_val, value):
                    return False
            else:
                doc_val = document.get(key)
                if isinstance(doc_val, list):
                    if value not in doc_val:
                        return False
                elif doc_val != value:
                    return False
        return True

    def _matches_operator(self, doc_val, operator_dict: dict) -> bool:
        for op, op_val in operator_dict.items():
            if op == "$in":
                if doc_val not in op_val:
                    return False
            elif op == "$nin":
                if doc_val in op_val:
                    return False
            elif op == "$eq":
                if doc_val != op_val:
                    return False
            elif op == "$ne":
                if doc_val == op_val:
                    return False
            elif op == "$gt":
                if doc_val is None or doc_val <= op_val:
                    return False
            elif op == "$gte":
                if doc_val is None or doc_val < op_val:
                    return False
            elif op == "$lt":
                if doc_val is None or doc_val >= op_val:
                    return False
            elif op == "$lte":
                if doc_val is None or doc_val > op_val:
                    return False
            else:
                if doc_val != operator_dict:
                    return False
        return True


class InMemoryDatabase:
    def __init__(self):
        self._collections: dict[str, InMemoryCollection] = {}

    def __getitem__(self, name: str) -> InMemoryCollection:
        if name not in self._collections:
            self._collections[name] = InMemoryCollection()
        return self._collections[name]

    async def command(self, command_name: str) -> dict[str, int]:
        if command_name == "ping":
            return {"ok": 1}
        raise ValueError(f"unsupported command: {command_name}")


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

        # Flatten MongoDB-style update operators to plain key-value pairs
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

    def find(self, query: dict) -> InMemoryCursor:
        # Async find: return a cursor-like object
        return _SupabaseCursor(self.table_name, query)

    async def create_index(self, *_args, **_kwargs) -> None:
        # Indexes are managed in the SQL schema, not via client
        pass


class _SupabaseCursor:
    """Async cursor wrapper for Supabase find() operations."""

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


class SupabaseDatabase:
    """Database that routes to Supabase tables."""

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
                await client.table("inference_requests").select("count", count="exact").limit(1).execute()
                return {"ok": 1}
            except Exception as exc:
                logger.warning("Supabase ping failed: %s", exc)
                return {"ok": 0}
        raise ValueError(f"unsupported command: {command_name}")


def get_database(use_supabase: bool | None = None):
    """Return the appropriate database backend.
    
    Args:
        use_supabase: If None, reads USE_SUPABASE env var. If True/False, forces that backend.
    
    Returns:
        SupabaseDatabase or InMemoryDatabase instance.
    """
    import os
    if use_supabase is None:
        use_supabase = os.environ.get("USE_SUPABASE", "true").lower() == "true"
    
    if use_supabase:
        return SupabaseDatabase()
    else:
        logger.info("USE_SUPABASE=false; using in-memory persistence")
        return InMemoryDatabase()


async def ensure_indexes(database) -> None:
    """Ensure indexes exist. For Supabase, this is a no-op (managed in schema).
    For InMemory, also a no-op."""
    pass


async def ping_database(database) -> bool:
    """Ping the database to verify connectivity."""
    try:
        result = await database.command("ping")
        return result.get("ok", 0) == 1
    except Exception as exc:
        logger.warning("Database ping failed: %s", exc)
        return False


async def close_database() -> None:
    """Close database connections."""
    # Supabase client cleanup
    from db.supabase_client import close_supabase
    await close_supabase()
