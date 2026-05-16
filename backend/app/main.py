"""
ZivaBI API — application entry point.

Boots FastAPI, registers middleware, and exposes the /api/health endpoint.
Every other module's router is registered here as features are built.

Architecture note: lifespan() runs a DB ping on startup so that a broken
DATABASE_URL fails loudly at boot rather than silently at the first request.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app.database import engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan: verify DB on startup, dispose engine on shutdown."""
    async with engine.begin() as conn:
        await conn.execute(text("SELECT 1"))
    yield
    await engine.dispose()


app = FastAPI(
    title="ZivaBI API",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", tags=["system"])
async def health_check() -> dict:
    """
    Liveness probe used by Render and any upstream load balancer.

    Returns a simple JSON payload confirming the service is up.
    The DB connection is already verified at startup via lifespan(),
    so a 200 here means both the API process and the DB are reachable.
    """
    return {"status": "ok", "service": "ziva-bi-api", "version": "0.1.0"}
