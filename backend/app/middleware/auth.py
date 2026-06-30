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
    is_tenant_admin is True when the user has the tenant_admin role within their tenant.
    has_non_admin_role is True when the user also holds at least one non-tenant_admin role,
    meaning the tenant_admin restrictions (config-only mode) do not apply to them.
    """

    user_id: uuid.UUID
    user_tenant_id: uuid.UUID
    account_type: str          # "individual" | "business"
    tenant_id: uuid.UUID | None
    session_id: uuid.UUID
    is_super_admin: bool = False
    is_tenant_admin: bool = False
    has_non_admin_role: bool = False
    # M8.2: 'power_admin' | 'functional_admin' | None  (consultant removed M9.3a)
    role_tier: str | None = None
    # M9.0: active tenant environment — "live" | "test"
    environment: str = "live"
    # M9.3a: impersonation — set when a super admin enters a tenant via /platform/enter
    impersonator_id: uuid.UUID | None = None
    impersonation_mode: str | None = None  # "implementation" | "support" | None
    # M9.3b: user-level impersonation — set when the SA enters a specific user's identity
    is_user_impersonation: bool = False
    impersonation_session_id: uuid.UUID | None = None


def block_if_readonly_impersonation(current_user: "CurrentUser") -> None:
    """
    Raise 403 if this is a support-mode impersonation on the live environment.

    Support+live = read-only session: the super admin can view operational data
    but must not create, update, or delete any tenant configuration. Call this
    at the top of every write/mutation endpoint (or inside write-gating helpers).
    """
    if (
        current_user.impersonation_mode == "support"
        and current_user.environment == "live"
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Read-only support session — editing/posting is disabled on the live environment.",
        )


def is_restricted_impersonation(current_user: "CurrentUser", settings: object) -> bool:
    """
    Returns True when sensitive personal financial fields should be masked.

    Condition: user-level impersonation session AND live environment AND
    the impersonator is NOT the platform owner.

    Usage: call in any serializer or endpoint that returns salary, bank details,
    TIN, or payroll data. Return None (or "****") instead of the real value
    when this returns True.

    No actual masking is applied yet — payroll/HR (M15) hasn't been built.
    This helper is the hook; wire it into response serializers when M15 ships.
    """
    if not current_user.is_user_impersonation:
        return False
    if current_user.environment != "live":
        return False
    owner_id = getattr(settings, "owner_user_id", None)
    if owner_id and current_user.impersonator_id == uuid.UUID(owner_id):
        return False
    return True


def require_super_admin(current_user: "CurrentUser") -> "CurrentUser":
    """
    FastAPI dependency / guard — raises 403 unless the caller is a super admin.

    Used exclusively for /api/platform/* owner-portal endpoints.
    Compose with require_auth: Depends(require_auth) + call this inside the handler,
    or declare as a separate Depends after require_auth.
    """
    if not current_user.is_super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin access required.",
        )
    return current_user


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
        is_tenant_admin=payload.get("is_tenant_admin", False),
        has_non_admin_role=payload.get("has_non_admin_role", False),
        role_tier=payload.get("role_tier"),
        environment=payload.get("environment", "live"),
        impersonator_id=uuid.UUID(payload["impersonator_id"]) if payload.get("impersonator_id") else None,
        impersonation_mode=payload.get("impersonation_mode"),
        is_user_impersonation=payload.get("is_user_impersonation", False),
        impersonation_session_id=uuid.UUID(payload["impersonation_session_id"]) if payload.get("impersonation_session_id") else None,
    )
