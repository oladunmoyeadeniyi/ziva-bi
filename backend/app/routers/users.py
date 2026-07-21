"""
ZivaBI — users router (Milestones 2 + 5 + profile backend).

Endpoints:
    GET   /api/users/me                          Current user's full profile
    PATCH /api/users/me                          Update own profile
    PATCH /api/users/me/password                 Change own password
    GET   /api/users/tenant                      List tenant users (approver dropdowns)

    GET   /api/users/me/sessions                 List active sessions (is_current flagged)
    DELETE /api/users/me/sessions/{session_id}   Revoke a specific session
    POST  /api/users/me/sessions/revoke-others   Sign out everywhere else

    POST  /api/users/me/2fa/enroll               Generate TOTP secret + otpauth URI
    POST  /api/users/me/2fa/verify               Confirm code → enable 2FA
    POST  /api/users/me/2fa/disable              Verify code → clear 2FA
"""

import uuid
import re as _re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, verify_password
from app.database import get_db
from app.middleware.auth import CurrentUser, require_auth
from app.services.platform_config import get_app_name
from app.models.auth import RefreshToken, Role, Session, User, UserRole, UserTenant
from app.schemas.auth import UserResponse
from app.schemas.approvals import TenantUserResponse
from app.schemas.users import (
    PasswordChangeRequest,
    ProfileUpdateRequest,
    RevokeCountResponse,
    SessionResponse,
    TotpCodeRequest,
    TotpEnrollResponse,
    TotpStatusResponse,
)

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """
    Return the full profile of the currently authenticated user.

    is_tenant_admin is read from the JWT (set at login/refresh) so this
    endpoint never needs a role DB query.
    """
    result = await db.execute(select(User).where(User.id == current_user.user_id))
    user: User | None = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found or deactivated.",
        )

    return UserResponse.from_orm_pair(
        user,
        current_user.tenant_id,
        is_tenant_admin=current_user.is_tenant_admin,
        has_non_admin_role=current_user.has_non_admin_role,
    )


