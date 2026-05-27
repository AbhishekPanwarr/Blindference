from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

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

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("blindference.icl")


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

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
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

    # Custom exception handler ensures CORS headers are present on unhandled
    # exceptions so the browser can read the error instead of masking it as
    # a CORS failure.
    from fastapi.responses import JSONResponse

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
        services: ServiceContainer = app.state.services
        return HealthResponse(
            status="ok",
            chain_connected=await services.chain_service.is_connected(),
            mongo_connected=bool(app.state.mongo_connected),
        )

    return app


app = create_app()
