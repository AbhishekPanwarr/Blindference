from __future__ import annotations

import json
import logging
import os
import signal
import time
from contextlib import asynccontextmanager
from typing import Any

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import Settings, get_settings
from db.database import close_database, ensure_indexes, get_database, ping_database
from models.response_models import HealthResponse
from routers.admin import router as admin_router
from routers.coverage import router as coverage_router
from routers.disputes import router as disputes_router
from routers.inference import router as inference_router
from routers.internal import router as internal_task_router
from routers.models import router as models_router
from routers.nodes import router as nodes_router
from routers.operators import router as operators_router
from services import ServiceContainer
from services.chain_service import ChainService
from services.coverage_service import CoverageService
from services.model_registry_service import ModelRegistryService
from services.node_selector import NodeSelector
from services.quorum_service import QuorumService
from services.verdict_aggregator import VerdictAggregator


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
logger = logging.getLogger("blindference.icl")


def _validate_settings(settings: Settings) -> None:
    """Fail fast if required environment variables are missing."""
    # Only validate Supabase vars when USE_SUPABASE is true (default)
    if settings.USE_SUPABASE:
        required = [
            ("SUPABASE_URL", settings.SUPABASE_URL),
            ("SUPABASE_SERVICE_ROLE_KEY", settings.SUPABASE_SERVICE_ROLE_KEY),
        ]
    else:
        required = []

    required.extend([
        ("ICL_PRIVATE_KEY", settings.ICL_SERVICE_PRIVATE_KEY),
        ("ARBITRUM_SEPOLIA_RPC", settings.ARBITRUM_SEPOLIA_RPC),
    ])
    missing = [name for name, val in required if not val]
    if missing:
        logger.error("Missing required env vars: %s", ", ".join(missing))
        raise RuntimeError(f"Missing required configuration: {', '.join(missing)}")


async def _resolve_database(settings: Settings):
    if not settings.USE_SUPABASE:
        logger.info("USE_SUPABASE=false; using in-memory persistence")
        database = get_database(use_supabase=False)
        await ensure_indexes(database)
        return database, False

    database = get_database(use_supabase=True)
    db_connected = await ping_database(database)
    if db_connected:
        await ensure_indexes(database)
        return database, True

    logger.warning("Supabase unavailable, falling back to in-memory persistence for local development")
    database = get_database(use_supabase=False)
    await ensure_indexes(database)
    return database, False


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved_settings = settings or get_settings()
    _validate_settings(resolved_settings)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        database, mongo_connected = await _resolve_database(resolved_settings)

        chain_service = ChainService(resolved_settings, database)
        node_selector = NodeSelector(chain_service)
        verdict_aggregator = VerdictAggregator()
        coverage_service = CoverageService()
        model_registry_service = ModelRegistryService(database)
        await model_registry_service.ensure_default_models()
        quorum_service = QuorumService(
            database,
            chain_service,
            node_selector,
            verdict_aggregator,
            model_registry_service=model_registry_service,
        )

        app.state.settings = resolved_settings
        app.state.mongo_connected = mongo_connected  # kept for API compatibility
        app.state.db_connected = mongo_connected
        app.state.services = ServiceContainer(
            settings=resolved_settings,
            database=database,
            chain_service=chain_service,
            node_selector=node_selector,
            verdict_aggregator=verdict_aggregator,
            coverage_service=coverage_service,
            model_registry_service=model_registry_service,
            quorum_service=quorum_service,
        )

        logger.info("Blindference ICL started")
        try:
            yield
        finally:
            await close_database()
            logger.info("Blindference ICL stopped")

    app = FastAPI(
        title="Blindference ICL",
        version="0.2.0",
        lifespan=lifespan,
    )

    # CORS: configurable via ALLOWED_ORIGINS env var (comma-separated) or defaults to * for dev
    allowed_origins = os.environ.get("ALLOWED_ORIGINS", "*").split(",")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        started_at = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - started_at) * 1000
        # Sample request logging: always log errors/slow requests, otherwise 10% sample.
        # Reduces log volume ~90% under normal load while preserving observability.
        if (
            response.status_code >= 400
            or elapsed_ms > 1000
            or (hash(request.url.path + request.method) % 10) == 0
        ):
            logger.info(
                "%s %s status=%s elapsed_ms=%.2f",
                request.method,
                request.url.path,
                response.status_code,
                elapsed_ms,
            )
        return response

    # TODO: Add rate limiting middleware for production.
    # Consider slowapi (Redis-backed) or a reverse proxy (nginx/traefik).

    # Custom exception handler ensures CORS headers are present on unhandled
    # exceptions so the browser can read the error instead of masking it as
    # a CORS failure.
    @app.exception_handler(Exception)
    async def cors_aware_exception_handler(request: Request, exc: Exception):
        logger.error("Unhandled exception on %s %s: %s", request.method, request.url.path, exc, exc_info=True)
        response = JSONResponse(
            status_code=500,
            content={"detail": f"Internal server error: {exc}"},
        )
        origin = request.headers.get("origin", "")
        if origin:
            response.headers["access-control-allow-origin"] = origin
        else:
            response.headers["access-control-allow-origin"] = "*"
        response.headers["access-control-allow-credentials"] = "false"
        return response

    app.include_router(inference_router)
    app.include_router(nodes_router)
    app.include_router(models_router)
    app.include_router(coverage_router)
    app.include_router(disputes_router)
    app.include_router(admin_router)
    app.include_router(operators_router)
    app.include_router(internal_task_router)

    @app.get("/")
    async def root() -> dict[str, str]:
        return {"message": "Blindference ICL is running"}

    @app.get("/health", response_model=HealthResponse)
    async def health() -> HealthResponse:
        services: ServiceContainer | None = getattr(app.state, "services", None)
        if services is None:
            return HealthResponse(
                status="starting",
                chain_connected=False,
                mongo_connected=False,
            )

        db_healthy = False
        try:
            db_healthy = await ping_database(services.database)
        except Exception:
            pass

        chain_healthy = await services.chain_service.is_connected()

        return HealthResponse(
            status="ok" if db_healthy and chain_healthy else "degraded",
            chain_connected=chain_healthy,
            mongo_connected=db_healthy,
        )

    return app


def _handle_signal(signum: int, _frame: Any) -> None:
    logger.info("Received signal %d, shutting down gracefully...", signum)


signal.signal(signal.SIGTERM, _handle_signal)
signal.signal(signal.SIGINT, _handle_signal)

app = create_app()
