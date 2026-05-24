from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from config import PaymentServiceSettings, get_settings
from db.mongo import close_database, ensure_indexes, get_database, ping_database
from routers.credits import router as credits_router
from services import ServiceContainer
from services.chain_service import ChainService
from services.credit_service import CreditService
from services.pricing_service import PricingService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("blindference.payment")


async def _resolve_database(settings: PaymentServiceSettings):
    database = await get_database(settings)
    connected = await ping_database(database)
    if connected:
        await ensure_indexes(database)
        logger.info("MongoDB connected: %s", settings.MONGO_DB_NAME)
        return database, True
    raise RuntimeError("MongoDB connection failed — Payment Service requires persistent storage")


def create_app(settings: PaymentServiceSettings | None = None) -> FastAPI:
    resolved_settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        database, mongo_connected = await _resolve_database(resolved_settings)

        chain_service = ChainService(resolved_settings)
        pricing_service = PricingService(resolved_settings)
        credit_service = CreditService(database, resolved_settings)

        app.state.settings = resolved_settings
        app.state.services = ServiceContainer(
            settings=resolved_settings,
            database=database,
            chain_service=chain_service,
            credit_service=credit_service,
            pricing_service=pricing_service,
        )

        logger.info("Blindference Payment Service started")
        try:
            yield
        finally:
            await close_database()
            logger.info("Blindference Payment Service stopped")

    app = FastAPI(
        title="Blindference Payment Service",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        started_at = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - started_at) * 1000
        logger.info(
            "%s %s status=%s elapsed_ms=%.2f",
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
        )
        return response

    app.include_router(credits_router)

    @app.get("/")
    async def root() -> dict[str, str]:
        return {"message": "Blindference Payment Service is running"}

    @app.get("/health")
    async def health() -> dict[str, Any]:
        services: ServiceContainer = app.state.services
        return {
            "status": "ok",
            "mongo_connected": True,
            "chain_connected": services.chain_service.web3_client.is_connected(),
        }

    return app


app = create_app()
