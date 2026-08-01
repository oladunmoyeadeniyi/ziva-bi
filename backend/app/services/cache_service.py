"""Cache service — Redis-backed caching for hot read paths.

Provides a transparent cache layer for frequently-read, rarely-changing data:
  - Tenant configuration (org_setup, posting_mode, modules)
  - Platform config (app name, theme, branding)
  - CoA (Chart of Accounts) for a tenant

Cache keys are prefixed by tenant_id to prevent cross-tenant data leakage.
TTL defaults:
  - Tenant config: 300 seconds (5 minutes)
  - Platform config: 3600 seconds (1 hour)
  - CoA: 600 seconds (10 minutes)

Graceful degradation: if Redis is unavailable (CONNECTION_ERROR or not configured),
all cache operations are no-ops. The caller always gets a result from the DB.

Usage:
    cached = await cache.get("tenant_config", tenant_id)
    if cached is None:
        data = await fetch_from_db(...)
        await cache.set("tenant_config", tenant_id, data, ttl=300)
    return cached or data
"""

from __future__ import annotations

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

# Redis client — lazily initialised on first use
_redis_client: Any | None = None
_redis_available: bool = True  # flipped to False on first connection failure


async def _get_client() -> Any | None:
    """Get or create the Redis client.

    Returns None if REDIS_URL is not configured or if the connection failed.
    """
    global _redis_client, _redis_available

    if not _redis_available:
        return None

    if _redis_client is not None:
        return _redis_client

    try:
        from app.config import settings
        if not settings.redis_url:
            _redis_available = False
            return None

        import redis.asyncio as aioredis
        _redis_client = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
        # Ping to verify connection
        await _redis_client.ping()
        logger.info("Redis cache connected: %s", settings.redis_url[:30])
        return _redis_client

    except Exception as exc:
        logger.warning("Redis unavailable, falling back to no-cache: %s", exc)
        _redis_available = False
        return None


def _key(namespace: str, tenant_id: str) -> str:
    """Build a namespaced cache key.

    Format: prad:{namespace}:{tenant_id}
    """
    return f"prad:{namespace}:{tenant_id}"


async def get(namespace: str, tenant_id: str) -> Any | None:
    """Get a cached value.

    Args:
        namespace: Cache namespace (e.g. "tenant_config").
        tenant_id: Tenant UUID string.

    Returns:
        Deserialized Python object, or None if cache miss or unavailable.
    """
    client = await _get_client()
    if client is None:
        return None

    try:
        raw = await client.get(_key(namespace, tenant_id))
        if raw is None:
            return None
        return json.loads(raw)
    except Exception as exc:
        logger.debug("Cache GET error (%s/%s): %s", namespace, tenant_id, exc)
        return None


async def set(namespace: str, tenant_id: str, value: Any, ttl: int = 300) -> None:
    """Store a value in the cache.

    Args:
        namespace: Cache namespace.
        tenant_id: Tenant UUID string.
        value: JSON-serializable Python object.
        ttl: Time-to-live in seconds (default 300).
    """
    client = await _get_client()
    if client is None:
        return

    try:
        await client.set(_key(namespace, tenant_id), json.dumps(value, default=str), ex=ttl)
    except Exception as exc:
        logger.debug("Cache SET error (%s/%s): %s", namespace, tenant_id, exc)


async def invalidate(namespace: str, tenant_id: str) -> None:
    """Remove a cached value.

    Args:
        namespace: Cache namespace.
        tenant_id: Tenant UUID string.
    """
    client = await _get_client()
    if client is None:
        return

    try:
        await client.delete(_key(namespace, tenant_id))
    except Exception as exc:
        logger.debug("Cache DELETE error (%s/%s): %s", namespace, tenant_id, exc)


async def invalidate_all(tenant_id: str) -> None:
    """Invalidate ALL cached entries for a tenant.

    Called when tenant config is updated (posting mode change, module enable/disable).

    Args:
        tenant_id: Tenant UUID string.
    """
    client = await _get_client()
    if client is None:
        return

    try:
        pattern = f"prad:*:{tenant_id}"
        keys = await client.keys(pattern)
        if keys:
            await client.delete(*keys)
            logger.debug("Invalidated %d cache keys for tenant %s", len(keys), tenant_id)
    except Exception as exc:
        logger.debug("Cache INVALIDATE_ALL error (tenant %s): %s", tenant_id, exc)