@router.patch("/me", response_model=UserResponse)
async def update_me(
    data: ProfileUpdateRequest,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """
    Update the current user's profile fields.

    Email and password cannot be changed via this endpoint.
    Only the fields present in the request body are updated (partial update).
    """
    result = await db.execute(select(User).where(User.id == current_user.user_id))
    user: User | None = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if data.full_name is not None:
        user.full_name = data.full_name
    if data.employee_code is not None:
        user.employee_code = data.employee_code.strip() or None
    if data.department is not None:
        user.department = data.department.strip() or None
    if data.job_title is not None:
        user.job_title = data.job_title.strip() or None
    if data.phone is not None:
        user.phone = data.phone.strip() or None

    await db.flush()
    return UserResponse.from_orm_pair(
        user,
        current_user.tenant_id,
        is_tenant_admin=current_user.is_tenant_admin,
        has_non_admin_role=current_user.has_non_admin_role,
    )


@router.patch("/me/password", response_model=dict)
async def change_password(
    data: PasswordChangeRequest,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Change the current user's password.

    Requires the current password to prevent account hijacking via
    an unattended session. Returns a simple success message.
    """
    ut_result = await db.execute(
        select(UserTenant).where(
            UserTenant.user_id == current_user.user_id,
            UserTenant.id == current_user.user_tenant_id,
        )
    )
    user_tenant: UserTenant | None = ut_result.scalar_one_or_none()
    if not user_tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User session not found.")

    if not verify_password(data.current_password, user_tenant.password_hash):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Current password is incorrect.",
        )

    user_tenant.password_hash = hash_password(data.new_password)
    await db.flush()
    return {"message": "Password updated successfully."}


@router.get("/tenant", response_model=list[TenantUserResponse])
async def list_tenant_users(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> list[TenantUserResponse]:
    """
    List active users in the current tenant who can act as approvers.

    Exclusively-tenant-admin users (those with only the tenant_admin role and no
    operational roles) are excluded because they cannot participate in approval chains.
    """
    if not current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint is only available to business accounts.",
        )

    # Subquery: user_tenant IDs that hold at least one non-admin role
    has_non_admin = (
        select(UserRole.user_tenant_id)
        .join(Role, UserRole.role_id == Role.id)
        .where(Role.name != "tenant_admin")
        .scalar_subquery()
    )

    # Subquery: user_tenant IDs that are exclusively tenant_admin (admin role + no other role)
    exclusively_admin_ut_ids = (
        select(UserRole.user_tenant_id)
        .join(Role, UserRole.role_id == Role.id)
        .where(
            Role.name == "tenant_admin",
            UserRole.user_tenant_id.not_in(has_non_admin),
        )
        .scalar_subquery()
    )

    result = await db.execute(
        select(User)
        .join(UserTenant, User.id == UserTenant.user_id)
        .where(
            UserTenant.tenant_id == current_user.tenant_id,
            UserTenant.is_active.is_(True),
            User.is_active.is_(True),
            UserTenant.id.not_in(exclusively_admin_ut_ids),
        )
        .order_by(User.full_name)
    )
    users = result.scalars().all()

    return [
        TenantUserResponse(id=str(u.id), full_name=u.full_name, email=u.email)
        for u in users
    ]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_device(user_agent: str | None) -> str:
    """Return a short human-readable browser/platform label from a User-Agent string."""
    if not user_agent:
        return "Unknown device"
    ua = user_agent
    platform = "Mobile" if "Mobile" in ua else "Tablet" if "Tablet" in ua else "Desktop"
    for browser in ("Edg", "Chrome", "Firefox", "Safari", "Opera"):
        if browser in ua:
            label = "Edge" if browser == "Edg" else browser
            return f"{label} / {platform}"
    return f"Browser / {platform}"


async def _revoke_session(session: Session, db: AsyncSession) -> None:
    """Mark a session inactive and revoke all its refresh tokens. Reuses logout logic."""
    now = datetime.now(timezone.utc)
    session.is_active = False
    session.ended_at = now
    rt_result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.session_id == session.id,
            RefreshToken.is_revoked.is_(False),
        )
    )
    for rt in rt_result.scalars().all():
        rt.is_revoked = True
        rt.used_at = now


# ── Active sessions ───────────────────────────────────────────────────────────

@router.get("/me/sessions", response_model=list[SessionResponse])
async def list_sessions(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> list[SessionResponse]:
    """
    List the caller's active, non-expired sessions.

    is_current=True marks the session belonging to the token used for this request.
    """
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Session)
        .join(UserTenant, Session.user_tenant_id == UserTenant.id)
        .where(
            UserTenant.user_id == current_user.user_id,
            Session.is_active.is_(True),
            Session.expires_at > now,
        )
        .order_by(Session.created_at.desc())
    )
    sessions = result.scalars().all()

    return [
        SessionResponse(
            id=str(s.id),
            device=_parse_device(s.user_agent),
            ip_address=s.ip_address,
            created_at=s.created_at,
            expires_at=s.expires_at,
            is_current=(s.id == current_user.session_id),
        )
        for s in sessions
    ]


@router.delete("/me/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_session(
    session_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Revoke a specific session.

    Cannot revoke the caller's own current session — use POST /api/auth/logout for that.
    Attempting to do so returns 400.
    """
    if session_id == current_user.session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot revoke your current session via this endpoint. Use POST /api/auth/logout instead.",
        )

    result = await db.execute(
        select(Session)
        .join(UserTenant, Session.user_tenant_id == UserTenant.id)
        .where(
            Session.id == session_id,
            UserTenant.user_id == current_user.user_id,
            Session.is_active.is_(True),
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")

    await _revoke_session(session, db)
    await db.flush()


@router.post("/me/sessions/revoke-others", response_model=RevokeCountResponse)
async def revoke_other_sessions(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> RevokeCountResponse:
    """
    Sign out everywhere else — revoke all sessions except the current one.

    Returns the count of sessions revoked.
    """
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Session)
        .join(UserTenant, Session.user_tenant_id == UserTenant.id)
        .where(
            UserTenant.user_id == current_user.user_id,
            Session.id != current_user.session_id,
            Session.is_active.is_(True),
            Session.expires_at > now,
        )
    )
    others = result.scalars().all()

    for s in others:
        await _revoke_session(s, db)

    await db.flush()
    count = len(others)
    return RevokeCountResponse(
        revoked=count,
        message=f"{count} session(s) revoked. You remain signed in on this device.",
    )


# ── TOTP 2FA ──────────────────────────────────────────────────────────────────

@router.post("/me/2fa/enroll", response_model=TotpEnrollResponse)
async def enroll_2fa(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> TotpEnrollResponse:
    """
    Generate a new TOTP secret and provisioning URI.

    The secret is persisted immediately but totp_enabled stays False until the
    user calls /verify with a valid code. Call /enroll again to rotate the secret
    (e.g. if the user lost access to their authenticator).
    """
    import pyotp

    result = await db.execute(select(User).where(User.id == current_user.user_id))
    user: User | None = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    secret = pyotp.random_base32()
    user.totp_secret = secret
    user.totp_enabled = False  # not yet confirmed
    await db.flush()

    issuer = await get_app_name(db)
    uri = pyotp.TOTP(secret).provisioning_uri(name=user.email, issuer_name=issuer)
    return TotpEnrollResponse(secret=secret, uri=uri)


@router.post("/me/2fa/verify", response_model=TotpStatusResponse)
async def verify_2fa(
    data: TotpCodeRequest,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> TotpStatusResponse:
    """
    Confirm enrollment — verify the 6-digit code against the enrolled secret.

    On success, sets totp_enabled=True. The user must call /enroll first.
    Allows ±1 TOTP window (30 s) to tolerate clock drift.
    """
    import pyotp

    result = await db.execute(select(User).where(User.id == current_user.user_id))
    user: User | None = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    if not user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No TOTP secret found. Call POST /api/users/me/2fa/enroll first.",
        )

    if not pyotp.TOTP(user.totp_secret).verify(data.code, valid_window=1):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid 2FA code. Check your authenticator app and try again.",
        )

    user.totp_enabled = True
    await db.flush()
    return TotpStatusResponse(totp_enabled=True, message="2FA enabled successfully.")


@router.post("/me/2fa/disable", response_model=TotpStatusResponse)
async def disable_2fa(
    data: TotpCodeRequest,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> TotpStatusResponse:
    """
    Disable TOTP 2FA.

    Requires a valid current TOTP code (not the password) so disabling
    requires physical access to the authenticator device.
    """
    import pyotp

    result = await db.execute(select(User).where(User.id == current_user.user_id))
    user: User | None = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    if not user.totp_enabled or not user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA is not currently enabled.",
        )

    if not pyotp.TOTP(user.totp_secret).verify(data.code, valid_window=1):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid 2FA code.",
        )

    user.totp_secret = None
    user.totp_enabled = False
    await db.flush()
    return TotpStatusResponse(totp_enabled=False, message="2FA disabled successfully.")
