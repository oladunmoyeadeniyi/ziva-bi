"""
ZivaBI — tenant admin management router (Milestone 5 + M9.0).

All endpoints require Tenant Admin role. They allow the admin to view and
manage all users within their tenant and send invitations for new members.

M9.0 environment endpoints (consultant / admin only):
    POST   /api/tenant/create-test-environment  Create or retrieve the shadow test tenant
    POST   /api/tenant/promote                  Copy selected config sections test → live
    POST   /api/tenant/purge-test-data          STUB — no-op (scheduled purge not yet built)

Existing endpoints:
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
from app.middleware.auth import CurrentUser, require_auth, block_if_readonly_impersonation
from app.models.auth import AuditLog, Role, Tenant, User, UserRole, UserTenant
from app.models.tenant_management import TenantInvitation
from app.services.platform_config import get_app_name
from app.schemas.auth import CreateTestEnvRequest, PromoteRequest, PromoteResponse, TestTenantResponse
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
    block_if_readonly_impersonation(current_user)
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
    app_name: str = "Ziva BI",
) -> None:
    """Send invitation email; console-logs when SMTP is not configured."""
    subject = f"You've been invited to join {tenant_name} on {app_name}"
    body = (
        f"{invited_by_name} has invited you to join {tenant_name} on {app_name} as {role}.\n\n"
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


# ── M9.0 helpers ─────────────────────────────────────────────────────────────

def _require_consultant(current_user: CurrentUser) -> uuid.UUID:
    """Raise 403 if caller is not a super admin. Returns tenant_id.

    M9.3a: consultant role_tier stripped from tenant users; super admin
    impersonation (implementation mode) is the new path for these operations.
    """
    if current_user.tenant_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant context required.")
    if not current_user.is_super_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super admin access required.")
    return current_user.tenant_id


# ── M9.0: Create test environment ────────────────────────────────────────────

@router.post("/create-test-environment", response_model=TestTenantResponse, status_code=status.HTTP_201_CREATED)
async def create_test_environment(
    data: CreateTestEnvRequest | None = None,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> TestTenantResponse:
    """
    Create (or return the existing) shadow test tenant for the caller's live tenant.

    Idempotent — if a test tenant already exists it is returned unchanged.
    Grants the same users (all UserTenant rows from live) access to the test tenant
    with the same role, role_tier, and is_active. Caller must be on a live tenant.

    clone_data (default True): if True, copies all active config/master-data from
    the live tenant into the new test shadow immediately after creation.  Set False
    to create an empty shadow (original behaviour preserved).
    """
    tenant_id = _require_tenant_admin(current_user)

    # ── Guard: caller must be on a live tenant ────────────────────────────────
    live_res = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    live_tenant: Tenant | None = live_res.scalar_one_or_none()
    if not live_tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found.")
    if getattr(live_tenant, "environment", "live") != "live":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You are already on a test tenant. Switch to the live tenant first.",
        )

    # ── Idempotency: return existing test shadow if present ───────────────────
    existing_res = await db.execute(
        select(Tenant).where(
            Tenant.parent_tenant_id == tenant_id,
            Tenant.environment == "test",  # type: ignore[arg-type]
        )
    )
    existing = existing_res.scalar_one_or_none()
    if existing:
        return TestTenantResponse(
            id=str(existing.id),
            name=existing.name,
            slug=existing.slug,
            environment=existing.environment,
            parent_tenant_id=str(existing.parent_tenant_id),
            lifecycle_status=existing.lifecycle_status,
            created_at=existing.created_at,
        )

    # ── Create the shadow test tenant ─────────────────────────────────────────
    import re as _re

    def _make_slug(name: str) -> str:
        return _re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:50] or "test"

    base_slug = _make_slug(f"{live_tenant.slug}-test")
    # Ensure slug uniqueness
    test_slug = base_slug
    while True:
        slug_check = await db.execute(select(Tenant).where(Tenant.slug == test_slug))
        if slug_check.scalar_one_or_none() is None:
            break
        import secrets as _secrets
        test_slug = f"{base_slug}-{_secrets.token_hex(3)}"

    test_tenant = Tenant(
        name=f"{live_tenant.name} (Test)",
        country=live_tenant.country,
        slug=test_slug,
        environment="test",
        parent_tenant_id=live_tenant.id,
        lifecycle_status=getattr(live_tenant, "lifecycle_status", "in_implementation"),
        is_active=True,
    )
    db.add(test_tenant)
    await db.flush()  # get test_tenant.id

    # ── Mirror all live UserTenants to the test tenant ────────────────────────
    live_uts_res = await db.execute(
        select(UserTenant).where(UserTenant.tenant_id == tenant_id)
    )
    live_uts = live_uts_res.scalars().all()
    for live_ut in live_uts:
        test_ut = UserTenant(
            user_id=live_ut.user_id,
            tenant_id=test_tenant.id,
            password_hash=live_ut.password_hash,
            is_active=live_ut.is_active,
            role_tier=live_ut.role_tier,
        )
        db.add(test_ut)

    await db.flush()

    # ── Phase 4: Clone live config/master-data into the new test shadow ───────
    clone_summary = None
    should_clone = (data.clone_data if data is not None else True)
    if should_clone:
        from app.services.tenant_clone import clone_tenant_data
        clone_result = await clone_tenant_data(db, tenant_id, test_tenant.id)
        clone_summary = clone_result.to_dict()

    return TestTenantResponse(
        id=str(test_tenant.id),
        name=test_tenant.name,
        slug=test_tenant.slug,
        environment=test_tenant.environment,
        parent_tenant_id=str(test_tenant.parent_tenant_id),
        lifecycle_status=test_tenant.lifecycle_status,
        created_at=test_tenant.created_at,
        clone_summary=clone_summary,
    )


# ── M9.0: Promote test → live ────────────────────────────────────────────────

# Config sections that are straightforward single-row JSONB blobs — safe to copy.
# chart_of_accounts and dimensions are deferred: they contain internal FKs
# (account_group → account, dimension_value → dimension) that require id remapping
# to avoid referential corruption in the live tenant. Periods are operational
# (status machine), not pure config, so they are also deferred.
_DEFERRED_SECTIONS = {"chart_of_accounts", "dimensions", "periods"}

@router.post("/promote", response_model=PromoteResponse, deprecated=True)
async def promote(
    data: PromoteRequest,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> PromoteResponse:
    """
    DEPRECATED (M9.0.1) — superseded by the unified platform promotion engine.

    org_config / tax / fx promotion now happens automatically as part of
    POST /api/platform/tenants/{tenant_id}/promotion/apply, which also
    creates the live tenant on a test tenant's first promotion and handles
    CoA / Dimensions / DimensionValues / GLDimensionRequirements /
    AccountMappings in the same transaction (see
    app/routers/platform.py + app/services/promotion_engine.py).

    Kept as a 410 stub (not removed/404) so any client still calling this
    route gets a clear redirect message instead of a confusing not-found.
    """
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail=(
            "This endpoint is deprecated. Promotion (org_config/tax/fx, and "
            "creation of the live tenant on first promotion) is now handled by "
            "the platform promotion engine: POST /api/platform/tenants/{tenant_id}/"
            "promotion/diff then POST .../promotion/apply (super-admin only)."
        ),
    )


# ── M9.0: Purge test data (stub) ─────────────────────────────────────────────

@router.post("/purge-test-data")
async def purge_test_data(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    NOT YET IMPLEMENTED — returns 501. Scheduled purge of test transactional data.

    # FUTURE: when implemented, will delete transactional rows (expenses, journals,
    # approval events, documents) older than Tenant.test_data_retention_days (default 90)
    # in test-environment tenants only. Gated strictly on environment='test'.
    # Config-only tables (CoA, dimensions, tax, org_config, fx) are never purged.
    # Will require a background scheduler (APScheduler or Celery Beat).
    """
    _require_consultant(current_user)
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail=(
            "Test data purge is not yet implemented. "
            "To purge test data manually, delete rows directly in the test tenant database, "
            "or re-create the test environment via POST /api/tenant/create-test-environment."
        ),
    )


