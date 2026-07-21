"""
ZivaBI — platform (owner portal) router — M9.1.

All endpoints are super-admin only. This is the Ziva BI internal management
surface — it crosses all tenant boundaries and must never be exposed to
tenant-scoped users.

Endpoints:
    GET   /api/platform/tenants                          List tenants (default: live only)
    GET   /api/platform/tenants/{tenant_id}              Tenant detail + users + modules
    PATCH /api/platform/tenants/{tenant_id}/lifecycle    Transition lifecycle state (not suspended)
    POST  /api/platform/tenants/{tenant_id}/suspend      Suspend tenant (blocks login)
    POST  /api/platform/tenants/{tenant_id}/reactivate   Restore prior lifecycle state

Default list scope: LIVE tenants only (environment="live"), regardless of
parent_tenant_id — a live tenant born from promotion (M9.0.1) has
parent_tenant_id pointing at its test origin and still appears here. Use
?environment=test or ?environment=all to widen.

Suspend idempotency: POST /suspend on an already-suspended tenant returns 409.
"""

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.database import get_db
from app.middleware.auth import CurrentUser, require_auth, require_super_admin
from app.config import settings
from app.models.auth import AuditLog, ImpersonationSession, Role, Tenant, User, UserRole, UserTenant
from app.models.gl import JournalEntry
from app.models.platform_config import PlatformConfig
from app.services.platform_config import get_platform_config, set_config
from app.schemas.auth import PromoteRequest, PromoteResponse, TestTenantResponse
from app.schemas.platform import (
    CreateTenantRequest,
    CreateTenantResponse,
    NukeTenantRequest,
    EnterTenantRequest,
    EnterTenantResponse,
    ImpersonationEndResponse,
    ImpersonatedUserSummary,
    LifecycleUpdateRequest,
    ModuleLicenseItem,
    PromotionApplyRequest,
    PromotionApplyResult,
    PromotionDiff,
    SuspendResponse,
    SystemConfigResponse,
    SystemConfigUpdate,
    TenantDetail,
    TenantListItem,
    TenantUserSummary,
    TestEnvSummary,
    TrialLeadUpdate,
    TrialListItem,
    UserImpersonateRequest,
    UserImpersonateResponse,
)

router = APIRouter(prefix="/api/platform", tags=["platform"])

_VALID_LIFECYCLE = frozenset({"trial", "in_implementation", "live", "suspended"})


# ── Guard ─────────────────────────────────────────────────────────────────────

def _sa(current_user: CurrentUser) -> CurrentUser:
    """Inline super-admin guard — returns current_user or raises 403."""
    return require_super_admin(current_user)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _mint_impersonation_token(
    impersonator: CurrentUser,
    target_tenant_id: uuid.UUID,
    environment: str,
    impersonation_mode: str,
) -> str:
    """
    Mint a short-lived impersonation access token for a super admin entering a tenant.

    user_tenant_id = the super admin's own UserTenant (they have no UserTenant on
    the target tenant). tenant_id = target tenant so all tenant-scoped DB queries
    resolve correctly. impersonator_id is preserved for audit trail. No new DB
    session is created — the impersonation token references the super admin's own
    session_id and is valid for one standard access_token expiry window.
    """
    return create_access_token({
        "sub": str(impersonator.user_id),
        "user_tenant_id": str(impersonator.user_tenant_id),
        "account_type": "business",          # target is always a business tenant
        "tenant_id": str(target_tenant_id),
        "session_id": str(impersonator.session_id),
        "is_super_admin": True,
        "is_tenant_admin": False,
        "has_non_admin_role": False,
        "role_tier": None,
        "environment": environment,
        "impersonator_id": str(impersonator.user_id),
        "impersonation_mode": impersonation_mode,
    })


async def _get_tenant_or_404(tenant_id: uuid.UUID, db: AsyncSession) -> Tenant:
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found.")
    return tenant


async def _log(
    event_type: str,
    user_id: uuid.UUID,
    tenant_id: uuid.UUID,
    metadata: dict,
    db: AsyncSession,
) -> None:
    db.add(AuditLog(
        event_type=event_type,
        user_id=user_id,
        tenant_id=tenant_id,
        log_metadata=metadata,
    ))


# ── Enter tenant (impersonation) — M9.3a ─────────────────────────────────────

@router.post("/tenants/{tenant_id}/enter", response_model=EnterTenantResponse)
async def enter_tenant(
    tenant_id: uuid.UUID,
    data: Optional[EnterTenantRequest] = Body(default=None),
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> EnterTenantResponse:
    """
    Mint an impersonation token allowing the super admin to act inside a tenant.

    Mode is determined by the tenant's lifecycle_status:
      trial | in_implementation → implementation mode (full edit, any env)
      live                      → support mode on live (read-only) by default;
                                  pass { environment: "test" } to route to the test
                                  shadow with full edit access instead
      suspended                 → 409 (cannot enter a suspended tenant)

    The returned access_token carries tenant_id=target, is_super_admin=True,
    impersonation_mode, and impersonator_id. No refresh token is issued — the
    token lives for one standard access-token window; re-enter to refresh.
    """
    _sa(current_user)

    target = await _get_tenant_or_404(tenant_id, db)

    lifecycle = target.lifecycle_status
    if lifecycle == "suspended":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot enter a suspended tenant.",
        )

    requested_env = (data.environment if data else "live") if lifecycle == "live" else target.environment

    # ── Determine mode + actual tenant to enter ───────────────────────────────
    if lifecycle in ("trial", "in_implementation"):
        mode = "implementation"
        actual_tenant = target
        environment = target.environment  # always "live" for a direct tenant

    else:  # lifecycle == "live"
        if requested_env == "test":
            # Route to the test shadow — full edit allowed
            shadow_res = await db.execute(
                select(Tenant).where(
                    Tenant.parent_tenant_id == target.id,
                    Tenant.environment == "test",  # type: ignore[arg-type]
                )
            )
            shadow = shadow_res.scalar_one_or_none()
            if not shadow:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="No test environment exists for this tenant. Create one first.",
                )
            mode = "implementation"
            actual_tenant = shadow
            environment = "test"
        else:
            # Live environment — support/read-only
            mode = "support"
            actual_tenant = target
            environment = "live"

    # ── Mint impersonation token ──────────────────────────────────────────────
    access_token = _mint_impersonation_token(
        impersonator=current_user,
        target_tenant_id=actual_tenant.id,
        environment=environment,
        impersonation_mode=mode,
    )

    await _log(
        "platform.tenant.entered",
        current_user.user_id,
        actual_tenant.id,
        {
            "impersonation_mode": mode,
            "environment": environment,
            "impersonator_id": str(current_user.user_id),
            "target_lifecycle": lifecycle,
        },
        db,
    )

    return EnterTenantResponse(
        access_token=access_token,
        impersonation_mode=mode,
        environment=environment,
        tenant_id=str(actual_tenant.id),
        tenant_name=actual_tenant.name,
    )


# ── User impersonation — M9.3b ───────────────────────────────────────────────

