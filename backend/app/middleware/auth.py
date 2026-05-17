"""
ZivaBI — authentication dependency.

Provides the `require_auth` FastAPI dependency that any protected route
can declare. It extracts and validates the JWT from the Authorization header
and returns a lightweight CurrentUser object — no database query, just token
decoding. For endpoints that need the full User ORM record, compose this
dependency with a DB lookup.

Usage in a router:
    from app.middleware.auth import require_auth, CurrentUser

    @router.get("/example")
    async def example(current_user: CurrentUser = Depends(require_auth)):
        return {"user_id": str(current_user.user_id)}
"""

import uuid
from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError

from app.core.security import decode_access_token

_bearer = HTTPBearer()


@dataclass
class CurrentUser:
    """
    Decoded JWT payload — available in every protected request without a DB hit.

    Fields mirror the JWT payload structure defined in app/core/security.py.
    """

    user_id: uuid.UUID
    user_tenant_id: uuid.UUID
    account_type: str          # "individual" | "business"
    tenant_id: uuid.UUID | None
    session_id: uuid.UUID
    is_super_admin: bool = False


async def require_auth(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> CurrentUser:
    """
    FastAPI dependency — validates the Bearer JWT and returns a CurrentUser.

    Raises HTTP 401 if the token is missing, expired, or tampered with.
    Compose with `get_db` when you also need the full ORM User record.
    """
    try:
        payload = decode_access_token(credentials.credentials)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return CurrentUser(
        user_id=uuid.UUID(payload["sub"]),
        user_tenant_id=uuid.UUID(payload["user_tenant_id"]),
        account_type=payload["account_type"],
        tenant_id=uuid.UUID(payload["tenant_id"]) if payload.get("tenant_id") else None,
        session_id=uuid.UUID(payload["session_id"]),
        is_super_admin=payload.get("is_super_admin", False),
    )
