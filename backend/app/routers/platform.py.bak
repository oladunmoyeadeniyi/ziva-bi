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

Default list scope: LIVE tenants only (environment="live"). Use ?environment=test
or ?environment=all to widen. Test shadows (parent_tenant_id IS NOT NULL) are
excluded from the live default to keep the list uncluttered.

Suspend idempotency: POST /suspend on an already-suspended tenant returns 409.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.database import get_db
from app.middleware.auth import CurrentUser, require_auth, require_super_admin
from app.models.auth import AuditLog, Tenant, User, UserTenant
from app.schemas.auth import PromoteRequest, PromoteResponse, TestTenantResponse
from app.schemas.platform import (
    EnterTenantRequest,
    EnterTenantResponse,
    LifecycleUpdateRequest,
    PromotionApplyRequest,
    PromotionApplyResult,
    PromotionDiff,
    SuspendResponse,
    TenantDetail,
    TenantListItem,
    TenantUserSummary,
    TestEnvSummary,
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


# ── Promote config test → live (SA proxy) ─────────────────────────────────────

@router.post("/tenants/{tenant_id}/promote", response_model=PromoteResponse)
async def platform_promote(
    tenant_id: uuid.UUID,
    data: PromoteRequest,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> PromoteResponse:
    """
    Super Admin proxy — copy selected config sections from the tenant's test shadow to live.

    Callable from the platform portal where the SA token has no tenant_id.
    tenant_id must be the LIVE tenant; this endpoint locates the test shadow automatically.
    Guard: super admin only.

    Implemented sections (copied test → live):
        org_config  — TenantOrgConfig (all identity/fiscal/branding fields)
        tax         — TenantTaxConfig (VAT/WHT/PAYE JSONB blobs)
        fx          — TenantFxConfig  (FX rates, revaluation rules)

    Deferred (returned in PromoteResponse.deferred, not copied):
        chart_of_accounts — internal FK tree requires id remapping
        dimensions        — dimension_value → dimension FK requires id remapping
        periods           — operational state machine, not pure config
    """
    _sa(current_user)

    live_tenant = await _get_tenant_or_404(tenant_id, db)
    if live_tenant.environment != "live":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target tenant must be the live tenant.",
        )

    shadow_res = await db.execute(
        select(Tenant).where(
            Tenant.parent_tenant_id == tenant_id,
            Tenant.environment == "test",  # type: ignore[arg-type]
        )
    )
    shadow = shadow_res.scalar_one_or_none()
    if not shadow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No test environment found for this tenant. Create one first.",
        )

    from app.models.setup import TenantFxConfig, TenantOrgConfig, TenantTaxConfig

    _DEFERRED = {"chart_of_accounts", "dimensions", "periods"}
    promoted: list[str] = []
    deferred: list[str] = []

    for section in data.sections:
        if section in _DEFERRED:
            deferred.append(section)
            continue

        if section == "org_config":
            test_cfg_res = await db.execute(
                select(TenantOrgConfig).where(TenantOrgConfig.tenant_id == shadow.id)
            )
            test_cfg = test_cfg_res.scalar_one_or_none()
            if test_cfg:
                live_cfg_res = await db.execute(
                    select(TenantOrgConfig).where(TenantOrgConfig.tenant_id == tenant_id)
                )
                live_cfg = live_cfg_res.scalar_one_or_none()
                _ORG_FIELDS = [
                    "legal_name", "rc_number", "date_of_registration", "commencement_date",
                    "company_type", "industry", "tin", "vat_reg_number", "country",
                    "registered_address", "operating_address", "company_phone", "company_email",
                    "website", "external_auditor", "group_structure", "parent_company_name",
                    "functional_currency", "reporting_currency", "enabled_currencies",
                    "authorised_share_capital", "fiscal_year_start_month", "fiscal_year_start_day",
                    "fiscal_year_name_format", "period_closing_frequency", "branding",
                    "org_configuration", "block_journal_into_open_prior", "default_audit_grace_months",
                ]
                if live_cfg:
                    for f in _ORG_FIELDS:
                        setattr(live_cfg, f, getattr(test_cfg, f))
                else:
                    new_cfg = TenantOrgConfig(tenant_id=tenant_id)
                    for f in _ORG_FIELDS:
                        setattr(new_cfg, f, getattr(test_cfg, f))
                    db.add(new_cfg)
            promoted.append("org_config")

        elif section == "tax":
            test_tax_res = await db.execute(
                select(TenantTaxConfig).where(TenantTaxConfig.tenant_id == shadow.id)
            )
            test_tax = test_tax_res.scalar_one_or_none()
            if test_tax:
                live_tax_res = await db.execute(
                    select(TenantTaxConfig).where(TenantTaxConfig.tenant_id == tenant_id)
                )
                live_tax = live_tax_res.scalar_one_or_none()
                _TAX_FIELDS = ["vat_config", "wht_config", "paye_config", "other_statutory"]
                if live_tax:
                    for f in _TAX_FIELDS:
                        setattr(live_tax, f, getattr(test_tax, f))
                else:
                    new_tax = TenantTaxConfig(tenant_id=tenant_id)
                    for f in _TAX_FIELDS:
                        setattr(new_tax, f, getattr(test_tax, f))
                    db.add(new_tax)
            promoted.append("tax")

        elif section == "fx":
            test_fx_res = await db.execute(
                select(TenantFxConfig).where(TenantFxConfig.tenant_id == shadow.id)
            )
            test_fx = test_fx_res.scalar_one_or_none()
            if test_fx:
                live_fx_res = await db.execute(
                    select(TenantFxConfig).where(TenantFxConfig.tenant_id == tenant_id)
                )
                live_fx = live_fx_res.scalar_one_or_none()
                _FX_FIELDS = ["fx_rates", "revaluation_rules"]
                if live_fx:
                    for f in _FX_FIELDS:
                        setattr(live_fx, f, getattr(test_fx, f))
                else:
                    new_fx = TenantFxConfig(tenant_id=tenant_id)
                    for f in _FX_FIELDS:
                        setattr(new_fx, f, getattr(test_fx, f))
                    db.add(new_fx)
            promoted.append("fx")

    await db.flush()
    await _log(
        "platform.config.promoted",
        current_user.user_id,
        tenant_id,
        {"promoted": promoted, "deferred": deferred, "shadow_id": str(shadow.id)},
        db,
    )

    promoted_labels = {"org_config": "Organisation config", "tax": "Tax config", "fx": "FX config"}
    deferred_labels = {
        "chart_of_accounts": "Chart of Accounts",
        "dimensions": "Dimensions",
        "periods": "Accounting periods",
    }
    msg_promoted = ", ".join(promoted_labels.get(s, s) for s in promoted) or "nothing"
    msg_deferred = ", ".join(deferred_labels.get(s, s) for s in deferred) or "none"
    return PromoteResponse(
        promoted=promoted,
        deferred=deferred,
        message=f"Promoted: {msg_promoted}. Deferred (require manual handling): {msg_deferred}.",
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


# ── Phase 3a: CoA / Dimensions promotion — diff + apply ──────────────────────

def _get_shadow(live_tenant: Tenant) -> None:
    """Placeholder — shadow lookup is done inline in each endpoint."""
    pass


async def _require_live_with_shadow(
    tenant_id: uuid.UUID,
    db: AsyncSession,
) -> tuple[Tenant, Tenant]:
    """
    Load the live tenant and its test shadow.

    Returns (live_tenant, shadow_tenant). Raises 404 if either is missing.
    """
    live = await _get_tenant_or_404(tenant_id, db)
    if live.environment != "live":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target tenant must be a live tenant.",
        )
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
    return live, shadow