# ── User Listing ──────────────────────────────────────────────────────────────

@router.get("/users", response_model=list[TenantUserDetail])
async def list_users(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> list[TenantUserDetail]:
    """List all users (active and inactive) in the current tenant.

    employee_code and department are read from the HR employees table (source of
    truth), not from user profile fields, so they always reflect current HR data.
    """
    tenant_id = _require_tenant_admin(current_user)

    result = await db.execute(
        select(User, UserTenant)
        .join(UserTenant, User.id == UserTenant.user_id)
        .where(UserTenant.tenant_id == tenant_id)
        .order_by(User.full_name)
    )
    rows = result.all()

    # Batch-resolve employee_code and cost_center (department) from the HR table
    # by email match. HR is the source of truth — user profile fields are secondary.
    from app.models.master_data import Employee
    from app.models.setup import OrgStructureNode
    from sqlalchemy.orm import selectinload as _sl
    emails = [user.email for user, _ in rows]
    emp_result = await db.execute(
        select(Employee)
        .options(_sl(Employee.cost_center))
        .where(
            Employee.tenant_id == tenant_id,
            Employee.email.in_(emails),
        )
    )
    emp_by_email: dict[str, Employee] = {
        e.email.lower(): e for e in emp_result.scalars().all()
    }

    items = []
    for user, ut in rows:
        roles = await _get_user_roles(user.id, tenant_id, db)
        emp = emp_by_email.get(user.email.lower())
        items.append(TenantUserDetail(
            id=str(user.id),
            full_name=user.full_name,
            email=user.email,
            # Prefer HR employee record; fall back to user profile field
            employee_code=emp.employee_code if emp else user.employee_code,
            department=(emp.cost_center.name if emp and emp.cost_center else None) or user.department,
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

    from app.models.master_data import Employee
    from sqlalchemy.orm import selectinload as _sl
    emp_res = await db.execute(
        select(Employee)
        .options(_sl(Employee.cost_center))
        .where(Employee.tenant_id == tenant_id, Employee.email == user.email)
    )
    emp = emp_res.scalar_one_or_none()

    return TenantUserDetail(
        id=str(user.id),
        full_name=user.full_name,
        email=user.email,
        employee_code=emp.employee_code if emp else user.employee_code,
        department=(emp.cost_center.name if emp and emp.cost_center else None) or user.department,
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


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_tenant_user(
    user_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Remove a user from this tenant.

    Pre-live: hard-deletes the UserTenant row. If the user has no other tenant
    memberships, the global User row is also removed. Use this to clean up
    generic or test accounts created before the employee auto-sync was in place.

    Post-live: deactivates instead (audit safety — never hard-delete a live user).

    Cannot remove yourself.
    """
    tenant_id = _require_tenant_admin(current_user)

    if user_id == current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot remove your own account.",
        )

    user, ut = await _get_tenant_member_or_404(user_id, tenant_id, db)

    tenant_res = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant_row = tenant_res.scalar_one_or_none()
    is_live = tenant_row is not None and tenant_row.lifecycle_status == "live"

    if is_live:
        ut.is_active = False
        await db.flush()
    else:
        # Hard-delete membership; cascade-remove global User if they belong nowhere else.
        await db.delete(ut)
        await db.flush()
        other_result = await db.execute(
            select(UserTenant).where(UserTenant.user_id == user.id)
        )
        if not other_result.scalar_one_or_none():
            await db.delete(user)
        await db.flush()


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
    app_name = await get_app_name(db)

    _send_invitation_email(
        to_email=data.email,
        tenant_name=tenant_name,
        invited_by_name=inviter_name,
        role=data.role,
        accept_url=accept_url,
        app_name=app_name,
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
        accept_url=accept_url,
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
        pending_url = (
            f"{settings.frontend_url}/invite/accept?token={inv.token}"
            if inv.status == "PENDING"
            else None
        )
        items.append(InvitationResponse(
            id=str(inv.id),
            email=inv.email,
            role=inv.role,
            status=inv.status,
            invited_by_name=inviter.full_name if inviter else "—",
            expires_at=inv.expires_at,
            accepted_at=inv.accepted_at,
            created_at=inv.created_at,
            accept_url=pending_url,
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
