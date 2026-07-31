"""
PRAD — Push subscription router.

Endpoints:
    GET    /api/push/vapid-public-key   Serve VAPID public key (unauthenticated)
    POST   /api/push/subscribe          Save or refresh a push subscription
    DELETE /api/push/subscribe          Remove a push subscription

All write endpoints require a valid access token (require_auth). The VAPID
public key endpoint is intentionally public — it needs to be fetched by the
service worker before the user has authenticated, so it cannot require a token.

Subscribe uses INSERT ... ON CONFLICT DO UPDATE (upsert) keyed on
(user_id, endpoint) — re-subscribing after a browser update refreshes
p256dh/auth without accumulating stale rows.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.middleware.auth import CurrentUser, require_auth
from app.models.webauthn import PushSubscription
from app.schemas.webauthn import (
    PushSubscribeRequest,
    PushUnsubscribeRequest,
    VapidPublicKeyResponse,
)

router = APIRouter(prefix="/api/push", tags=["push"])

_VALID_APP_NAMES = {"ziva-expense", "ziva-approve", "ziva-procure", "ziva-insights"}


@router.get("/vapid-public-key", response_model=VapidPublicKeyResponse)
async def get_vapid_public_key() -> VapidPublicKeyResponse:
    """
    Return the VAPID public key for the browser to use in pushManager.subscribe().

    Unauthenticated — the service worker fetches this before a user session exists.
    Returns HTTP 503 if VAPID_PUBLIC_KEY is not configured (dev without push infra).
    """
    if not settings.vapid_public_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Push notifications are not configured on this server.",
        )
    return VapidPublicKeyResponse(vapid_public_key=settings.vapid_public_key)


@router.post("/subscribe", status_code=status.HTTP_201_CREATED)
async def subscribe(
    data: PushSubscribeRequest,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Save or refresh a Web Push subscription.

    Called by the PWA after pushManager.subscribe() succeeds.
    Upserts on (user_id, endpoint) — if the subscription already exists
    (e.g. browser updated its keys), p256dh, auth, and app_name are refreshed.

    Returns {"status": "subscribed"} on success.
    """
    if data.app_name not in _VALID_APP_NAMES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"app_name must be one of: {', '.join(sorted(_VALID_APP_NAMES))}",
        )

    # Upsert: insert or update on (user_id, endpoint) conflict
    stmt = pg_insert(PushSubscription).values(
        user_id=current_user.user_id,
        endpoint=data.endpoint,
        p256dh=data.p256dh,
        auth=data.auth,
        app_name=data.app_name,
    ).on_conflict_do_update(
        constraint="uq_push_subscriptions_user_endpoint",
        set_={
            "p256dh": data.p256dh,
            "auth": data.auth,
            "app_name": data.app_name,
        },
    )
    await db.execute(stmt)
    await db.commit()
    return {"status": "subscribed"}


@router.delete("/subscribe", status_code=status.HTTP_200_OK)
async def unsubscribe(
    data: PushUnsubscribeRequest,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Remove a push subscription identified by its endpoint URL.

    Called when the user revokes push permission or logs out.
    Silently succeeds if the subscription does not exist (idempotent).

    Returns {"status": "unsubscribed"} on success.
    """
    result = await db.execute(
        select(PushSubscription).where(
            PushSubscription.user_id == current_user.user_id,
            PushSubscription.endpoint == data.endpoint,
        )
    )
    sub = result.scalar_one_or_none()
    if sub:
        await db.delete(sub)
        await db.commit()
    return {"status": "unsubscribed"}
