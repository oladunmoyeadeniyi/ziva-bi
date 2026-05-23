"""
ZivaBI — public invitation acceptance router (Milestone 5).

These endpoints require no authentication — they are the entry point for
new users joining a tenant via an invitation link.

Endpoints:
    GET  /api/invitations/validate/{token}  Validate token and return invite details
    POST /api/invitations/accept/{token}    Create account and auto-login
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, generate_refresh_token, hash_password
from app.database import get_db
from app.models.auth import (
    AccountType,
    RefreshToken,
    Role,
    Session,
    Tenant,
    User,
    UserRole,
    UserTenant,
)
from app.models.tenant_management import TenantInvitation
from app.schemas.auth import AuthResponse, UserResponse
from app.schemas.users import InvitationAcceptRequest, InvitationValidateResponse

router = APIRouter(prefix="/api/invitations", tags=["invitations"])


async def _get_valid_invitation(token: str, db: AsyncSession) -> TenantInvitation:
    """
    Fetch and validate an invitation token.

    Raises 404 if the token doesn't exist, 410 (Gone) if it has been used or
    expired so the frontend can show a clear error message to the recipient.
    """
    result = await db.execute(
        select(TenantInvitation).where(TenantInvitation.token == token)
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found.")

    if inv.status == "ACCEPTED":
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This invitation has already been accepted.",
        )

    now = datetime.now(timezone.utc)
    if inv.status == "EXPIRED" or inv.expires_at < now:
        inv.status = "EXPIRED"
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This invitation has expired. Please ask your administrator to send a new one.",
        )

    return inv


@router.get("/validate/{token}", response_model=InvitationValidateResponse)
async def validate_invitation(
    token: str,
    db: AsyncSession = Depends(get_db),
) -> InvitationValidateResponse:
    """
    Validate an invitation token and return display information.

    Called by the frontend accept page on load to show the user who invited
    them and which company they are joining before they fill in their details.
    """
    inv = await _get_valid_invitation(token, db)

    tenant_result = await db.execute(select(Tenant).where(Tenant.id == inv.tenant_id))
    tenant = tenant_result.scalar_one_or_none()

    inviter_result = await db.execute(select(User).where(User.id == inv.invited_by))
    inviter = inviter_result.scalar_one_or_none()

    return InvitationValidateResponse(
        email=inv.email,
        tenant_name=tenant.name if tenant else "your company",
        role=inv.role,
        invited_by_name=inviter.full_name if inviter else "Your administrator",
    )


@router.post("/accept/{token}", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def accept_invitation(
    token: str,
    data: InvitationAcceptRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    """
    Accept an invitation and create a new user account.

    Creates the User + UserTenant, assigns the invited role, marks the invitation
    ACCEPTED, and returns a full auth response so the frontend can auto-login.
    """
    inv = await _get_valid_invitation(token, db)

    # Prevent creating a duplicate account if the email already exists
    existing_user_result = await db.execute(
        select(User).where(User.email == inv.email)
    )
    existing_user = existing_user_result.scalar_one_or_none()
    if existing_user:
        # The email already has an account — just link it to this tenant
        # (handle the case where someone was already registered individually)
        existing_ut = await db.execute(
            select(UserTenant).where(
                UserTenant.user_id == existing_user.id,
                UserTenant.tenant_id == inv.tenant_id,
            )
        )
        if existing_ut.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This email address already has an account in this company.",
            )
        user = existing_user
        user_tenant = UserTenant(
            user_id=user.id,
            tenant_id=inv.tenant_id,
            password_hash=hash_password(data.password),
        )
    else:
        # Brand new user
        user = User(
            email=inv.email,
            full_name=data.full_name,
            account_type=AccountType.business,
        )
        db.add(user)
        await db.flush()

        user_tenant = UserTenant(
            user_id=user.id,
            tenant_id=inv.tenant_id,
            password_hash=hash_password(data.password),
        )

    db.add(user_tenant)
    await db.flush()

    # Assign the invited role
    role_result = await db.execute(
        select(Role).where(Role.name == inv.role, Role.tenant_id.is_(None))
    )
    role = role_result.scalar_one_or_none()
    if role:
        db.add(UserRole(user_tenant_id=user_tenant.id, role_id=role.id))

    # Mark invitation accepted
    inv.status = "ACCEPTED"
    inv.accepted_at = datetime.now(timezone.utc)
    await db.flush()

    # Create session + tokens for auto-login
    from app.config import settings as app_settings
    from datetime import timedelta

    expires_at = datetime.now(timezone.utc) + timedelta(days=app_settings.refresh_token_expire_days)
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")

    session = Session(
        user_tenant_id=user_tenant.id,
        ip_address=ip,
        user_agent=ua,
        expires_at=expires_at,
        is_active=True,
    )
    db.add(session)
    await db.flush()

    raw_token, token_hash = generate_refresh_token()
    db.add(RefreshToken(
        session_id=session.id,
        token_hash=token_hash,
        expires_at=expires_at,
    ))

    is_admin = inv.role == "tenant_admin"
    # Invited users have a single role at accept time; only tenant_admin invites are config-only
    has_non_admin = not is_admin
    access_token = create_access_token({
        "sub": str(user.id),
        "user_tenant_id": str(user_tenant.id),
        "account_type": user.account_type.value,
        "tenant_id": str(inv.tenant_id),
        "session_id": str(session.id),
        "is_super_admin": user.is_super_admin,
        "is_tenant_admin": is_admin,
        "has_non_admin_role": has_non_admin,
    })

    return AuthResponse(
        access_token=access_token,
        refresh_token=raw_token,
        user=UserResponse.from_orm_pair(
            user, inv.tenant_id,
            is_tenant_admin=is_admin,
            has_non_admin_role=has_non_admin,
        ),
    )
