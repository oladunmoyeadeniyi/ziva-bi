"""
ZivaBI — Web Push notification service.

Provides a single public function:

    send_push(user_id, app_name, title, body, data)

        Looks up all active push subscriptions for the (user_id, app_name)
        pair and sends an encrypted Web Push message to each one using the
        VAPID keypair configured via environment variables.

        Fire-and-forget: errors are logged but never bubble up to the caller.
        A failed push never blocks the main transaction (e.g. an approval).

Usage from other services:
    from app.services.push_service import send_push
    # inside an async function (runs the sync push in a thread pool):
    asyncio.create_task(_send_push_async(user_id, "ziva-approve", "New approval", ...))

VAPID configuration (set in Render dashboard):
    VAPID_PRIVATE_KEY   — base64url-encoded private key (never expose to clients)
    VAPID_PUBLIC_KEY    — base64url-encoded public key (also set as NEXT_PUBLIC_VAPID_PUBLIC_KEY)
    VAPID_MAILTO        — contact email for push service providers (e.g. mailto:admin@zivabi.com)

Key generation (run once, store results in Render env vars):
    from pywebpush import Vapid
    v = Vapid().generate_keys()
    print("Private:", v.private_key.private_bytes(...))  # base64url-encode
    print("Public:",  v.public_key.public_bytes(...))    # base64url-encode

If VAPID_PRIVATE_KEY is not configured, push attempts are silently skipped
(no error raised) so the app works in dev without push infrastructure.
"""

import asyncio
import json
import logging
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)

# Thread pool for running synchronous pywebpush calls from async handlers.
_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="push")


def _send_one(endpoint: str, p256dh: str, auth: str, payload: str) -> None:
    """
    Send a single encrypted Web Push message synchronously.

    Called from the thread pool so it does not block the async event loop.
    All exceptions are caught and logged — never re-raised.
    """
    if not settings.vapid_private_key:
        logger.debug("VAPID_PRIVATE_KEY not configured — skipping push to %s", endpoint[:40])
        return

    try:
        from pywebpush import webpush, WebPushException

        webpush(
            subscription_info={
                "endpoint": endpoint,
                "keys": {"p256dh": p256dh, "auth": auth},
            },
            data=payload,
            vapid_private_key=settings.vapid_private_key,
            vapid_claims={
                "sub": settings.vapid_mailto or "mailto:noreply@zivabi.com",
            },
        )
    except Exception as exc:  # WebPushException, ConnectionError, etc.
        # 410 Gone = subscription expired; 404 Not Found = endpoint gone.
        # Both are permanent failures — the subscription should be pruned.
        # We log but don't prune here (would need an async DB session).
        # A background cleanup job can sweep expired endpoints periodically.
        logger.warning("Push delivery failed for endpoint %s…: %s", endpoint[:40], exc)


async def send_push(
    user_id: uuid.UUID,
    app_name: str,
    title: str,
    body: str,
    data: dict[str, Any] | None = None,
    *,
    db_session: Any = None,  # AsyncSession, typed as Any to avoid circular import
) -> None:
    """
    Send a Web Push notification to all subscriptions for (user_id, app_name).

    Parameters:
        user_id:    recipient user's UUID
        app_name:   target PWA ('ziva-expense' | 'ziva-approve' | 'ziva-procure' | 'ziva-insights')
        title:      notification title (displayed in OS notification centre)
        body:       notification body text
        data:       optional dict merged into the push payload; the service
                    worker reads data.url to decide where to navigate on tap
        db_session: AsyncSession to use for the subscription lookup. If None,
                    a new session is opened from AsyncSessionLocal.

    The function is fire-and-forget — exceptions in individual sends are logged
    but not re-raised. Call with asyncio.create_task() to avoid blocking the
    caller's response.
    """
    payload = json.dumps({
        "title": title,
        "body": body,
        "data": data or {},
    })

    from sqlalchemy import select

    try:
        if db_session is not None:
            await _deliver(db_session, user_id, app_name, payload)
        else:
            from app.database import AsyncSessionLocal
            async with AsyncSessionLocal() as db:
                await _deliver(db, user_id, app_name, payload)
    except Exception as exc:
        logger.warning("send_push failed for user %s / app %s: %s", user_id, app_name, exc)


async def _deliver(db: Any, user_id: uuid.UUID, app_name: str, payload: str) -> None:
    """
    Internal: load subscriptions from DB and fan-out to thread pool.
    """
    from sqlalchemy import select
    from app.models.webauthn import PushSubscription

    result = await db.execute(
        select(PushSubscription).where(
            PushSubscription.user_id == user_id,
            PushSubscription.app_name == app_name,
        )
    )
    subs = result.scalars().all()

    if not subs:
        return

    loop = asyncio.get_event_loop()
    tasks = [
        loop.run_in_executor(
            _executor,
            _send_one,
            sub.endpoint,
            sub.p256dh,
            sub.auth,
            payload,
        )
        for sub in subs
    ]
    # Update last_used_at (best-effort; do not await)
    now = datetime.now(timezone.utc)
    for sub in subs:
        sub.last_used_at = now

    await asyncio.gather(*tasks, return_exceptions=True)  # swallow per-task errors
    await db.commit()
