"""
Platform config service — cached read/write for platform_config table.

Provides get_app_name() and get_platform_config() for use anywhere in the
backend that needs the current platform settings (email subjects, TOTP
issuer names, API docs title, etc.).

Caching strategy:
    Simple module-level dict + timestamp.  TTL = 5 minutes.  On each read,
    if the cache is fresh the DB is not hit.  On write (set_config), the
    cache is immediately invalidated so the next read fetches the new value.

    This is intentionally simple — no Redis needed.  A rename happens at most
    once in the product's lifetime, so a 5-minute stale window on an extremely
    rare operation is completely acceptable.

Usage:
    from app.services.platform_config import get_app_name, set_config

    # In a router that has a db session:
    name = await get_app_name(db)

    # In the SA PATCH endpoint:
    await set_config(db, key="app_name", value="Finara", updated_by=user_id)
"""

import time
import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.platform_config import PlatformConfig

# ── In-memory cache ───────────────────────────────────────────────────────────

_CACHE: dict[str, str] = {}
_CACHE_LOADED_AT: float = 0.0
_CACHE_TTL: float = 300.0  # 5 minutes


def _is_cache_fresh() -> bool:
    return bool(_CACHE) and (time.monotonic() - _CACHE_LOADED_AT) < _CACHE_TTL


def invalidate_cache() -> None:
    """Force the next read to hit the database.  Call after any write."""
    global _CACHE_LOADED_AT
    _CACHE_LOADED_AT = 0.0


# ── Public API ────────────────────────────────────────────────────────────────


async def get_platform_config(db: AsyncSession) -> dict[str, str]:
    """
    Return all platform config key/value pairs, using the in-memory cache.

    Parameters:
        db: SQLAlchemy async session.

    Returns:
        dict mapping key → value for every row in platform_config.

    Example:
        config = await get_platform_config(db)
        print(config["app_name"])  # → "Ziva BI"
    """
    global _CACHE, _CACHE_LOADED_AT

    if _is_cache_fresh():
        return dict(_CACHE)

    result = await db.execute(select(PlatformConfig))
    rows = result.scalars().all()
    _CACHE = {row.key: row.value for row in rows}
    _CACHE_LOADED_AT = time.monotonic()
    return dict(_CACHE)


async def get_app_name(db: AsyncSession) -> str:
    """
    Return the current app name, falling back to 'Ziva BI' if not set.

    Parameters:
        db: SQLAlchemy async session.

    Returns:
        The value of platform_config['app_name'], or 'Ziva BI' as fallback.
    """
    config = await get_platform_config(db)
    return config.get("app_name", "Ziva BI")


async def set_config(
    db: AsyncSession,
    *,
    key: str,
    value: str,
    updated_by: Optional[uuid.UUID] = None,
) -> PlatformConfig:
    """
    Upsert a platform config value and invalidate the cache.

    Parameters:
        db:         SQLAlchemy async session (caller commits).
        key:        Config key to set (e.g. 'app_name').
        value:      New value.
        updated_by: UUID of the super-admin making the change.

    Returns:
        The updated PlatformConfig row (not yet committed — caller must commit).

    Example:
        row = await set_config(db, key="app_name", value="Finara", updated_by=user.id)
        await db.commit()
    """
    row = await db.get(PlatformConfig, key)
    if row is None:
        row = PlatformConfig(key=key, value=value, updated_by=updated_by)
        db.add(row)
    else:
        row.value = value
        row.updated_by = updated_by

    invalidate_cache()
    return row
