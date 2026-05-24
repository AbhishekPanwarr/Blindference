from __future__ import annotations

import logging

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import ASCENDING

from config import get_settings
from db.collections import CREDITS

logger = logging.getLogger("blindference.payment.mongo")

_client: AsyncIOMotorClient | None = None


async def get_database(settings=None):
    global _client
    if settings is None:
        from config import get_settings
        settings = get_settings()
    if _client is None:
        _client = AsyncIOMotorClient(
            settings.MONGO_URI,
            serverSelectionTimeoutMS=10_000,
            connectTimeoutMS=10_000,
        )
    return _client[settings.MONGO_DB_NAME]


async def ensure_indexes(database) -> None:
    await database[CREDITS].create_index(
        [("user_address", ASCENDING)],
        unique=True,
    )
    logger.info("Ensured MongoDB indexes for credits collection")


async def ping_database(database) -> bool:
    try:
        await database.client.admin.command("ping")
        return True
    except Exception as error:
        logger.warning("MongoDB ping failed: %s", error)
        return False


async def close_database() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None
        logger.info("MongoDB connection closed")
