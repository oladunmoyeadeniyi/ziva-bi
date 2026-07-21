"""
Alembic migration environment — ZivaBI.

Configures Alembic to run async migrations against the PostgreSQL database.
DATABASE_URL is read from the environment at migration time (never from alembic.ini)
so that the same migration command works in local dev and on Render.

To add a new migration after changing a model:
    cd backend
    alembic revision --autogenerate -m "describe the change"
    alembic upgrade head

To apply all pending migrations (also run automatically by Render on deploy):
    alembic upgrade head

Import every new model module in the "Import all models" block below so that
Alembic's autogenerate can detect new tables and columns.
"""

import asyncio
import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

from app.database import Base

# ── Import all models here so Alembic detects them ──────────────────────────
# Example (add as modules are built):
#   import app.modules.auth.models       # noqa: F401
#   import app.modules.expense.models    # noqa: F401
import app.models  # noqa: F401

# ────────────────────────────────────────────────────────────────────────────

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# ── Partial indexes excluded from autogenerate comparison ─────────────────────
# These indexes were created via raw op.execute() SQL in their respective
# migrations (they carry WHERE clauses that SQLAlchemy cannot round-trip).
# Listing them here prevents alembic --autogenerate from emitting spurious
# DROP INDEX operations on every run.
_PARTIAL_INDEXES = {
    "uq_tenant_dimensions_code",       # tenant_dimensions (tenant_id, code) WHERE is_active
    "uq_dimension_values_code",        # dimension_values (tenant_id, dimension_id, code) WHERE is_active
    "uq_expense_categories_code_top",  # expense_categories (tenant_id, code) WHERE parent_id IS NULL AND is_active
    "uq_expense_categories_code_sub",  # expense_categories (tenant_id, parent_id, code) WHERE parent_id IS NOT NULL AND is_active
    "uq_chart_of_accounts_gl_number",  # chart_of_accounts (tenant_id, gl_number) WHERE is_active
}

# Known naming-convention mismatches: constraints that exist correctly in the DB
# under a Postgres-generated name that differs from SQLAlchemy's auto-name.
# Excluding prevents spurious rename operations.
_KNOWN_NAME_MISMATCHES = {
    "approval_matrix_tenant_id_key",   # created by unique=True on ApprovalMatrix.tenant_id
}


def include_object(object, name, type_, reflected, compare_to):
    """
    Filter objects Alembic considers during --autogenerate comparison.

    Excludes:
    - Partial indexes created via raw SQL (WHERE clause not round-trippable).
    - Constraints whose DB name is a Postgres-generated name that differs from
      SQLAlchemy's naming convention (known mismatches, functionally identical).
    """
    if type_ == "index" and name in _PARTIAL_INDEXES:
        return False
    if type_ == "unique_constraint" and name in _KNOWN_NAME_MISMATCHES:
        return False
    return True


def _get_url() -> str:
    """Read DATABASE_URL from environment and normalise to asyncpg dialect."""
    url = os.environ["DATABASE_URL"]
    url = url.replace("postgres://", "postgresql+asyncpg://")
    url = url.replace("postgresql://", "postgresql+asyncpg://")
    return url


def run_migrations_offline() -> None:
    """Run migrations without an active DB connection (generates SQL only)."""
    context.configure(
        url=_get_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Run migrations against a live DB connection (standard mode)."""
    import os
    import ssl

    # Render's managed PostgreSQL requires TLS for all connections.
    # The RENDER env var is injected automatically by Render in all environments
    # (buildCommand, preDeployCommand, startCommand).
    connect_args: dict = {}
    if os.environ.get("RENDER"):
        # Render's managed PostgreSQL uses a self-signed certificate not signed
        # by any public CA. Two attempts with verified CA bundles (system store
        # and certifi's Mozilla bundle) both fail with CERTIFICATE_VERIFY_FAILED.
        # This is Render's documented behaviour; their own connection guide
        # recommends sslmode=require (encrypt-without-verify), which is the
        # asyncpg equivalent of CERT_NONE.  The connection is still TLS-encrypted
        # — only the CA chain is not verified against a public trust store.
        # Future option: download Render's private CA cert and load it explicitly.
        ssl_ctx = ssl.create_default_context()
        ssl_ctx.check_hostname = False
        ssl_ctx.verify_mode = ssl.CERT_NONE
        connect_args["ssl"] = ssl_ctx

    connectable = create_async_engine(_get_url(), connect_args=connect_args)
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
