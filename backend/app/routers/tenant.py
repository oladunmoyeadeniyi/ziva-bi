"""
ZivaBI — tenant admin management router (Milestone 5).

All endpoints require Tenant Admin role. They allow the admin to view and
manage all users within their tenant and send invitations for new members.

Endpoints:
    GET    /api/tenant/users                    List all users in tenant
    GET    /api/tenant/users/{user_id}          Get single user detail
    PATCH  /api/tenant/users/{user_id}/roles    Replace user's roles
    PATCH  /api/tenant/users/{user_id}/deactivate  Soft-deactivate a user
    PATCH  /api/tenant/users/{user_id}/reactivate  Reactivate a user
    POST   /api/tenant/invitations              Send a new invitation
    GET    /api/tenant/invitations              List all invitations for tenant
    DELETE /api/tenant/invitations/{invite_id}  Cancel a pending invitation
"""

import secrets
import smtplib
import uuid
from datetime import datetime, timedelta, timezone
from email.mime.text import MIMEText

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.middleware.auth import CurrentUser, require_auth
from app.models.auth import Role, Tenant, User, UserRole, UserTenant
from app.models.tenant_management import TenantInvitation
from app.schemas.users import (
    InvitationCreate,
    InvitationResponse,
    RoleAssignRequest,
    TenantUserDetail,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tenant", tags=["tenant"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _require_tenant_admin(current_user: CurrentUser) -> uuid.UUID:
    """Raise 403 if caller is not a tenant admin. Returns tenant_id."""
    if current_user.tenant_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Business account required.")
    if not current_user.is_tenant_admin and not current_user.is_super_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant Admin access required.")
    return current_user.tenant_id


async def _get_user_roles(user_id: uuid.UUID, tenant_id: uuid.UUID, db: AsyncSession) -> list[str]:
    """Return list of role names for a user within a tenant."""
    result = await db.execute(
        select(Role.name)
        .join(UserRole, Role.id == UserRole.role_id)
        .join(UserTenant, UserRole.user_tenant_id == UserTenant.id)
        .where(
            UserTenant.user_id == user_id,
            UserTenant.tenant_id == tenant_id,
        )
    )
    return list(result.scalars().all())


async def _get_tenant_member_or_404(
    user_id: uuid.UUID,
    tenant_id: uuid.UUID,
    db: AsyncSession,
) -> tuple[User, UserTenant]:
    """Fetch a User + UserTenant pair scoped to the tenant, raising 404 if not found."""
    result = await db.execute(
        select(User, UserTenant)
        .join(UserTenant, User.id == UserTenant.user_id)
        .where(
            User.id == user_id,
            UserTenant.tenant_id == tenant_id,
        )
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found in this tenant.")
    return row[0], row[1]


def _send_invitation_email(
    to_email: str,
    tenant_name: str,
    invited_by_name: str,
    role: str,
    accept_url: str,
) -> None:
    """Send invitation email; console-logs when SMTP is not configured."""
    subject = f"You've been invited to join {tenant_name} on Ziva BI"
    body = (
        f"{invited_by_name} has invited you to join {tenant_name} on Ziva BI as {role}.\n\n"
        f"Click the link below to accept your invitation:\n{accept_url}\n\n"
        f"This link expires in 48 hours."
    )

    if not all([settings.smtp_host, settings.smtp_user, settings.smtp_password]):
        logger.info(
            "[EMAIL SIMULATION] Invitation\nTo: %s\nSubject: %s\n\n%s",
            to_email, subject, body,
        )
        return

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from_email or settings.smtp_user
    msg["To"] = to_email
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as smtp:
            smtp.starttls()
            smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(msg)
    except Exception as exc:
        logger.warning("Failed to send invitation email to %s: %s", to_email, exc)


# ── User Listing ──────────────────────────────────────────────────────────────

@router.get("/users", response_model=list[TenantUserDetail])
async def list_users(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> list[TenantUserDetail]:
    """List all users (active and inactive) in the current tenant."""
    tenant_id = _require_tenant_admin(current_user)

    result = await db.execute(
        select(User, UserTenant)
        .join(UserTenant, User.id == UserTenant.user_id)
        .where(UserTenant.tenant_id == tenant_id)
        .order_by(User.full_name)
    )
    rows = result.all()

    items = []
    for user, ut in rows:
        roles = await _get_user_roles(user.id, tenant_id, db)
        items.append(TenantUserDetail(
            id=str(user.id),
            full_name=user.full_name,
            email=user.email,
            employee_code=user.employee_code,
            department=user.department,
            job_title=user.job_title,
            phone=user.phone,
            roles=roles,
            is_active=ut.is_active,
            created_at=ut.created_at,
        ))
    return items


@router.get("/users/{user_id}", response_model=TenantUserDetail)
async def get_user(
    user_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> TenantUserDetail:
    """Get a single tenant user's profile and roles."""
    tenant_id = _require_tenant_admin(current_user)
    user, ut = await _get_tenant_member_or_404(user_id, tenant_id, db)
    roles = await _get_user_roles(user.id, tenant_id, db)

    return TenantUserDetail(
        id=str(user.id),
        full_name=user.full_name,
        email=user.email,
        employee_code=user.employee_code,
        department=user.department,
        job_title=user.job_title,
        phone=user.phone,
        roles=roles,
        is_active=ut.is_active,
        created_at=ut.created_at,
    )


# ── Role Assignment ───────────────────────────────────────────────────────────

@router.patch("/users/{user_id}/roles", response_model=TenantUserDetail)
async def assign_roles(
    user_id: uuid.UUID,
    data: RoleAssignRequest,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> TenantUserDetail:
    """
    Replace all roles for a user within the current tenant.

    Deletes all existing UserRole rows for the user_tenant and creates new ones.
    Admins cannot change their own roles.
    """
    tenant_id = _require_tenant_admin(current_user)

    if user_id == current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot change your own roles.",
        )

    user, ut = await _get_tenant_member_or_404(user_id, tenant_id, db)

    # Delete existing role assignments
    existing_roles_result = await db.execute(
        select(UserRole).where(UserRole.user_tenant_id == ut.id)
    )
    for ur in existing_roles_result.scalars().all():
        await db.delete(ur)
    await db.flush()

    # Assign new roles
    for role_name in data.roles:
        role_result = await db.execute(
            select(Role).where(Role.name == role_name, Role.tenant_id.is_(None))
        )
        role = role_result.scalar_one_or_none()
        if role:
            db.add(UserRole(
                user_tenant_id=ut.id,
                role_id=role.id,
                assigned_by_id=current_user.user_id,
            ))

    await db.flush()

    roles = await _get_user_roles(user.id, tenant_id, db)
    return TenantUserDetail(
        id=str(user.id),
        full_name=user.full_name,
        email=user.email,
        employee_code=user.employee_code,
        department=user.department,
        job_title=user.job_title,
        phone=user.phone,
        roles=roles,
        is_active=ut.is_active,
        created_at=ut.created_at,
    )


# ── Deactivate / Reactivate ───────────────────────────────────────────────────

@router.patch("/users/{user_id}/deactivate", response_model=TenantUserDetail)
async def deactivate_user(
    user_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> TenantUserDetail:
    """
    Soft-deactivate a user — sets UserTenant.is_active = False.

    The user will receive an error on their next login attempt.
    Admins cannot deactivate themselves.
    """
    tenant_id = _require_tenant_admin(current_user)

    if user_id == current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own account.",
        )

    user, ut = await _get_tenant_member_or_404(user_id, tenant_id, db)
    ut.is_active = False
    await db.flush()

    roles = await _get_user_roles(user.id, tenant_id, db)
    return TenantUserDetail(
        id=str(user.id), full_name=user.full_name, email=user.email,
        employee_code=user.employee_code, department=user.department,
        job_title=user.job_title, phone=user.phone,
        roles=roles, is_active=ut.is_active, created_at=ut.created_at,
    )


@router.patch("/users/{user_id}/reactivate", response_model=TenantUserDetail)
async def reactivate_user(
    user_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> TenantUserDetail:
    """Reactivate a previously deactivated user."""
    tenant_id = _require_tenant_admin(current_user)
    user, ut = await _get_tenant_member_or_404(user_id, tenant_id, db)
    ut.is_active = True
    await db.flush()

    roles = await _get_user_roles(user.id, tenant_id, db)
    return TenantUserDetail(
        id=str(user.id), full_name=user.full_name, email=user.email,
        employee_code=user.employee_code, department=user.department,
        job_title=user.job_title, phone=user.phone,
        roles=roles, is_active=ut.is_active, created_at=ut.created_at,
    )


# ── Invitations ───────────────────────────────────────────────────────────────

@router.post("/invitations", response_model=InvitationResponse, status_code=status.HTTP_201_CREATED)
async def create_invitation(
    data: InvitationCreate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> InvitationResponse:
    """
    Send an invitation for a new user to join the tenant.

    Validates the email is not already a member. Creates a PENDING invitation
    with a 48-hour expiry and sends an email with the accept link.
    """
    tenant_id = _require_tenant_admin(current_user)

    # Check email not already in this tenant
    existing = await db.execute(
        select(User)
        .join(UserTenant, User.id == UserTenant.user_id)
        .where(UserTenant.tenant_id == tenant_id, User.email == data.email)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This email address is already a member of your company.",
        )

    # Check no active pending invitation for the same email
    pending = await db.execute(
        select(TenantInvitation).where(
            TenantInvitation.tenant_id == tenant_id,
            TenantInvitation.email == data.email,
            TenantInvitation.status == "PENDING",
        )
    )
    if pending.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A pending invitation already exists for this email address.",
        )

    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=48)

    invitation = TenantInvitation(
        tenant_id=tenant_id,
        invited_by=current_user.user_id,
        email=data.email,
        role=data.role,
        token=token,
        status="PENDING",
        expires_at=expires_at,
    )
    db.add(invitation)
    await db.flush()

    # Fetch inviter and tenant details for the email
    inviter_result = await db.execute(select(User).where(User.id == current_user.user_id))
    inviter = inviter_result.scalar_one_or_none()
    tenant_result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = tenant_result.scalar_one_or_none()

    inviter_name = inviter.full_name if inviter else "Your administrator"
    tenant_name = tenant.name if tenant else "your company"
    accept_url = f"{settings.frontend_url}/invite/accept?token={token}"

    _send_invitation_email(
        to_email=data.email,
        tenant_name=tenant_name,
        invited_by_name=inviter_name,
        role=data.role,
        accept_url=accept_url,
    )

    return InvitationResponse(
        id=str(invitation.id),
        email=invitation.email,
        role=invitation.role,
        status=invitation.status,
        invited_by_name=inviter_name,
        expires_at=invitation.expires_at,
        accepted_at=invitation.accepted_at,
        created_at=invitation.created_at,
    )


@router.get("/invitations", response_model=list[InvitationResponse])
async def list_invitations(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> list[InvitationResponse]:
    """List all invitations for the current tenant, most recent first."""
    tenant_id = _require_tenant_admin(current_user)

    result = await db.execute(
        select(TenantInvitation, User)
        .join(User, TenantInvitation.invited_by == User.id, isouter=True)
        .where(TenantInvitation.tenant_id == tenant_id)
        .order_by(TenantInvitation.created_at.desc())
    )
    rows = result.all()

    # Auto-expire invitations past their expiry date
    now = datetime.now(timezone.utc)
    items = []
    for inv, inviter in rows:
        if inv.status == "PENDING" and inv.expires_at < now:
            inv.status = "EXPIRED"
        items.append(InvitationResponse(
            id=str(inv.id),
            email=inv.email,
            role=inv.role,
            status=inv.status,
            invited_by_name=inviter.full_name if inviter else "—",
            expires_at=inv.expires_at,
            accepted_at=inv.accepted_at,
            created_at=inv.created_at,
        ))
    return items


@router.delete("/invitations/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_invitation(
    invitation_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Cancel (delete) a pending invitation."""
    tenant_id = _require_tenant_admin(current_user)

    result = await db.execute(
        select(TenantInvitation).where(
            TenantInvitation.id == invitation_id,
            TenantInvitation.tenant_id == tenant_id,
        )
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found.")
    if inv.status != "PENDING":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending invitations can be cancelled.",
        )

    await db.delete(inv)
    await db.flush()
