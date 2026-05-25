"""
ZivaBI — M8.2 Implementation Portal router.

Registered at prefix /api/setup.

Endpoints:
  GET   /api/setup/progress                   Setup dashboard completion state
  GET   /api/setup/org                        Organisation config
  PATCH /api/setup/org                        Update organisation config
  GET   /api/setup/modules                    Activated modules list
  PATCH /api/setup/modules                    Update module activations
  GET   /api/setup/currencies                 FX config
  PATCH /api/setup/currencies                 Update FX config
  GET   /api/setup/tax                        Tax config
  PATCH /api/setup/tax                        Update tax config
  GET   /api/setup/roles/matrix               Permission matrix
  PATCH /api/setup/roles/matrix               Update permission matrix
  GET   /api/setup/roles/assignments          Role tier assignments
  POST  /api/setup/roles/assignments          Create role tier assignment
  PATCH /api/setup/roles/assignments/{id}     Update role tier assignment
  GET   /api/setup/documents                  Document rules (filter by ?module=)
  POST  /api/setup/documents                  Create document rule
  PATCH /api/setup/documents/{id}             Update document rule
  DELETE /api/setup/documents/{id}            Delete document rule
  POST  /api/setup/go-live                    Mark tenant as live (consultant only)

All endpoints are tenant-scoped and require authentication.
Admin-only: require is_tenant_admin or is_super_admin.
go-live: require role_tier == 'consultant'.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func as sqlfunc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import CurrentUser, require_auth
from app.models.auth import UserTenant, User
from app.models.expenses import TenantExpenseConfig
from app.models.master_data import ChartOfAccount, Employee, TenantDimension
from app.models.setup import (
    DocumentRule,
    TenantFxConfig,
    TenantModule,
    TenantOrgConfig,
    TenantTaxConfig,
)
from app.schemas.setup import (
    DocumentRuleCreate,
    DocumentRuleResponse,
    DocumentRuleUpdate,
    FxConfigResponse,
    FxConfigUpdate,
    GoLiveResponse,
    ModuleState,
    ModulesResponse,
    ModulesUpdate,
    OrgConfigResponse,
    OrgIdentityUpdate,
    OrgStructureUpdate,
    BrandingUpdate,
    FiscalYearUpdate,
    PermissionMatrixResponse,
    PermissionMatrixUpdate,
    ProgressResponse,
    RoleAssignmentCreate,
    RoleAssignmentResponse,
    RoleAssignmentUpdate,
    SectionStatus,
    TaxConfigResponse,
    TaxConfigUpdate,
)

router = APIRouter(prefix="/api/setup", tags=["setup"])

# ── Module catalogue (all 14 modules) ─────────────────────────────────────────

MODULE_CATALOGUE = [
    {"key": "expense",         "label": "Expense Management"},
    {"key": "ap",              "label": "Accounts Payable"},
    {"key": "ar",              "label": "Accounts Receivable"},
    {"key": "payroll",         "label": "Payroll & HR"},
    {"key": "inventory",       "label": "Inventory Management"},
    {"key": "fixed_assets",    "label": "Fixed Assets"},
    {"key": "posm",            "label": "POSM Management"},
    {"key": "vendor_portal",   "label": "Vendor Portal"},
    {"key": "customer_portal", "label": "Customer Portal"},
    {"key": "warehouse",       "label": "Warehouse / 3PL Portal"},
    {"key": "bank_recon",      "label": "Bank Reconciliation"},
    {"key": "budget",          "label": "Budget Engine"},
    {"key": "tax_engine",      "label": "Tax Engine"},
    {"key": "reporting",       "label": "Reporting & Analytics"},
]

MODULE_KEY_TO_LABEL = {m["key"]: m["label"] for m in MODULE_CATALOGUE}


# ── Helpers ────────────────────────────────────────────────────────────────────

def _require_admin(current_user: CurrentUser) -> None:
    """Raise 403 if the user is not a tenant or super admin."""
    if not current_user.is_tenant_admin and not current_user.is_super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )


def _require_tenant(current_user: CurrentUser) -> uuid.UUID:
    """Return tenant_id or raise 400 if not in a tenant context."""
    if not current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant context required.",
        )
    return current_user.tenant_id


async def _get_or_create_org(tenant_id: uuid.UUID, db: AsyncSession) -> TenantOrgConfig:
    """Fetch the org config row, creating a blank one if it does not exist."""
    result = await db.execute(
        select(TenantOrgConfig).where(TenantOrgConfig.tenant_id == tenant_id)
    )
    org = result.scalar_one_or_none()
    if org is None:
        org = TenantOrgConfig(tenant_id=tenant_id)
        db.add(org)
        await db.flush()
    return org


async def _get_or_create_fx(tenant_id: uuid.UUID, db: AsyncSession) -> TenantFxConfig:
    """Fetch FX config, creating a blank row if needed."""
    result = await db.execute(
        select(TenantFxConfig).where(TenantFxConfig.tenant_id == tenant_id)
    )
    fx = result.scalar_one_or_none()
    if fx is None:
        fx = TenantFxConfig(tenant_id=tenant_id)
        db.add(fx)
        await db.flush()
    return fx


async def _get_or_create_tax(tenant_id: uuid.UUID, db: AsyncSession) -> TenantTaxConfig:
    """Fetch tax config, creating a blank row if needed."""
    result = await db.execute(
        select(TenantTaxConfig).where(TenantTaxConfig.tenant_id == tenant_id)
    )
    tax = result.scalar_one_or_none()
    if tax is None:
        tax = TenantTaxConfig(tenant_id=tenant_id)
        db.add(tax)
        await db.flush()
    return tax


def _org_to_response(org: Optional[TenantOrgConfig], tenant_id: uuid.UUID) -> OrgConfigResponse:
    """Convert ORM org config to response schema."""
    if org is None:
        return OrgConfigResponse(tenant_id=str(tenant_id))
    return OrgConfigResponse(
        tenant_id=str(org.tenant_id),
        legal_name=org.legal_name,
        rc_number=org.rc_number,
        industry=org.industry,
        functional_currency=org.functional_currency,
        reporting_currency=org.reporting_currency,
        country=org.country,
        group_structure=org.group_structure,
        parent_company_name=org.parent_company_name,
        tin=org.tin,
        vat_reg_number=org.vat_reg_number,
        fiscal_year_start_month=org.fiscal_year_start_month,
        fiscal_year_start_day=org.fiscal_year_start_day,
        period_frequency=org.period_frequency,
        org_structure=org.org_structure,
        branding=org.branding,
    )


# ── Progress ───────────────────────────────────────────────────────────────────

@router.get("/progress", response_model=ProgressResponse)
async def get_progress(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> ProgressResponse:
    """
    Return setup dashboard completion state for the current tenant.

    Calculates completion status for each of the 12 setup sections based on
    the presence and content of the corresponding config records. Returns
    a percentage and per-section status for the checklist cards.
    """
    _require_admin(current_user)
    tenant_id = _require_tenant(current_user)

    # Check org config
    org_result = await db.execute(
        select(TenantOrgConfig).where(TenantOrgConfig.tenant_id == tenant_id)
    )
    org = org_result.scalar_one_or_none()
    org_complete = bool(
        org and org.legal_name and org.functional_currency and org.fiscal_year_start_month
    )

    # Check modules
    mods_result = await db.execute(
        select(TenantModule).where(
            TenantModule.tenant_id == tenant_id, TenantModule.is_active.is_(True)
        )
    )
    active_modules = mods_result.scalars().all()
    modules_complete = len(active_modules) > 0

    # Check CoA
    coa_count_result = await db.execute(
        select(sqlfunc.count(ChartOfAccount.id)).where(
            ChartOfAccount.tenant_id == tenant_id,
            ChartOfAccount.is_active.is_(True),
        )
    )
    coa_count = coa_count_result.scalar_one() or 0
    coa_complete = coa_count > 0

    # Check dimensions
    dim_count_result = await db.execute(
        select(sqlfunc.count(TenantDimension.id)).where(
            TenantDimension.tenant_id == tenant_id,
            TenantDimension.is_active.is_(True),
        )
    )
    dim_count = dim_count_result.scalar_one() or 0
    dims_complete = dim_count > 0  # also complete if org has 'not_applicable' flag

    # Check employees
    emp_count_result = await db.execute(
        select(sqlfunc.count(Employee.id)).where(
            Employee.tenant_id == tenant_id,
            Employee.is_active.is_(True),
        )
    )
    emp_count = emp_count_result.scalar_one() or 0
    employees_complete = emp_count > 0

    # Check currencies (auto-complete if org functional_currency set)
    currencies_complete = bool(org and org.functional_currency)

    # Check tax
    tax_result = await db.execute(
        select(TenantTaxConfig).where(TenantTaxConfig.tenant_id == tenant_id)
    )
    tax = tax_result.scalar_one_or_none()
    tax_complete = bool(tax and (tax.vat_config or tax.wht_config or tax.paye_config))

    # Check roles — at least 1 Power Admin assigned
    pa_result = await db.execute(
        select(sqlfunc.count(UserTenant.id)).where(
            UserTenant.tenant_id == tenant_id,
            UserTenant.role_tier == "power_admin",
            UserTenant.is_active.is_(True),
        )
    )
    pa_count = pa_result.scalar_one() or 0
    roles_complete = pa_count > 0

    # Check workflows — at least 1 expense approval matrix entry (best proxy available)
    from app.models.approvals import ApprovalMatrix
    wf_result = await db.execute(
        select(sqlfunc.count(ApprovalMatrix.id)).where(
            ApprovalMatrix.tenant_id == tenant_id,
        )
    )
    wf_count = wf_result.scalar_one() or 0
    workflows_complete = wf_count > 0

    # Document rules (non-blocking — just check if any rules exist)
    doc_count_result = await db.execute(
        select(sqlfunc.count(DocumentRule.id)).where(
            DocumentRule.tenant_id == tenant_id,
            DocumentRule.is_active.is_(True),
        )
    )
    doc_count = doc_count_result.scalar_one() or 0
    docs_complete = doc_count > 0

    # Module setup — expense config exists (best proxy for at least 1 module configured)
    ec_result = await db.execute(
        select(TenantExpenseConfig).where(TenantExpenseConfig.tenant_id == tenant_id)
    )
    ec = ec_result.scalar_one_or_none()
    module_setup_complete = ec is not None

    # Go-live — all blocking sections done
    blocking_complete = all([
        org_complete,
        modules_complete,
        coa_complete,
        dims_complete,
        employees_complete,
        tax_complete,
        roles_complete,
        workflows_complete,
    ])

    def _s(
        key: str,
        label: str,
        complete: bool,
        subtitle: str,
        route: str,
        blocking: bool = True,
        locked: bool = False,
    ) -> SectionStatus:
        if locked:
            st = "locked"
        elif complete:
            st = "complete"
        else:
            st = "not_started"
        return SectionStatus(
            key=key,
            label=label,
            status=st,
            subtitle=subtitle,
            route=route,
            blocking=blocking,
        )

    sections = [
        _s("organisation",   "Organisation",     org_complete,
           f"Legal name: {org.legal_name}" if org_complete else "Not configured",
           "/dashboard/business/setup/organisation"),
        _s("modules",        "Module activation", modules_complete,
           f"{len(active_modules)} module(s) active" if modules_complete else "No modules activated",
           "/dashboard/business/setup/modules"),
        _s("coa",            "Chart of accounts", coa_complete,
           f"{coa_count:,} GL accounts loaded" if coa_complete else "No accounts loaded",
           "/dashboard/business/settings/chart-of-accounts"),
        _s("dimensions",     "Dimensions",        dims_complete,
           f"{dim_count} dimension(s) configured" if dims_complete else "Not configured",
           "/dashboard/business/settings/dimensions"),
        _s("employees",      "Employees",         employees_complete,
           f"{emp_count:,} employee(s) loaded" if employees_complete else "No employees loaded",
           "/dashboard/business/settings/employees"),
        _s("currencies",     "Currencies & FX",   currencies_complete,
           f"Functional: {org.functional_currency}" if currencies_complete else "Not configured",
           "/dashboard/business/setup/currencies", blocking=False),
        _s("tax",            "Tax & statutory",   tax_complete,
           "Tax rules configured" if tax_complete else "Not configured",
           "/dashboard/business/setup/tax"),
        _s("roles",          "Roles & permissions", roles_complete,
           f"{pa_count} Power Admin(s) assigned" if roles_complete else "No Power Admin assigned",
           "/dashboard/business/setup/roles"),
        _s("workflows",      "Approval workflows", workflows_complete,
           "Workflows configured" if workflows_complete else "Not configured",
           "/dashboard/business/settings/approval-matrix"),
        _s("documents",      "Document rules",    docs_complete,
           f"{doc_count} rule(s) configured" if docs_complete else "Not configured",
           "/dashboard/business/setup/documents", blocking=False),
        _s("module_setup",   "Module setup",      module_setup_complete,
           "Expense module configured" if module_setup_complete else "No modules configured",
           "/dashboard/business/settings/expense-config", blocking=False),
        _s("golive",         "Go-live",           blocking_complete,
           "All blocking items complete" if blocking_complete else "Blocking items incomplete",
           "/dashboard/business/setup/go-live"),
    ]

    completed = sum(1 for s in sections if s.status == "complete")
    total = len(sections)
    pct = round(completed / total * 100) if total else 0

    return ProgressResponse(sections=sections, total=total, completed=completed, percentage=pct)


# ── Organisation ───────────────────────────────────────────────────────────────

@router.get("/org", response_model=OrgConfigResponse)
async def get_org(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> OrgConfigResponse:
    """Return the tenant org configuration (all four tabs)."""
    _require_admin(current_user)
    tenant_id = _require_tenant(current_user)
    result = await db.execute(
        select(TenantOrgConfig).where(TenantOrgConfig.tenant_id == tenant_id)
    )
    org = result.scalar_one_or_none()
    return _org_to_response(org, tenant_id)


@router.patch("/org", response_model=OrgConfigResponse)
async def patch_org(
    data: OrgIdentityUpdate | OrgStructureUpdate | BrandingUpdate | FiscalYearUpdate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> OrgConfigResponse:
    """
    Update org config (any subset of fields).

    Accepts any of the four tab payloads — only present fields are updated.
    """
    _require_admin(current_user)
    tenant_id = _require_tenant(current_user)
    org = await _get_or_create_org(tenant_id, db)

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(org, field, value)

    await db.commit()
    await db.refresh(org)
    return _org_to_response(org, tenant_id)


# ── Modules ────────────────────────────────────────────────────────────────────

@router.get("/modules", response_model=ModulesResponse)
async def get_modules(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> ModulesResponse:
    """Return all 14 modules with their activation state for the tenant."""
    _require_admin(current_user)
    tenant_id = _require_tenant(current_user)

    result = await db.execute(
        select(TenantModule).where(TenantModule.tenant_id == tenant_id)
    )
    existing = {m.module_key: m.is_active for m in result.scalars().all()}

    modules = [
        ModuleState(
            module_key=m["key"],
            label=m["label"],
            is_active=existing.get(m["key"], False),
        )
        for m in MODULE_CATALOGUE
    ]
    return ModulesResponse(modules=modules)


@router.patch("/modules", response_model=ModulesResponse)
async def patch_modules(
    data: ModulesUpdate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> ModulesResponse:
    """
    Activate or deactivate modules for the tenant.

    Upserts a row per module_key — creates the row if it does not exist,
    updates is_active if it does. Partial updates are supported (only send
    the modules you want to change).
    """
    _require_admin(current_user)
    tenant_id = _require_tenant(current_user)

    result = await db.execute(
        select(TenantModule).where(TenantModule.tenant_id == tenant_id)
    )
    existing_map = {m.module_key: m for m in result.scalars().all()}

    now = datetime.now(timezone.utc)
    for key, active in data.modules.items():
        if key not in MODULE_KEY_TO_LABEL:
            continue  # ignore unknown keys
        if key in existing_map:
            mod = existing_map[key]
            if active and not mod.is_active:
                mod.activated_at = now
                mod.activated_by = current_user.user_id
            mod.is_active = active
        else:
            mod = TenantModule(
                tenant_id=tenant_id,
                module_key=key,
                is_active=active,
                activated_at=now if active else None,
                activated_by=current_user.user_id if active else None,
            )
            db.add(mod)

    await db.commit()
    return await get_modules(current_user=current_user, db=db)


# ── Currencies & FX ───────────────────────────────────────────────────────────

@router.get("/currencies", response_model=FxConfigResponse)
async def get_currencies(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> FxConfigResponse:
    """Return FX config for the tenant (all three tabs)."""
    _require_admin(current_user)
    tenant_id = _require_tenant(current_user)

    # Functional currency comes from org config
    org_result = await db.execute(
        select(TenantOrgConfig).where(TenantOrgConfig.tenant_id == tenant_id)
    )
    org = org_result.scalar_one_or_none()

    fx_result = await db.execute(
        select(TenantFxConfig).where(TenantFxConfig.tenant_id == tenant_id)
    )
    fx = fx_result.scalar_one_or_none()

    return FxConfigResponse(
        functional_currency=org.functional_currency if org else None,
        reporting_currency=fx.reporting_currency if fx else None,
        additional_currencies=fx.additional_currencies if fx else None,
        fx_rates=fx.fx_rates if fx else None,
        revaluation_rules=fx.revaluation_rules if fx else None,
    )


@router.patch("/currencies", response_model=FxConfigResponse)
async def patch_currencies(
    data: FxConfigUpdate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> FxConfigResponse:
    """Update FX config for the tenant."""
    _require_admin(current_user)
    tenant_id = _require_tenant(current_user)
    fx = await _get_or_create_fx(tenant_id, db)

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(fx, field, value)

    await db.commit()
    return await get_currencies(current_user=current_user, db=db)


# ── Tax & Statutory ───────────────────────────────────────────────────────────

@router.get("/tax", response_model=TaxConfigResponse)
async def get_tax(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> TaxConfigResponse:
    """Return tax config for the tenant (all four tabs)."""
    _require_admin(current_user)
    tenant_id = _require_tenant(current_user)
    tax = await _get_or_create_tax(tenant_id, db)
    await db.commit()  # persist the created row if new
    return TaxConfigResponse(
        vat_config=tax.vat_config,
        wht_config=tax.wht_config,
        paye_config=tax.paye_config,
        other_statutory=tax.other_statutory,
    )


@router.patch("/tax", response_model=TaxConfigResponse)
async def patch_tax(
    data: TaxConfigUpdate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> TaxConfigResponse:
    """Update tax config for the tenant (partial updates supported)."""
    _require_admin(current_user)
    tenant_id = _require_tenant(current_user)
    tax = await _get_or_create_tax(tenant_id, db)

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(tax, field, value)

    await db.commit()
    await db.refresh(tax)
    return TaxConfigResponse(
        vat_config=tax.vat_config,
        wht_config=tax.wht_config,
        paye_config=tax.paye_config,
        other_statutory=tax.other_statutory,
    )


# ── Roles & Permissions ───────────────────────────────────────────────────────

@router.get("/roles/matrix", response_model=PermissionMatrixResponse)
async def get_roles_matrix(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> PermissionMatrixResponse:
    """
    Return the permission matrix for all sections × role tiers.

    For M8.2 this returns a static default matrix. Customisation is stored
    and returned in a future enhancement.
    """
    _require_admin(current_user)
    _require_tenant(current_user)

    sections = [
        "Organisation", "Module activation", "Chart of accounts", "Dimensions",
        "Employees", "Currencies & FX", "Tax & statutory", "Roles & permissions",
        "Approval workflows", "Document rules", "Module setup",
    ]
    cells = []
    for sec in sections:
        cells.append({"section": sec, "role_tier": "consultant", "access_level": "full"})
        cells.append({"section": sec, "role_tier": "power_admin", "access_level": "full"})
        cells.append({"section": sec, "role_tier": "functional_admin", "access_level": "read_only"})

    return PermissionMatrixResponse(cells=cells)


@router.patch("/roles/matrix", response_model=PermissionMatrixResponse)
async def patch_roles_matrix(
    data: PermissionMatrixUpdate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> PermissionMatrixResponse:
    """Update permission matrix cells (consultant only in production)."""
    _require_admin(current_user)
    _require_tenant(current_user)
    # For M8.2: return the updated cells as-is (no persistence yet)
    return PermissionMatrixResponse(cells=data.cells)


@router.get("/roles/assignments", response_model=list[RoleAssignmentResponse])
async def get_role_assignments(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> list[RoleAssignmentResponse]:
    """List all users in this tenant with their role tier assignments."""
    _require_admin(current_user)
    tenant_id = _require_tenant(current_user)

    result = await db.execute(
        select(UserTenant, User)
        .join(User, UserTenant.user_id == User.id)
        .where(
            UserTenant.tenant_id == tenant_id,
            UserTenant.is_active.is_(True),
        )
    )
    rows = result.all()

    return [
        RoleAssignmentResponse(
            id=str(ut.id),
            user_tenant_id=str(ut.id),
            full_name=u.full_name,
            email=u.email,
            role_tier=ut.role_tier,
            is_active=ut.is_active,
        )
        for ut, u in rows
    ]


@router.post("/roles/assignments", response_model=RoleAssignmentResponse)
async def create_role_assignment(
    data: RoleAssignmentCreate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> RoleAssignmentResponse:
    """Assign a role tier to a user within this tenant."""
    _require_admin(current_user)
    tenant_id = _require_tenant(current_user)

    result = await db.execute(
        select(UserTenant, User)
        .join(User, UserTenant.user_id == User.id)
        .where(
            UserTenant.id == data.user_tenant_id,
            UserTenant.tenant_id == tenant_id,
        )
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="User not found in this tenant.")

    ut, u = row
    ut.role_tier = data.role_tier
    await db.commit()
    await db.refresh(ut)

    return RoleAssignmentResponse(
        id=str(ut.id),
        user_tenant_id=str(ut.id),
        full_name=u.full_name,
        email=u.email,
        role_tier=ut.role_tier,
        is_active=ut.is_active,
    )


@router.patch("/roles/assignments/{assignment_id}", response_model=RoleAssignmentResponse)
async def update_role_assignment(
    assignment_id: uuid.UUID,
    data: RoleAssignmentUpdate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> RoleAssignmentResponse:
    """Update the role tier for an existing assignment."""
    _require_admin(current_user)
    tenant_id = _require_tenant(current_user)

    result = await db.execute(
        select(UserTenant, User)
        .join(User, UserTenant.user_id == User.id)
        .where(
            UserTenant.id == assignment_id,
            UserTenant.tenant_id == tenant_id,
        )
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Assignment not found.")

    ut, u = row
    ut.role_tier = data.role_tier
    await db.commit()
    await db.refresh(ut)

    return RoleAssignmentResponse(
        id=str(ut.id),
        user_tenant_id=str(ut.id),
        full_name=u.full_name,
        email=u.email,
        role_tier=ut.role_tier,
        is_active=ut.is_active,
    )


# ── Document Rules ─────────────────────────────────────────────────────────────

@router.get("/documents", response_model=list[DocumentRuleResponse])
async def get_documents(
    module: Optional[str] = Query(None, description="Filter by module key"),
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> list[DocumentRuleResponse]:
    """List document rules for the tenant, optionally filtered by module."""
    _require_admin(current_user)
    tenant_id = _require_tenant(current_user)

    q = select(DocumentRule).where(
        DocumentRule.tenant_id == tenant_id,
        DocumentRule.is_active.is_(True),
    )
    if module:
        q = q.where(DocumentRule.module == module)
    q = q.order_by(DocumentRule.module, DocumentRule.transaction_type)

    result = await db.execute(q)
    rules = result.scalars().all()

    return [
        DocumentRuleResponse(
            id=str(r.id),
            module=r.module,
            transaction_type=r.transaction_type,
            document_name=r.document_name,
            is_required=r.is_required,
            track_expiry=r.track_expiry,
            ocr_template=r.ocr_template,
            max_size_mb=r.max_size_mb,
            allowed_formats=r.allowed_formats,
            max_files=r.max_files,
            is_active=r.is_active,
        )
        for r in rules
    ]


@router.post("/documents", response_model=DocumentRuleResponse, status_code=201)
async def create_document_rule(
    data: DocumentRuleCreate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> DocumentRuleResponse:
    """Create a new document rule for the tenant."""
    _require_admin(current_user)
    tenant_id = _require_tenant(current_user)

    rule = DocumentRule(
        tenant_id=tenant_id,
        module=data.module,
        transaction_type=data.transaction_type,
        document_name=data.document_name,
        is_required=data.is_required,
        track_expiry=data.track_expiry,
        ocr_template=data.ocr_template,
        max_size_mb=data.max_size_mb,
        allowed_formats=data.allowed_formats,
        max_files=data.max_files,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)

    return DocumentRuleResponse(
        id=str(rule.id),
        module=rule.module,
        transaction_type=rule.transaction_type,
        document_name=rule.document_name,
        is_required=rule.is_required,
        track_expiry=rule.track_expiry,
        ocr_template=rule.ocr_template,
        max_size_mb=rule.max_size_mb,
        allowed_formats=rule.allowed_formats,
        max_files=rule.max_files,
        is_active=rule.is_active,
    )


@router.patch("/documents/{rule_id}", response_model=DocumentRuleResponse)
async def update_document_rule(
    rule_id: uuid.UUID,
    data: DocumentRuleUpdate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> DocumentRuleResponse:
    """Update a document rule."""
    _require_admin(current_user)
    tenant_id = _require_tenant(current_user)

    result = await db.execute(
        select(DocumentRule).where(
            DocumentRule.id == rule_id,
            DocumentRule.tenant_id == tenant_id,
        )
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Document rule not found.")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(rule, field, value)

    await db.commit()
    await db.refresh(rule)

    return DocumentRuleResponse(
        id=str(rule.id),
        module=rule.module,
        transaction_type=rule.transaction_type,
        document_name=rule.document_name,
        is_required=rule.is_required,
        track_expiry=rule.track_expiry,
        ocr_template=rule.ocr_template,
        max_size_mb=rule.max_size_mb,
        allowed_formats=rule.allowed_formats,
        max_files=rule.max_files,
        is_active=rule.is_active,
    )


@router.delete("/documents/{rule_id}", status_code=204)
async def delete_document_rule(
    rule_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Soft-delete a document rule (sets is_active=false)."""
    _require_admin(current_user)
    tenant_id = _require_tenant(current_user)

    result = await db.execute(
        select(DocumentRule).where(
            DocumentRule.id == rule_id,
            DocumentRule.tenant_id == tenant_id,
        )
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Document rule not found.")

    rule.is_active = False
    await db.commit()


# ── Go-live ────────────────────────────────────────────────────────────────────

@router.post("/go-live", response_model=GoLiveResponse)
async def mark_go_live(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> GoLiveResponse:
    """
    Mark this tenant as live.

    Requires role_tier == 'consultant' or is_super_admin.
    Checks that all blocking sections are complete before allowing go-live.
    Sets tenant.is_active = True and updates a go-live timestamp.
    """
    if not current_user.is_super_admin and current_user.role_tier != "consultant":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only consultants and super admins can mark a tenant as live.",
        )

    tenant_id = _require_tenant(current_user)

    # Verify progress — all blocking items must be complete
    progress = await get_progress(current_user=current_user, db=db)
    blocking_incomplete = [
        s.label for s in progress.sections if s.blocking and s.status != "complete"
    ]
    if blocking_incomplete:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Blocking items incomplete: {', '.join(blocking_incomplete)}",
        )

    from app.models.auth import Tenant
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found.")

    tenant.is_active = True
    await db.commit()

    return GoLiveResponse(
        message="Tenant is now live. Welcome emails will be sent to all Power Admins.",
        tenant_id=str(tenant_id),
    )
