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
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Run migrations against a live DB connection (standard mode)."""
    connectable = create_async_engine(_get_url())
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
