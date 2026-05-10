import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.routes import health, reports, templates
from app.routes.generation import router as generation_router
from app.routes.fields import router as fields_router
from app.templates.loader import load_templates

logger = logging.getLogger(__name__)


def _init_tracing() -> None:
    """Configure LangSmith tracing. No-ops silently when API key is absent."""
    if settings.langsmith_api_key:
        os.environ["LANGCHAIN_API_KEY"] = settings.langsmith_api_key
        os.environ["LANGCHAIN_TRACING_V2"] = "true"
        os.environ["LANGCHAIN_PROJECT"] = "provenance"


@asynccontextmanager
async def lifespan(app: FastAPI):
    _init_tracing()
    load_templates()
    yield


app = FastAPI(title="Provenance", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def unhandled_exception_middleware(request: Request, call_next) -> JSONResponse:
    import traceback
    try:
        return await call_next(request)
    except Exception as exc:
        logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=500,
            content={"detail": f"{type(exc).__name__}: {exc}"},
        )

app.include_router(health.router)
app.include_router(reports.router)
app.include_router(templates.router)
app.include_router(generation_router)
app.include_router(fields_router)
