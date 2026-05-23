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
from sqlalchemy import delete, select, text

from app.config import settings
from app.database import AsyncSessionLocal, engine


async def _ensure_system_roles() -> None:
    """
    Idempotently create system roles on every startup.

    System roles are global (tenant_id=NULL, is_system=True) and cannot be
    deleted by Tenant Admins. If they already exist this is a no-op.
    This eliminates the need to run a separate seed script for role setup.

    Deduplication: if previous seed runs created duplicate rows for the same
    role name, raw SQL is used to reassign child FK rows to the surviving role
    then drop the duplicates — bypassing ORM cascade that would NULL the FK.
    """
    from app.models.auth import Role  # imported here to avoid circular import at module load

    system_roles = [
        ("super_admin",     "Global platform administrator"),
        ("tenant_admin",    "Company administrator — full control within their tenant"),
        ("employee",        "Standard employee — can submit requests"),
        ("line_manager",    "Line manager — approves team expense reports"),
        ("approver",        "Designated approver (legacy label, prefer line_manager)"),
        ("gm",              "General Manager — senior approver"),
        ("finance_reviewer","Finance team reviewer"),
        ("finance_poster",  "Finance team — posts to ERP"),
        ("finance_manager", "Finance Director / CFO — sees all reports"),
        ("internal_auditor","Read-only auditor — internal"),
        ("external_auditor","Read-only auditor — external"),
        ("vendor_admin",    "Vendor company administrator"),
        ("customer_admin",  "Customer company administrator"),
        ("hr_officer",      "HR administrator"),
        ("payroll_officer", "Payroll administrator"),
    ]

    async with AsyncSessionLocal() as db:
        # --- Step 1: deduplicate via raw SQL (avoid ORM cascade nullifying FKs) ---
        for name, _ in system_roles:
            # Reassign child rows to the earliest surviving role, then delete dupes.
            await db.execute(text("""
                WITH surviving AS (
                    SELECT id FROM roles
                    WHERE name = :name AND tenant_id IS NULL
                    ORDER BY created_at LIMIT 1
                )
                UPDATE user_roles
                   SET role_id = (SELECT id FROM surviving)
                 WHERE role_id IN (
                     SELECT id FROM roles
                     WHERE name = :name AND tenant_id IS NULL
                       AND id NOT IN (SELECT id FROM surviving)
                 )
            """), {"name": name})

            await db.execute(text("""
                WITH surviving AS (
                    SELECT id FROM roles
                    WHERE name = :name AND tenant_id IS NULL
                    ORDER BY created_at LIMIT 1
                )
                UPDATE role_permissions
                   SET role_id = (SELECT id FROM surviving)
                 WHERE role_id IN (
                     SELECT id FROM roles
                     WHERE name = :name AND tenant_id IS NULL
                       AND id NOT IN (SELECT id FROM surviving)
                 )
            """), {"name": name})

            await db.execute(text("""
                DELETE FROM roles
                 WHERE name = :name AND tenant_id IS NULL
                   AND id NOT IN (
                       SELECT id FROM roles
                       WHERE name = :name AND tenant_id IS NULL
                       ORDER BY created_at LIMIT 1
                   )
            """), {"name": name})

        await db.flush()
        # Expire cached ORM state so the next selects see the post-dedup rows.
        db.expire_all()

        # --- Step 2: insert any missing roles ---
        for name, description in system_roles:
            result = await db.execute(
                select(Role).where(Role.name == name, Role.tenant_id.is_(None))
            )
            if result.scalars().first() is None:
                db.add(Role(name=name, description=description, is_system=True))

        await db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan: verify DB on startup, seed system roles, dispose engine on shutdown."""
    async with engine.begin() as conn:
        await conn.execute(text("SELECT 1"))
    await _ensure_system_roles()
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

# Always permit the local dev frontend regardless of ALLOWED_ORIGINS env var.
# The env var may be empty or misconfigured; hardcoding this origin here ensures
# local development never breaks due to a CORS misconfiguration.
_cors_origins = list(dict.fromkeys(
    ["http://localhost:3000", "http://localhost:3001"] + settings.allowed_origins
))

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


from app.routers import auth as auth_router
from app.routers import users as users_router
from app.routers import expenses as expenses_router
from app.routers import approvals as approvals_router
from app.routers import tenant as tenant_router
from app.routers import invitations as invitations_router
from app.routers import documents as documents_router
from app.routers import expense_config as expense_config_router
from app.routers import config as config_router

app.include_router(auth_router.router)
app.include_router(users_router.router)
app.include_router(expenses_router.router)
app.include_router(approvals_router.router)
app.include_router(tenant_router.router)
app.include_router(invitations_router.router)
app.include_router(documents_router.router)
app.include_router(expense_config_router.router)
app.include_router(config_router.router)


@app.get("/api/health", tags=["system"])
async def health_check() -> dict:
    """
    Liveness probe used by Render and any upstream load balancer.

    Returns a simple JSON payload confirming the service is up.
    The DB connection is already verified at startup via lifespan(),
    so a 200 here means both the API process and the DB are reachable.
    """
    return {"status": "ok", "service": "ziva-bi-api", "version": "0.1.0"}