@router.post(
    "/tenants/{tenant_id}/users/{user_id}/impersonate",
    response_model=UserImpersonateResponse,
)
async def impersonate_user(
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    data: Optional[UserImpersonateRequest] = Body(default=None),
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> UserImpersonateResponse:
    """
    Mint a user-level impersonation token for a super admin entering a specific
    user's identity.

    Unlike enter_tenant (which keeps sub=SA and routes tenant context), this token
    sets sub=target_user so the frontend sees exactly what that user sees.

    Guards:
      - Caller must be super admin.
      - Target user must have an active UserTenant record on tenant_id.
      - Locked or inactive users cannot be impersonated.

    Creates an ImpersonationSession audit record on success.
    """
    _sa(current_user)

    entry_point = (data.entry_point if data else None) or "user_list"

    # ── Verify target user belongs to tenant ──────────────────────────────────
    ut_res = await db.execute(
        select(UserTenant)
        .where(UserTenant.user_id == user_id, UserTenant.tenant_id == tenant_id)
    )
    target_ut = ut_res.scalar_one_or_none()
    if not target_ut:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found on this tenant.")
    if not target_ut.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot impersonate a locked or inactive user.")

    # ── Load target user ──────────────────────────────────────────────────────
    user_res = await db.execute(select(User).where(User.id == user_id))
    target_user = user_res.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User record not found.")

    # ── Derive target user's role claims (same logic as login flow) ───────────
    roles_res = await db.execute(
        select(Role.name)
        .join(UserRole, Role.id == UserRole.role_id)
        .where(UserRole.user_tenant_id == target_ut.id)
    )
    role_names: list[str] = [row[0] for row in roles_res.all()]
    is_tenant_admin = "tenant_admin" in role_names
    has_non_admin_role = any(r != "tenant_admin" for r in role_names)
    primary_role: str | None = next((r for r in role_names if r != "tenant_admin"), (role_names[0] if role_names else None))

    # ── Look up the tenant for environment ───────────────────────────────────
    tenant = await _get_tenant_or_404(tenant_id, db)

    # ── Determine impersonator role ───────────────────────────────────────────
    owner_id = settings.owner_user_id
    impersonator_role = (
        "super_admin_owner"
        if owner_id and str(current_user.user_id) == owner_id
        else "super_admin"
    )

    # ── Create audit record ───────────────────────────────────────────────────
    session = ImpersonationSession(
        impersonator_id=current_user.user_id,
        impersonator_role=impersonator_role,
        target_user_id=user_id,
        target_tenant_id=tenant_id,
        environment=tenant.environment,
        entry_point=entry_point,
    )
    db.add(session)
    await db.flush()  # populate session.id

    # ── Mint token with target user's identity ────────────────────────────────
    access_token = create_access_token({
        "sub":                      str(target_user.id),
        "user_tenant_id":           str(target_ut.id),
        "account_type":             "business",
        "tenant_id":                str(tenant_id),
        "session_id":               str(current_user.session_id),
        "is_super_admin":           False,
        "is_tenant_admin":          is_tenant_admin,
        "has_non_admin_role":       has_non_admin_role,
        "role_tier":                target_ut.role_tier,
        "environment":              tenant.environment,
        "impersonator_id":          str(current_user.user_id),
        "impersonation_mode":       current_user.impersonation_mode,  # carry forward
        "is_user_impersonation":    True,
        "impersonation_session_id": str(session.id),
    })

    await _log(
        "platform.user.impersonation.started",
        current_user.user_id,
        tenant_id,
        {
            "target_user_id":    str(user_id),
            "impersonator_role": impersonator_role,
            "entry_point":       entry_point,
            "session_id":        str(session.id),
            "environment":       tenant.environment,
        },
        db,
    )

    return UserImpersonateResponse(
        access_token=access_token,
        session_id=str(session.id),
        target_user=ImpersonatedUserSummary(
            id=str(target_user.id),
            full_name=target_user.full_name,
            email=target_user.email,
            role=primary_role,
        ),
    )


@router.post("/impersonation/{session_id}/end", response_model=ImpersonationEndResponse)
async def end_impersonation_session(
    session_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> ImpersonationEndResponse:
    """
    Close a user-level impersonation session by setting ended_at.

    Must be called with the ORIGINAL super-admin token (restored by the frontend
    before calling this endpoint). Verifies that the caller is the same SA who
    opened the session. This endpoint is accessible via require_auth (not
    require_super_admin) because the frontend may call it while already holding
    the base SA token after the impersonation token is discarded.
    """
    session_res = await db.execute(
        select(ImpersonationSession).where(ImpersonationSession.id == session_id)
    )
    session = session_res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Impersonation session not found.")

    # Allow the original SA (via their real user_id) or via impersonator_id on any token.
    caller_id = current_user.impersonator_id or current_user.user_id
    if session.impersonator_id != caller_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorised to end this session.")

    if session.ended_at is None:
        session.ended_at = datetime.now(timezone.utc)

    await _log(
        "platform.user.impersonation.ended",
        caller_id,
        session.target_tenant_id,
        {"session_id": str(session_id), "target_user_id": str(session.target_user_id)},
        db,
    )

    return ImpersonationEndResponse(
        session_id=str(session_id),
        message="Impersonation session ended.",
    )


# ── List tenants ──────────────────────────────────────────────────────────────

@router.get("/tenants", response_model=list[TenantListItem])
async def list_tenants(
    environment: str | None = Query(None, description="live | test | all (default: live)"),
    lifecycle_status: str | None = Query(None),
    search: str | None = Query(None, description="Partial match on name or slug"),
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> list[TenantListItem]:
    """
    List tenants visible to the super admin.

    Default: live environment only (parent_tenant_id IS NULL AND environment='live').
    Pass ?environment=test for test shadows, ?environment=all for everything.
    ?lifecycle_status= filters by exact status. ?search= does ilike on name/slug.
    """
    _sa(current_user)

    # ── User-count subquery ───────────────────────────────────────────────────
    user_count_sq = (
        select(UserTenant.tenant_id, func.count(UserTenant.id).label("cnt"))
        .where(UserTenant.tenant_id.isnot(None))
        .group_by(UserTenant.tenant_id)
        .subquery()
    )

    q = (
        select(Tenant, func.coalesce(user_count_sq.c.cnt, 0).label("user_count"))
        .outerjoin(user_count_sq, Tenant.id == user_count_sq.c.tenant_id)
    )

    # ── Environment filter (default: live only) ───────────────────────────────
    env_param = (environment or "live").lower()
    if env_param == "live":
        q = q.where(Tenant.environment == "live")  # type: ignore[arg-type]
    elif env_param == "test":
        q = q.where(Tenant.environment == "test")  # type: ignore[arg-type]
    # "all" → no env filter

    if lifecycle_status:
        q = q.where(Tenant.lifecycle_status == lifecycle_status)  # type: ignore[arg-type]

    if search:
        like = f"%{search}%"
        q = q.where(
            Tenant.name.ilike(like) | Tenant.slug.ilike(like)  # type: ignore[union-attr]
        )

    q = q.order_by(Tenant.created_at.desc())

    rows = (await db.execute(q)).all()

    return [
        TenantListItem(
            id=str(t.id),
            name=t.name,
            slug=t.slug,
            country=t.country,
            environment=t.environment,
            parent_tenant_id=str(t.parent_tenant_id) if t.parent_tenant_id else None,
            lifecycle_status=t.lifecycle_status,
            is_active=t.is_active,
            is_internal=t.is_internal,
            user_count=cnt,
            created_at=t.created_at,
        )
        for t, cnt in rows
    ]


# ── Tenant detail ─────────────────────────────────────────────────────────────

@router.get("/tenants/{tenant_id}", response_model=TenantDetail)
async def get_tenant(
    tenant_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> TenantDetail:
    """
    Full tenant detail for the owner portal.

    Includes users (name, email, role_tier, is_active), active module count,
    and test environment summary if one exists.
    """
    _sa(current_user)
    tenant = await _get_tenant_or_404(tenant_id, db)

    # ── Users ─────────────────────────────────────────────────────────────────
    ut_rows = (await db.execute(
        select(User, UserTenant)
        .join(UserTenant, User.id == UserTenant.user_id)
        .where(UserTenant.tenant_id == tenant_id)
        .order_by(User.full_name)
    )).all()

    users = [
        TenantUserSummary(
            id=str(u.id),
            full_name=u.full_name,
            email=u.email,
            role_tier=ut.role_tier,
            is_active=ut.is_active,
            user_type=ut.user_type if hasattr(ut, "user_type") else "employee",
        )
        for u, ut in ut_rows
    ]

    # ── Active modules count ──────────────────────────────────────────────────
    from app.models.setup import TenantModule
    mod_count_res = await db.execute(
        select(func.count()).select_from(TenantModule).where(
            TenantModule.tenant_id == tenant_id,
            TenantModule.is_active.is_(True),
        )
    )
    active_module_count = mod_count_res.scalar_one() or 0

    # ── Test environment (if live tenant with a shadow) ───────────────────────
    test_env: TestEnvSummary | None = None
    if tenant.environment == "live":
        shadow_res = await db.execute(
            select(Tenant).where(
                Tenant.parent_tenant_id == tenant_id,
                Tenant.environment == "test",  # type: ignore[arg-type]
            )
        )
        shadow = shadow_res.scalar_one_or_none()
        if shadow:
            test_env = TestEnvSummary(
                id=str(shadow.id),
                name=shadow.name,
                slug=shadow.slug,
                lifecycle_status=shadow.lifecycle_status,
            )

    # ── Live environment (M9.0.1 — if test tenant with a born-live counterpart) ─
    live_env: TestEnvSummary | None = None
    if tenant.environment == "test":
        live_res = await db.execute(
            select(Tenant).where(
                Tenant.parent_tenant_id == tenant_id,
                Tenant.environment == "live",  # type: ignore[arg-type]
            )
        )
        live_row = live_res.scalar_one_or_none()
        if live_row:
            live_env = TestEnvSummary(
                id=str(live_row.id),
                name=live_row.name,
                slug=live_row.slug,
                lifecycle_status=live_row.lifecycle_status,
            )

    return TenantDetail(
        id=str(tenant.id),
        name=tenant.name,
        slug=tenant.slug,
        country=tenant.country,
        environment=tenant.environment,
        parent_tenant_id=str(tenant.parent_tenant_id) if tenant.parent_tenant_id else None,
        lifecycle_status=tenant.lifecycle_status,
        pre_suspension_status=tenant.pre_suspension_status,
        is_active=tenant.is_active,
        user_count=len(users),
        active_module_count=active_module_count,
        users=users,
        live_environment=live_env,
        test_environment=test_env,
        created_at=tenant.created_at,
        updated_at=tenant.updated_at,
    )


# ── Lifecycle transition ──────────────────────────────────────────────────────

@router.patch("/tenants/{tenant_id}/lifecycle", response_model=TenantDetail)
async def update_lifecycle(
    tenant_id: uuid.UUID,
    data: LifecycleUpdateRequest,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> TenantDetail:
    """
    Transition a tenant's lifecycle_status.

    Allowed values: trial | in_implementation | live.
    "suspended" is NOT allowed here — use POST .../suspend instead.
    """
    _sa(current_user)
    tenant = await _get_tenant_or_404(tenant_id, db)

    old_status = tenant.lifecycle_status
    tenant.lifecycle_status = data.status

    await _log(
        "platform.lifecycle.updated",
        current_user.user_id,
        tenant_id,
        {"from": old_status, "to": data.status},
        db,
    )
    await db.flush()

    # Re-use get_tenant logic by delegating
    return await get_tenant(tenant_id, current_user, db)


# ── Suspend ───────────────────────────────────────────────────────────────────

@router.post("/tenants/{tenant_id}/suspend", response_model=SuspendResponse)
async def suspend_tenant(
    tenant_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> SuspendResponse:
    """
    Suspend a tenant. Blocks all logins for its users.

    Saves the current lifecycle_status to pre_suspension_status so reactivate
    can restore it. Returns 409 if the tenant is already suspended.
    """
    _sa(current_user)
    tenant = await _get_tenant_or_404(tenant_id, db)

    if tenant.lifecycle_status == "suspended":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tenant is already suspended.",
        )

    tenant.pre_suspension_status = tenant.lifecycle_status
    tenant.lifecycle_status = "suspended"

    await _log(
        "platform.tenant.suspended",
        current_user.user_id,
        tenant_id,
        {"prior_status": tenant.pre_suspension_status},
        db,
    )
    await db.flush()

    return SuspendResponse(
        id=str(tenant.id),
        lifecycle_status=tenant.lifecycle_status,
        pre_suspension_status=tenant.pre_suspension_status,
        message=f"Tenant suspended. Prior status '{tenant.pre_suspension_status}' saved for reactivation.",
    )


# ── Create test environment (SA proxy) ───────────────────────────────────────

@router.post(
    "/tenants/{tenant_id}/test-environment",
    response_model=TestTenantResponse,
    status_code=status.HTTP_201_CREATED,
)
async def platform_create_test_environment(
    tenant_id: uuid.UUID,
    clone_data: bool = True,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> TestTenantResponse:
    """
    Super Admin proxy — create (or return the existing) test shadow for a live tenant.

    Forwards to the same logic as POST /api/tenant/create-test-environment but
    callable from the platform portal, where the SA's token has no tenant_id.
    Guard: super admin only. Target tenant must have environment='live'.
    """
    _sa(current_user)

    live_tenant = await _get_tenant_or_404(tenant_id, db)
    if live_tenant.environment != "live":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Target tenant is not a live tenant.",
        )

    # Return existing shadow if already present (idempotent)
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

    # Create the shadow — mirrors the tenant router's create-test-environment logic.
    import re as _re, secrets as _secrets

    base_slug = _re.sub(r"[^a-z0-9]+", "-", f"{live_tenant.slug}-test".lower()).strip("-")[:50] or "test"
    test_slug = base_slug
    while True:
        clash = await db.execute(select(Tenant).where(Tenant.slug == test_slug))
        if clash.scalar_one_or_none() is None:
            break
        test_slug = f"{base_slug}-{_secrets.token_hex(3)}"

    shadow = Tenant(
        name=f"{live_tenant.name} (Test)",
        country=live_tenant.country,
        slug=test_slug,
        environment="test",
        parent_tenant_id=live_tenant.id,
        lifecycle_status=live_tenant.lifecycle_status,
        is_active=True,
    )
    db.add(shadow)
    await db.flush()

    live_uts_res = await db.execute(
        select(UserTenant).where(UserTenant.tenant_id == tenant_id)
    )
    for live_ut in live_uts_res.scalars().all():
        db.add(UserTenant(
            user_id=live_ut.user_id,
            tenant_id=shadow.id,
            password_hash=live_ut.password_hash,
            is_active=live_ut.is_active,
            role_tier=live_ut.role_tier,
        ))
    await db.flush()

    # Phase 4: clone live data into the new shadow
    clone_summary = None
    if clone_data:
        from app.services.tenant_clone import clone_tenant_data
        clone_result = await clone_tenant_data(db, tenant_id, shadow.id)
        clone_summary = clone_result.to_dict()

    await _log(
        "platform.test_environment.created",
        current_user.user_id,
        tenant_id,
        {"shadow_id": str(shadow.id), "shadow_slug": shadow.slug,
         "clone_data": clone_data, "clone_summary": clone_summary},
        db,
    )

    return TestTenantResponse(
        id=str(shadow.id),
        name=shadow.name,
        slug=shadow.slug,
        environment=shadow.environment,
        parent_tenant_id=str(shadow.parent_tenant_id),
        lifecycle_status=shadow.lifecycle_status,
        created_at=shadow.created_at,
        clone_summary=clone_summary,
    )


# ── Promote config test → live (SA proxy) — DEPRECATED M9.0.1 ────────────────

@router.post("/tenants/{tenant_id}/promote", response_model=PromoteResponse, deprecated=True)
async def platform_promote(
    tenant_id: uuid.UUID,
    data: PromoteRequest,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> PromoteResponse:
    """
    DEPRECATED (M9.0.1) — superseded by the unified platform promotion engine.

    This was a Super Admin proxy that copied org_config/tax/fx from a tenant's
    test shadow to its (already-existing) live tenant. Two problems under the
    test-first model: (1) it required `live_tenant.environment == "live"` —
    impossible to call pre-first-promotion, since every tenant starts test-only;
    (2) its org/tax/fx copy logic is now redundant with `_copy_flat_config`,
    which `platform_promotion_apply` below calls unconditionally on every
    promotion (first or repeat). Use that engine instead:
        POST /api/platform/tenants/{tenant_id}/promotion/diff
        POST /api/platform/tenants/{tenant_id}/promotion/apply
    `tenant_id` may be either the test or the live tenant's id — both resolve
    to the same pair (see `_resolve_promotion_pair`).
    """
    _sa(current_user)
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail=(
            "This endpoint is deprecated. Promotion (org_config/tax/fx, and creation "
            "of the live tenant on first promotion) is now handled by the platform "
            "promotion engine: POST /api/platform/tenants/{tenant_id}/promotion/diff "
            "then POST .../promotion/apply."
        ),
    )


# ── Reactivate ────────────────────────────────────────────────────────────────

@router.post("/tenants/{tenant_id}/reactivate", response_model=SuspendResponse)
async def reactivate_tenant(
    tenant_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> SuspendResponse:
    """
    Reactivate a suspended tenant.

    Restores lifecycle_status to pre_suspension_status (falls back to
    "in_implementation" if that field is null). Clears pre_suspension_status.
    """
    _sa(current_user)
    tenant = await _get_tenant_or_404(tenant_id, db)

    if tenant.lifecycle_status != "suspended":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tenant is not suspended (current status: {tenant.lifecycle_status}).",
        )

    restored = tenant.pre_suspension_status or "in_implementation"
    tenant.lifecycle_status = restored
    tenant.pre_suspension_status = None

    await _log(
        "platform.tenant.reactivated",
        current_user.user_id,
        tenant_id,
        {"restored_to": restored},
        db,
    )
    await db.flush()

    return SuspendResponse(
        id=str(tenant.id),
        lifecycle_status=tenant.lifecycle_status,
        pre_suspension_status=None,
        message=f"Tenant reactivated. Status restored to '{restored}'.",
    )


# ── M9.0.1: CoA / Dimensions / config promotion — diff + apply ──────────────
# Test-first model: signup creates only a test tenant. tenant_id passed to the
# endpoints below may be EITHER environment -- if it is a test tenant with no
# live counterpart yet, this is that tenant's FIRST promotion and live is born
# here (never created empty). Repeat promotions (live already exists) behave
# exactly as the original Phase 3a engine did. See
# docs/BRIEF_M9_0_1_test_first_environment_flow.md.

async def _resolve_promotion_pair(
    tenant_id: uuid.UUID,
    db: AsyncSession,
) -> tuple[Tenant, Tenant | None]:
    """
    Resolve (test_tenant, live_tenant_or_None) for a promotion diff/apply call.

    tenant_id may refer to either environment:
      - TEST tenant: live is looked up via parent_tenant_id == tenant_id,
        environment == "live". May be None -- that's the normal pre-go-live
        state under the test-first model, not an error.
      - LIVE tenant: test is the existing shadow via parent_tenant_id ==
        tenant_id, environment == "test". Must exist (404 if not) -- same
        guard the original Phase 3a engine used.
    """
    tenant = await _get_tenant_or_404(tenant_id, db)

    if tenant.environment == "test":
        live_res = await db.execute(
            select(Tenant).where(
                Tenant.parent_tenant_id == tenant_id,
                Tenant.environment == "live",  # type: ignore[arg-type]
            )
        )
        live = live_res.scalar_one_or_none()
        return tenant, live

    # tenant.environment == "live"
    shadow_res = await db.execute(
        select(Tenant).where(
            Tenant.parent_tenant_id == tenant_id,
            Tenant.environment == "test",  # type: ignore[arg-type]
        )
    )
    shadow = shadow_res.scalar_one_or_none()
    if shadow is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No test environment exists for this tenant. Create one first.",
        )
    return shadow, tenant


async def _copy_flat_config(
    db: AsyncSession,
    test_id: uuid.UUID,
    live_id: uuid.UUID,
) -> list[str]:
    """
    Copy the simple flat-row config sections (org_config, tax, fx) test -> live.

    These are JSONB-blob rows with no internal FK tree, so unlike CoA/Dimensions
    they need no id remapping -- always copied in full on every promotion call,
    porting the exact behaviour of the now-deprecated simple
    POST /api/tenant/promote endpoint. Returns the list of sections copied.

    NOTE: periods, approval workflows, document rules, module settings, and
    roles/permissions are NOT covered here -- promotion support for those
    sections does not exist anywhere in the codebase yet and is tracked as a
    follow-up (see brief), not silently dropped.
    """
    from app.models.setup import TenantFxConfig, TenantOrgConfig, TenantTaxConfig
    from app.services.tenant_clone import _ORG_COPY_FIELDS

    copied: list[str] = []

    test_cfg_res = await db.execute(select(TenantOrgConfig).where(TenantOrgConfig.tenant_id == test_id))
    test_cfg = test_cfg_res.scalar_one_or_none()
    if test_cfg:
        live_cfg_res = await db.execute(select(TenantOrgConfig).where(TenantOrgConfig.tenant_id == live_id))
        live_cfg = live_cfg_res.scalar_one_or_none()
        if live_cfg:
            for f in _ORG_COPY_FIELDS:
                setattr(live_cfg, f, getattr(test_cfg, f))
        else:
            new_cfg = TenantOrgConfig(tenant_id=live_id)
            for f in _ORG_COPY_FIELDS:
                setattr(new_cfg, f, getattr(test_cfg, f))
            db.add(new_cfg)
        copied.append("org_config")

    test_tax_res = await db.execute(select(TenantTaxConfig).where(TenantTaxConfig.tenant_id == test_id))
    test_tax = test_tax_res.scalar_one_or_none()
    if test_tax:
        live_tax_res = await db.execute(select(TenantTaxConfig).where(TenantTaxConfig.tenant_id == live_id))
        live_tax = live_tax_res.scalar_one_or_none()
        tax_fields = ["vat_config", "wht_config", "paye_config", "other_statutory"]
        if live_tax:
            for f in tax_fields:
                setattr(live_tax, f, getattr(test_tax, f))
        else:
            new_tax = TenantTaxConfig(tenant_id=live_id)
            for f in tax_fields:
                setattr(new_tax, f, getattr(test_tax, f))
            db.add(new_tax)
        copied.append("tax")

    test_fx_res = await db.execute(select(TenantFxConfig).where(TenantFxConfig.tenant_id == test_id))
    test_fx = test_fx_res.scalar_one_or_none()
    if test_fx:
        live_fx_res = await db.execute(select(TenantFxConfig).where(TenantFxConfig.tenant_id == live_id))
        live_fx = live_fx_res.scalar_one_or_none()
        fx_fields = ["fx_rates", "revaluation_rules"]
        if live_fx:
            for f in fx_fields:
                setattr(live_fx, f, getattr(test_fx, f))
        else:
            new_fx = TenantFxConfig(tenant_id=live_id)
            for f in fx_fields:
                setattr(new_fx, f, getattr(test_fx, f))
            db.add(new_fx)
        copied.append("fx")

    return copied


async def _create_live_from_test(db: AsyncSession, test_tenant: Tenant) -> Tenant:
    """
    Create the live Tenant row born from a test tenant's first promotion.

    parent_tenant_id points back at the test tenant -- the inverse of the old
    live-first direction (where parent_tenant_id lived on the test row).
    Caller must flush() this before using live.id as an FK target for the
    CoA/Dimensions/etc rows apply_promotion is about to insert.
    """
    import re as _re
    import secrets as _secrets

    def _make_slug(name: str) -> str:
        return _re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:50] or "live"

    base_name = test_tenant.name
    if base_name.endswith(" (Test)"):
        base_name = base_name[: -len(" (Test)")]

    base_slug = _make_slug(base_name)
    live_slug = base_slug
    while True:
        slug_check = await db.execute(select(Tenant).where(Tenant.slug == live_slug))
        if slug_check.scalar_one_or_none() is None:
            break
        live_slug = f"{base_slug}-{_secrets.token_hex(3)}"

    live = Tenant(
        name=base_name,
        country=test_tenant.country,
        slug=live_slug,
        environment="live",
        parent_tenant_id=test_tenant.id,
        lifecycle_status="live",
        is_active=True,
    )
    db.add(live)
    await db.flush()  # live.id must exist before FK-dependent inserts below
    return live


@router.post("/tenants/{tenant_id}/promotion/diff", response_model=PromotionDiff)
async def platform_promotion_diff(
    tenant_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> PromotionDiff:
    """
    Compute a read-only diff of CoA, Dimensions, DimensionValues, GLDimRequirements,
    and AccountMappings between the test tenant and its live counterpart.

    tenant_id may be either environment (see _resolve_promotion_pair). If no
    live tenant exists yet, every test-side row diffs as a CREATE -- this
    previews what the tenant's first promotion (which births live) would do.

    Returns a structured PromotionDiff where each item has a stable item_id that
    the caller submits in the subsequent apply call to accept that change.

    Guard: super admin only. No DB writes — purely a preview / review step.

    NOTE: org_config / tax / fx are not represented as diff items -- they are
    always copied in full on apply (see _copy_flat_config). Periods, approval
    workflows, document rules, module settings, and roles/permissions are not
    yet implemented for promotion at all (follow-up, not silently dropped).
    """
    _sa(current_user)
    test, live = await _resolve_promotion_pair(tenant_id, db)
    effective_live_id = live.id if live else uuid.uuid4()

    from app.services.promotion_engine import compute_promotion_diff
    diff, _ = await compute_promotion_diff(db, test.id, effective_live_id)
    return diff


@router.post("/tenants/{tenant_id}/promotion/apply", response_model=PromotionApplyResult)
async def platform_promotion_apply(
    tenant_id: uuid.UUID,
    data: PromotionApplyRequest,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> PromotionApplyResult:
    """
    Apply a selection of promotion diff items test -> live.

    tenant_id may be either environment (see _resolve_promotion_pair). If no
    live tenant exists yet for this test tenant, this call CREATES it -- live
    is born from promotion, never created empty (M9.0.1 locked decision). On
    first creation: every UserTenant row on the test tenant is mirrored onto
    the new live tenant (auto-grant) and lifecycle_status is set to "live".
    On a repeat promotion (live already existed): behaves exactly as the
    original Phase 3a engine -- diff/apply against the existing live tenant,
    no new row, no UserTenant changes.

    org_config / tax / fx are always copied in full (no item-level
    accept/reject -- flat config blobs with no FK tree, same as the
    deprecated simple promote endpoint). CoA / Dimensions / DimensionValues /
    GLDimensionRequirements / AccountMappings only copy items whose item_id is
    in data.accepted_item_ids.

    All-or-nothing: the entire apply runs inside get_db()'s transaction;
    any failure triggers a full rollback.

    Writes a platform.promotion.config_applied audit log entry on success.
    Guard: super admin only.
    """
    _sa(current_user)
    test, live = await _resolve_promotion_pair(tenant_id, db)

    born_live = False
    if live is None:
        live = await _create_live_from_test(db, test)
        born_live = True

    from app.services.promotion_engine import apply_promotion
    result = await apply_promotion(db, test.id, live.id, data)

    flat_copied = await _copy_flat_config(db, test.id, live.id)

    if born_live:
        # Auto-grant: mirror every UserTenant row from test -> the new live tenant.
        test_uts_res = await db.execute(select(UserTenant).where(UserTenant.tenant_id == test.id))
        for test_ut in test_uts_res.scalars().all():
            db.add(UserTenant(
                user_id=test_ut.user_id,
                tenant_id=live.id,
                password_hash=test_ut.password_hash,
                is_active=test_ut.is_active,
                role_tier=test_ut.role_tier,
            ))
        # TODO (future milestone — email infrastructure required):
        # For each mirrored user, send a "Your live account is ready" welcome email
        # containing their login URL and instructing them to use their existing password
        # (same credentials as the test environment, since password_hash is mirrored).
        # Blocked on: email service integration (SendGrid / SES / SMTP) not yet built.
    else:
        # Repeat promotion -- live already existed; keep it live (no-op if already so).
        live.lifecycle_status = "live"

    await db.flush()

    await _log(
        "platform.promotion.config_applied",
        current_user.user_id,
        live.id,
        {
            "test_tenant_id":  str(test.id),
            "born_live":       born_live,
            "accepted_count":  len(data.accepted_item_ids),
            "flat_copied":     flat_copied,
            "created":         result.created,
            "updated":         result.updated,
            "deactivated":     result.deactivated,
            "total_applied":   result.total_applied,
        },
        db,
    )

    return result


# ── #49 Consultant system config ──────────────────────────────────────────────

from app.constants.modules import MODULE_CATALOGUE as _MODULE_CATALOGUE, VALID_MODULE_KEYS as _VALID_MODULE_KEYS


@router.get("/tenants/{tenant_id}/system-config", response_model=SystemConfigResponse)
async def get_system_config(
    tenant_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> SystemConfigResponse:
    """
    Return tenant posting_mode + module licensing state.

    TIER 2 — Super admin read endpoint for the consultant config panel.
    Guard: super admin only.
    """
    _sa(current_user)
    tenant = await _get_tenant_or_404(tenant_id, db)

    from app.models.setup import TenantOrgConfig, TenantModule

    # Posting mode
    cfg_res = await db.execute(
        select(TenantOrgConfig.posting_mode).where(TenantOrgConfig.tenant_id == tenant.id)
    )
    posting_mode: str = cfg_res.scalar_one_or_none() or "full_erp"

    # Module rows (keyed by module_key)
    mod_res = await db.execute(
        select(TenantModule).where(TenantModule.tenant_id == tenant.id)
    )
    mod_rows: dict[str, TenantModule] = {m.module_key: m for m in mod_res.scalars().all()}

    modules = [
        ModuleLicenseItem(
            key=key,
            label=label,
            is_licensed=mod_rows[key].is_licensed if key in mod_rows else False,
            is_active=mod_rows[key].is_active if key in mod_rows else False,
        )
        for m in _MODULE_CATALOGUE
        for key, label in [(m["key"], m["label"])]
    ]

    return SystemConfigResponse(posting_mode=posting_mode, modules=modules)


@router.patch("/tenants/{tenant_id}/system-config", response_model=SystemConfigResponse)
async def update_system_config(
    tenant_id: uuid.UUID,
    data: SystemConfigUpdate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> SystemConfigResponse:
    """
    Update tenant posting_mode and/or module licensing flags.

    TIER 2 — Super admin write for the consultant config panel.
    - posting_mode: upserts TenantOrgConfig row if missing.
    - module_licenses: {key: bool} map. Upserts TenantModule rows; only
      sets is_licensed — never changes is_active (tenant activates modules
      themselves). Validates that all submitted keys are in MODULE_CATALOGUE.
    Guard: super admin only.
    """
    _sa(current_user)
    tenant = await _get_tenant_or_404(tenant_id, db)

    from app.models.setup import TenantOrgConfig, TenantModule

    valid_keys = _VALID_MODULE_KEYS

    if data.module_licenses:
        bad = set(data.module_licenses.keys()) - valid_keys
        if bad:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Unknown module key(s): {', '.join(sorted(bad))}",
            )

    # ── posting_mode ──────────────────────────────────────────────────────────
    if data.posting_mode is not None:
        cfg_res = await db.execute(
            select(TenantOrgConfig).where(TenantOrgConfig.tenant_id == tenant.id)
        )
        cfg = cfg_res.scalar_one_or_none()
        current_mode = cfg.posting_mode if cfg else "full_erp"

        if data.posting_mode != current_mode:
            # Guard: block mode switch once any journal entries exist.
            # Switching mode after data is posted orphans GL entries (lite→full_erp)
            # or creates a GL gap (full_erp→lite). World-class ERPs (NetSuite, SAP)
            # lock this at provisioning. We enforce the same rule.
            je_count_res = await db.execute(
                select(JournalEntry.id).where(
                    JournalEntry.tenant_id == tenant.id
                ).limit(1)
            )
            if je_count_res.scalar_one_or_none() is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        f"Cannot switch posting mode from '{current_mode}' to '{data.posting_mode}' — "
                        "this tenant already has posted journal entries. Changing the posting mode "
                        "after data is in the GL would orphan existing entries or leave a gap. "
                        "Contact support if a mode change is genuinely required."
                    ),
                )

        if cfg:
            cfg.posting_mode = data.posting_mode
        else:
            db.add(TenantOrgConfig(
                tenant_id=tenant.id,
                posting_mode=data.posting_mode,
            ))

    # ── module licenses ───────────────────────────────────────────────────────
    if data.module_licenses:
        existing_res = await db.execute(
            select(TenantModule).where(TenantModule.tenant_id == tenant.id)
        )
        existing: dict[str, TenantModule] = {
            m.module_key: m for m in existing_res.scalars().all()
        }

        for key, is_lic in data.module_licenses.items():
            if key in existing:
                existing[key].is_licensed = is_lic
                # Revoke active if license removed
                if not is_lic:
                    existing[key].is_active = False
            else:
                db.add(TenantModule(
                    tenant_id=tenant.id,
                    module_key=key,
                    is_licensed=is_lic,
                    is_active=False,
                ))

    await db.flush()

    await _log(
        "platform.system_config.updated",
        current_user.user_id,
        tenant.id,
        {
            "posting_mode": data.posting_mode,
            "module_licenses": data.module_licenses,
        },
        db,
    )

    # Return fresh state
    return await get_system_config(tenant_id, current_user, db)


# ── Trials & signups ──────────────────────────────────────────────────────────

@router.get("/trials", response_model=list[TrialListItem])
async def list_trials(
    search: str | None = Query(None, description="Partial match on name or slug"),
    lead_status: str | None = Query(None, description="new | contacted | qualified | disqualified"),
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> list[TrialListItem]:
    """
    List all trial tenants for the SA lead management queue.

    Returns lifecycle_status='trial' tenants only, joined with TenantOrgConfig
    for industry and company_email (nullable — fresh trials may not have filled
    these in yet). Ordered by created_at desc (newest first).

    SA-only endpoint.
    """
    _sa(current_user)
    from app.models.setup import TenantOrgConfig

    # User-count subquery (reused from list_tenants)
    user_count_sq = (
        select(UserTenant.tenant_id, func.count(UserTenant.id).label("cnt"))
        .where(UserTenant.tenant_id.isnot(None))
        .group_by(UserTenant.tenant_id)
        .subquery()
    )

    q = (
        select(
            Tenant,
            func.coalesce(user_count_sq.c.cnt, 0).label("user_count"),
            TenantOrgConfig.industry,
            TenantOrgConfig.company_email,
            TenantOrgConfig.posting_mode,
        )
        .outerjoin(user_count_sq, Tenant.id == user_count_sq.c.tenant_id)
        .outerjoin(TenantOrgConfig, TenantOrgConfig.tenant_id == Tenant.id)
        .where(Tenant.lifecycle_status == "trial")
    )

    if lead_status:
        q = q.where(Tenant.lead_status == lead_status)  # type: ignore[arg-type]

    if search:
        like = f"%{search}%"
        q = q.where(
            Tenant.name.ilike(like) | Tenant.slug.ilike(like)  # type: ignore[union-attr]
        )

    q = q.order_by(Tenant.created_at.desc())

    rows = (await db.execute(q)).all()

    return [
        TrialListItem(
            id=str(t.id),
            name=t.name,
            slug=t.slug,
            country=t.country,
            environment=t.environment,
            lifecycle_status=t.lifecycle_status,
            lead_status=t.lead_status,
            implementation_notes=t.implementation_notes,
            industry=industry,
            company_email=company_email,
            user_count=cnt,
            created_at=t.created_at,
            company_size=t.company_size,
            interested_modules=t.interested_modules,
            posting_mode=posting_mode,
        )
        for t, cnt, industry, company_email, posting_mode in rows
    ]


@router.patch("/trials/{tenant_id}", response_model=TrialListItem)
async def update_trial_lead(
    tenant_id: str,
    data: TrialLeadUpdate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> TrialListItem:
    """
    Update lead_status and/or implementation_notes on a trial tenant.

    Used by consultants to track outreach progress:
      new → contacted → qualified → (activate) → in_implementation
      new / contacted / qualified → disqualified (not a fit)

    Returns the updated TrialListItem so the frontend can update its local list.
    SA-only endpoint.
    """
    _sa(current_user)

    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if tenant.lifecycle_status != "trial":
        raise HTTPException(
            status_code=400,
            detail="Only trial tenants can be updated via this endpoint"
        )
    from app.models.setup import TenantOrgConfig

    if data.lead_status is not None:
        tenant.lead_status = data.lead_status
    if data.implementation_notes is not None:
        tenant.implementation_notes = data.implementation_notes

    await db.flush()

    await _log(
        "platform.trial.lead_updated",
        current_user.user_id,
        tenant.id,
        {
            "lead_status": data.lead_status,
            "implementation_notes": bool(data.implementation_notes),
        },
        db,
    )

    # Load org config for the response
    org_cfg = (
        await db.execute(
            select(TenantOrgConfig).where(TenantOrgConfig.tenant_id == tenant.id)
        )
    ).scalar_one_or_none()

    user_count_sq = (
        select(func.count(UserTenant.id))
        .where(
            UserTenant.tenant_id == tenant.id,
            UserTenant.tenant_id.isnot(None),
        )
        .scalar_subquery()
    )
    user_count = (await db.execute(select(user_count_sq))).scalar_one() or 0

    return TrialListItem(
        id=str(tenant.id),
        name=tenant.name,
        slug=tenant.slug,
        country=tenant.country,
        environment=tenant.environment,
        lifecycle_status=tenant.lifecycle_status,
        lead_status=tenant.lead_status,
        implementation_notes=tenant.implementation_notes,
        industry=org_cfg.industry if org_cfg else None,
        company_email=org_cfg.company_email if org_cfg else None,
        user_count=user_count,
        created_at=tenant.created_at,
        company_size=tenant.company_size,
        interested_modules=tenant.interested_modules,
        posting_mode=org_cfg.posting_mode if org_cfg else None,
    )


# ── Nuke Tenant (SA only) ──────────────────────────────────────────────────────

@router.delete("/tenants/{tenant_id}", status_code=204)
async def nuke_tenant(
    tenant_id: uuid.UUID,
    body: NukeTenantRequest,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Permanently delete a tenant and ALL its data.  Super Admin only.

    Works for any lifecycle_status.  Live tenants require
    body.confirm_live_delete = True as an explicit second acknowledgement
    that the caller knows they are wiping a potentially real-company tenant.

    What gets deleted:
    1. All Supabase Storage files belonging to the tenant's expense documents.
    2. All User rows that have ONLY this tenant as their membership (CASCADE
       removes their UserTenant, sessions, and refresh_tokens automatically).
    3. UserTenant rows for users who have memberships in other tenants — the
       User row is left intact so those other tenants are not affected.
    4. The Tenant row itself — PostgreSQL CASCADE handles all remaining child
       tables (org config, modules, employees, expenses, GL, periods, etc.).

    An audit record is written to platform_audit_log BEFORE deletion so the
    action is traceable even after the tenant row is gone.

    Safety gates:
    - SA role required (_sa guard).
    - confirmation_slug must match the tenant's actual slug.
    - Live tenants additionally require confirm_live_delete = True.
    """
    _sa(current_user)
    tenant = await _get_tenant_or_404(tenant_id, db)

    # ── Find paired environment (test ↔ live sibling) ─────────────────────────
    # Always delete both environments together — a company is one entity.
    if tenant.parent_tenant_id:
        # This is the live tenant; its test sibling is the parent.
        sibling = await db.get(Tenant, tenant.parent_tenant_id)
    else:
        # This is the test tenant; look for a live child pointing back at it.
        sib_res = await db.execute(
            select(Tenant).where(Tenant.parent_tenant_id == tenant_id)
        )
        sibling = sib_res.scalar_one_or_none()

    all_tenants = [t for t in [tenant, sibling] if t is not None]
    all_tenant_ids = {t.id for t in all_tenants}

    # ── Safety: slug confirmation ──────────────────────────────────────────────
    if body.confirmation_slug != tenant.slug:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="confirmation_slug does not match the tenant slug.",
        )

    # ── Safety: live tenants (primary or sibling) need the extra flag ──────────
    either_live = any(t.lifecycle_status == "live" for t in all_tenants)
    if either_live and not body.confirm_live_delete:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This company has a live environment. Set confirm_live_delete=true to "
                "confirm you intend to permanently delete it."
            ),
        )

    # ── Step 1: delete Supabase Storage files for all environments ────────────
    from app.models.documents import ExpenseDocument
    from app.services import storage as _storage

    for t in all_tenants:
        doc_res = await db.execute(
            select(ExpenseDocument.storage_path, ExpenseDocument.dedup_ref)
            .where(ExpenseDocument.tenant_id == t.id)
        )
        original_paths = {row.storage_path for row in doc_res.all() if row.dedup_ref is None}
        for blob_path in original_paths:
            try:
                await asyncio.to_thread(_storage.delete_file, blob_path)
            except Exception:
                pass  # best-effort; blob may already be gone

    # ── Step 2: clean up users across ALL environments ────────────────────────
    # Collect every UserTenant row across both tenants, then for each unique user
    # check whether they have memberships OUTSIDE this company entirely.
    all_ut_rows = (await db.execute(
        select(UserTenant).where(UserTenant.tenant_id.in_(all_tenant_ids))
    )).scalars().all()

    seen_user_ids: set[uuid.UUID] = set()
    for ut in all_ut_rows:
        if ut.user_id in seen_user_ids:
            continue
        seen_user_ids.add(ut.user_id)

        # Count memberships outside every row being deleted for this user.
        # Use PK comparison (UserTenant.id, never NULL) — not tenant_id (which can be
        # NULL for platform-level SA seats) — to avoid PostgreSQL NULL-propagation
        # silently excluding rows and producing a wrong "no outside memberships" result.
        this_user_row_ids = {u.id for u in all_ut_rows if u.user_id == ut.user_id}
        outside_res = await db.execute(
            select(func.count()).select_from(UserTenant).where(
                UserTenant.user_id == ut.user_id,
                UserTenant.id.notin_(this_user_row_ids),
            )
        )
        has_outside = (outside_res.scalar_one() or 0) > 0

        if not has_outside:
            # No memberships outside this company — hard-delete User
            user_obj = await db.get(User, ut.user_id)
            if user_obj:
                await db.delete(user_obj)
        # else: user exists in other companies — tenant CASCADE removes their rows here

    # ── Step 3: write audit records BEFORE deleting tenants ─────────────────────
    for t in all_tenants:
        await _log(
            "TENANT_DELETED",
            current_user.user_id,
            t.id,
            {
                "name": t.name,
                "slug": t.slug,
                "environment": t.environment,
                "lifecycle_status": t.lifecycle_status,
                "paired_delete": len(all_tenants) > 1,
            },
            db,
        )

    # ── Step 4: delete all tenant rows (CASCADE handles child tables) ───────────
    # Delete live tenant first to avoid parent_tenant_id FK issues.
    for t in sorted(all_tenants, key=lambda x: 0 if x.environment == "live" else 1):
        await db.delete(t)
    await db.commit()

    return Response(status_code=204)


# ── SA: Create tenant directly ──────────────────────────────────────────────

@router.post("/tenants", response_model=CreateTenantResponse, status_code=201)
async def create_tenant(
    data: CreateTenantRequest,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> CreateTenantResponse:
    """
    SA-only: create a new trial tenant from the platform portal.

    Creates:
      1. A Tenant row (lifecycle_status='in_implementation', environment='test')
      2. An initial Power Admin User account
      3. A UserTenant linking them with role_tier='power_admin'
      4. A TenantOrgConfig with the chosen posting_mode
      5. Optional module licenses from initial_modules list

    A temporary password is auto-generated and returned in the response for
    one-time display. The admin must change it on first login (must_change_password=True).
    No email is sent automatically.
    """
    from app.core.security import hash_password
    from app.models.setup import TenantOrgConfig
    from app.constants.modules import VALID_MODULE_KEYS

    _sa(current_user)

    # ─ Validate country code ───────────────────────────────────────────────────────────────────
    country = data.company_country.strip().upper()
    if len(country) != 2 or not country.isalpha():
        raise HTTPException(status_code=400, detail="company_country must be a 2-letter ISO code.")

    # ─ Auto-generate a secure temporary password ──────────────────────────────────────────────────
    import secrets as _secrets
    _chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%"
    temp_password = "".join(_secrets.choice(_chars) for _ in range(14))

    # ─ Validate module keys ─────────────────────────────────────────────────────────────────
    invalid_modules = [k for k in (data.initial_modules or []) if k not in VALID_MODULE_KEYS]
    if invalid_modules:
        raise HTTPException(status_code=400, detail=f"Unknown module keys: {invalid_modules}")

    # ─ Check email uniqueness ───────────────────────────────────────────────────────────────────
    admin_email = data.admin_email.strip().lower()
    existing_user = (
        await db.execute(select(User).where(User.email == admin_email))
    ).scalar_one_or_none()
    if existing_user:
        raise HTTPException(
            status_code=409,
            detail=f"A user with email {admin_email} already exists."
        )

    # ─ Build slug from company name ─────────────────────────────────────────────────────────────────
    import re as _re
    base_slug = _re.sub(r'[^a-z0-9]+', '-', data.company_name.strip().lower()).strip('-')[:40]
    slug = base_slug
    suffix = 1
    while (await db.execute(select(Tenant).where(Tenant.slug == slug))).scalar_one_or_none():
        slug = f"{base_slug}-{suffix}"
        suffix += 1

    # ─ Create tenant ───────────────────────────────────────────────────────────────────────────
    from app.models.auth import AccountType
    tenant = Tenant(
        name=data.company_name.strip(),
        slug=slug,
        country=country,
        environment="test",      # M9.0.1: test-first — live is born from promotion, never created empty
        lifecycle_status="in_implementation",  # SA-created = already committed, skip trial
        lead_status="new",
        is_internal=data.is_internal,
        company_size=data.company_size,
        interested_modules=data.interested_modules,
    )
    db.add(tenant)
    await db.flush()  # get tenant.id

    # ─ TenantOrgConfig ───────────────────────────────────────────────────────────────────────────
    # Derive a default functional currency from country (best-effort; can be changed later)
    _CURRENCY_MAP = {
        "NG": "NGN", "GH": "GHS", "KE": "KES", "ZA": "ZAR", "GB": "GBP",
        "US": "USD", "CA": "CAD", "AU": "AUD", "DE": "EUR", "FR": "EUR",
        "NL": "EUR", "AE": "AED", "SG": "SGD", "IN": "INR", "BR": "BRL",
        "JP": "JPY", "CN": "CNY", "EG": "EGP", "ET": "ETB", "RW": "RWF",
    }
    functional_currency = _CURRENCY_MAP.get(country, "USD")
    db.add(TenantOrgConfig(
        tenant_id=tenant.id,
        functional_currency=functional_currency,
        posting_mode=data.posting_mode,
        legal_name=data.company_name.strip(),   # seed from SA form — avoids blank Organisation tab
        country=country,                         # already validated 2-letter ISO above
    ))

    # ─ Module licenses ───────────────────────────────────────────────────────────────────────────
    from app.models.setup import TenantModule
    for module_key in (data.initial_modules or []):
        db.add(TenantModule(
            tenant_id=tenant.id,
            module_key=module_key,
            is_licensed=True,
            is_active=True,
        ))

    # ─ Create admin user ───────────────────────────────────────────────────────────────────────────
    admin_user = User(
        email=admin_email,
        full_name=data.admin_full_name.strip(),
        first_name=data.admin_full_name.strip().split(" ")[0],
        account_type=AccountType.business,
        is_active=True,
        is_super_admin=False,
    )
    db.add(admin_user)
    await db.flush()  # get admin_user.id

    # ─ UserTenant link with power_admin role tier (holds password hash) ──────────────
    db.add(UserTenant(
        user_id=admin_user.id,
        tenant_id=tenant.id,
        password_hash=hash_password(temp_password),
        role_tier="power_admin",
        is_active=True,
        must_change_password=True,  # SA-set temp password -- admin must change on first login
    ))

    # -- Audit log --
    await _log(
        "platform.tenant.created_by_sa",
        current_user.user_id,
        tenant.id,
        {
            "company_name": data.company_name,
            "admin_email": data.admin_email,
            "environment": "test",  # always test — live is born from promotion
        },
        db,
    )

    await db.commit()
    await db.refresh(tenant)
    await db.refresh(admin_user)

    return CreateTenantResponse(
        id=str(tenant.id),
        name=tenant.name,
        slug=tenant.slug,
        country=tenant.country,
        environment=tenant.environment,
        lifecycle_status=tenant.lifecycle_status,
        created_at=tenant.created_at,
        admin_user_id=str(admin_user.id),
        admin_email=admin_user.email,
        temp_password=temp_password,
    )


# ── Platform Config (SA only) ─────────────────────────────────────────────────

from pydantic import BaseModel as _BaseModel  # local import to avoid circular


class PlatformConfigItem(_BaseModel):
    """A single platform config entry."""
    key: str
    value: str
    description: str | None = None


class PlatformConfigUpdate(_BaseModel):
    """Request body for updating a platform config key."""
    value: str


@router.get("/config", response_model=list[PlatformConfigItem], summary="List platform config (SA only)")
async def list_platform_config(
    current_user: CurrentUser = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
) -> list[PlatformConfigItem]:
    """
    Return all platform config key/value pairs.  Super Admin only.

    Returns:
        List of all current platform config entries.
    """
    config = await get_platform_config(db)
    rows = await db.execute(select(PlatformConfig))
    items = rows.scalars().all()
    return [
        PlatformConfigItem(key=r.key, value=r.value, description=r.description)
        for r in items
    ]


@router.patch("/config/{key}", response_model=PlatformConfigItem, summary="Update platform config key (SA only)")
async def update_platform_config(
    key: str,
    body: PlatformConfigUpdate,
    current_user: CurrentUser = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
) -> PlatformConfigItem:
    """
    Update a single platform config value.  Super Admin only.

    The change takes effect immediately — the in-process cache is invalidated
    on write, so the next request to GET /api/app-config returns the new value.
    Frontend pages refresh the config on load (60-second Next.js revalidation),
    so the new name appears within one minute across all connected browsers.

    Parameters:
        key:  Config key to update (e.g. 'app_name').
        body: New value.

    Returns:
        Updated PlatformConfigItem.

    Raises:
        404 if the key does not exist in platform_config (only known keys may
        be updated — new keys must be seeded via migration to prevent typos).
    """
    existing = await db.get(PlatformConfig, key)
    if existing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Config key '{key}' does not exist. New keys must be added via migration.",
        )

    if not body.value.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Value for '{key}' cannot be blank.",
        )

    row = await set_config(db, key=key, value=body.value.strip(), updated_by=current_user.user_id)
    await db.commit()
    await db.refresh(row)

    await _log(
        "platform.config.updated",
        current_user.user_id,
        None,
        {"key": key, "new_value": body.value.strip()},
        db,
    )
    await db.commit()

    return PlatformConfigItem(key=row.key, value=row.value, description=row.description)
