"""
Public app-config router — no authentication required.

Exposes a minimal read-only subset of platform_config to unauthenticated
clients.  Used by the frontend to display the correct app name on the login
page, signup page, and PWA manifest before a user has authenticated.

Endpoint:
    GET /api/app-config   → { "app_name": "Ziva BI" }

This endpoint is intentionally thin and public.  It must never expose
sensitive platform settings — only values that are safe to show to anyone
who can reach the URL (i.e. the app name and any future public branding
fields like tagline or logo URL).
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.platform_config import get_app_name

router = APIRouter(prefix="/api/app-config", tags=["app-config"])


class AppConfigPublic(BaseModel):
    """
    Public platform configuration returned to unauthenticated clients.

    Fields:
        app_name: The product name displayed across the UI and in emails.
    """

    app_name: str


@router.get("", response_model=AppConfigPublic, summary="Get public app config")
async def get_app_config(db: AsyncSession = Depends(get_db)) -> AppConfigPublic:
    """
    Return the public platform configuration (no auth required).

    Returns the app name (and any future public branding fields) so the
    frontend can display the correct product name on the login/signup pages
    before a user has authenticated.

    Response is cached in-process for 5 minutes — adequate for a value that
    changes at most once in the product lifetime.

    Returns:
        AppConfigPublic with the current app_name.
    """
    name = await get_app_name(db)
    return AppConfigPublic(app_name=name)