@router.post("/tenants/{tenant_id}/promotion/diff", response_model=PromotionDiff)
async def platform_promotion_diff(
    tenant_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> PromotionDiff:
    """
    Compute a read-only diff of CoA, Dimensions, DimensionValues, GLDimRequirements,
    and AccountMappings between the test shadow and the live tenant.

    Returns a structured PromotionDiff where each item has a stable item_id that
    the caller submits in the subsequent apply call to accept that change.

    Guard: super admin only. Target must be a live tenant with an existing test shadow.
    No DB writes — purely a preview / review step.
    """
    _sa(current_user)
    live, shadow = await _require_live_with_shadow(tenant_id, db)

    from app.services.promotion_engine import compute_promotion_diff
    diff, _ = await compute_promotion_diff(db, shadow.id, live.id)
    return diff


@router.post("/tenants/{tenant_id}/promotion/apply", response_model=PromotionApplyResult)
async def platform_promotion_apply(
    tenant_id: uuid.UUID,
    data: PromotionApplyRequest,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> PromotionApplyResult:
    """
    Apply a selection of promotion diff items to the live tenant.

    The server recomputes the diff fresh from the current DB state (ignoring any
    client-supplied diff to prevent stale/tampered data). Only items whose item_id
    appears in data.accepted_item_ids are applied.

    Dependency order: TenantDimension → ChartOfAccount → DimensionValue (2-pass
    for cascade_value_id) → GLDimensionRequirement → TenantAccountMapping.

    All-or-nothing: the entire apply runs inside get_db()'s transaction;
    any failure triggers a full rollback.

    Writes a platform.promotion.config_applied audit log entry on success.
    Guard: super admin only.
    """
    _sa(current_user)
    live, shadow = await _require_live_with_shadow(tenant_id, db)

    from app.services.promotion_engine import apply_promotion
    result = await apply_promotion(db, shadow.id, live.id, data)

    await _log(
        "platform.promotion.config_applied",
        current_user.user_id,
        tenant_id,
        {
            "shadow_id":      str(shadow.id),
            "accepted_count": len(data.accepted_item_ids),
            "created":        result.created,
            "updated":        result.updated,
            "deactivated":    result.deactivated,
            "total_applied":  result.total_applied,
        },
        db,
    )

    return result
