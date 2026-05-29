from __future__ import annotations

import json
import logging
import os
import signal
import time
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from config import PaymentServiceSettings, get_settings
from db.database import close_database, ensure_indexes, get_database, ping_database
from routers.credits import router as credits_router
from routers.developers import router as developers_router
from routers.jobs import router as jobs_router
from routers.nodes import router as nodes_router
from services import ServiceContainer
from services.chain_service import ChainService
from services.credit_service import CreditService
from services.job_service import JobService
from services.pricing_service import PricingService


class JSONFormatter(logging.Formatter):
    """Emit log records as single-line JSON for production observability."""

    def format(self, record: logging.LogRecord) -> str:
        obj = {
            "timestamp": self.formatTime(record),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if hasattr(record, "request_id"):
            obj["request_id"] = record.request_id
        return json.dumps(obj)


def _configure_logging() -> None:
    if os.environ.get("JSON_LOGGING", "").lower() in ("true", "1", "yes"):
        handler = logging.StreamHandler()
        handler.setFormatter(JSONFormatter())
        logging.getLogger().handlers = [handler]
        logging.getLogger().setLevel(logging.INFO)
    else:
        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        )


_configure_logging()
logger = logging.getLogger("blindference.payment")


def _validate_settings(settings: PaymentServiceSettings) -> None:
    """Fail fast if required environment variables are missing."""
    required = [
        ("SUPABASE_URL", settings.SUPABASE_URL),
        ("SUPABASE_SERVICE_ROLE_KEY", settings.SUPABASE_SERVICE_ROLE_KEY),
        ("ICL_PRIVATE_KEY", settings.ICL_WALLET_PRIVATE_KEY),
        ("ARBITRUM_SEPOLIA_RPC", settings.ARBITRUM_SEPOLIA_RPC),
        ("PAYMENT_WALLET_ADDRESS", settings.PAYMENT_WALLET_ADDRESS),
    ]
    missing = [name for name, val in required if not val]
    if missing:
        logger.error("Missing required env vars: %s", ", ".join(missing))
        raise RuntimeError(f"Missing required configuration: {', '.join(missing)}")


async def _resolve_database(settings: PaymentServiceSettings):
    database = get_database()
    connected = await ping_database(database)
    if connected:
        await ensure_indexes(database)
        logger.info("Supabase connected")
        return database, True
    raise RuntimeError("Supabase connection failed — Payment Service requires persistent storage")


def create_app(settings: PaymentServiceSettings | None = None) -> FastAPI:
    resolved_settings = settings or get_settings()
    _validate_settings(resolved_settings)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        database, mongo_connected = await _resolve_database(resolved_settings)

        chain_service = ChainService(resolved_settings)
        pricing_service = PricingService(resolved_settings)
        credit_service = CreditService(database, resolved_settings)
        job_service = JobService(database, credit_service, chain_service, pricing_service, resolved_settings)

        app.state.settings = resolved_settings
        app.state.services = ServiceContainer(
            settings=resolved_settings,
            database=database,
            chain_service=chain_service,
            credit_service=credit_service,
            pricing_service=pricing_service,
            job_service=job_service,
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

    # CORS: configurable via ALLOWED_ORIGINS env var (comma-separated) or defaults to * for dev
    allowed_origins = os.environ.get("ALLOWED_ORIGINS", "*").split(",")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        """Production request logging: always log errors and slow paths; sample successes."""
        started_at = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - started_at) * 1000
        status = response.status_code
        is_error = status >= 400
        is_slow = elapsed_ms > 1000
        should_sample = (hash(request.url.path) % 10) == 0  # ~10% sample
        if is_error or is_slow or should_sample:
            logger.info(
                "%s %s status=%s elapsed_ms=%.2f",
                request.method,
                request.url.path,
                status,
                elapsed_ms,
            )
        return response

    # TODO: Add rate limiting middleware for production.
    # Consider slowapi (Redis-backed) or a reverse proxy (nginx/traefik).

    app.include_router(credits_router)
    app.include_router(developers_router)
    app.include_router(jobs_router)
    app.include_router(nodes_router)

    @app.get("/")
    async def root() -> dict[str, str]:
        return {"message": "Blindference Payment Service is running"}

    @app.get("/health")
    async def health() -> dict[str, Any]:
        services: ServiceContainer | None = getattr(app.state, "services", None)
        if services is None:
            return {
                "status": "starting",
                "database_connected": False,
                "chain_connected": False,
                "staking_reachable": False,
            }

        db_healthy = False
        try:
            db_healthy = await ping_database(services.database)
        except Exception:
            pass

        chain_healthy = services.chain_service.web3_client.is_connected()

        staking_healthy = False
        try:
            info = services.chain_service.get_stake_info(services.settings.PAYMENT_WALLET_ADDRESS)
            staking_healthy = info is not None
        except Exception:
            pass

        return {
            "status": "ok" if db_healthy and chain_healthy else "degraded",
            "database_connected": db_healthy,
            "chain_connected": chain_healthy,
            "staking_reachable": staking_healthy,
        }

    return app


def _handle_signal(signum: int, _frame: Any) -> None:
    logger.info("Received signal %d, shutting down gracefully...", signum)


signal.signal(signal.SIGTERM, _handle_signal)
signal.signal(signal.SIGINT, _handle_signal)

app = create_app()
