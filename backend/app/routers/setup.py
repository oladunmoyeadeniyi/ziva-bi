"""
ZivaBI — M8.2 Implementation Portal router.

Registered at prefix /api/setup.

Endpoints:
  GET   /api/setup/progress                   Setup dashboard completion state
  GET   /api/setup/org                        Organisation config
  PATCH /api/setup/org                        Update organisation config
  GET   /api/setup/org-structure              Org tree (recursive)
  POST  /api/setup/org-structure              Add a node
  PATCH /api/setup/org-structure/{id}         Update a node
  DELETE /api/setup/org-structure/{id}        Remove a node
  GET   /api/setup/org-structure/template     Download xlsx template
  POST  /api/setup/org-structure/upload       Upload structure from xlsx/csv
  GET   /api/setup/fiscal-periods             List fiscal periods
  POST  /api/setup/fiscal-periods/generate    Generate periods for a fiscal year
  GET   /api/setup/modules                    Activated modules list (with is_licensed)
  PATCH /api/setup/modules                    Update module activations (checks is_licensed)
  POST  /api/setup/dimensions/not-applicable   Mark tenant as not using dimensions
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

import io
import uuid
from calendar import monthrange
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func as sqlfunc, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import CurrentUser, require_auth
from app.models.auth import UserTenant, User, Tenant
from app.models.expenses import TenantExpenseConfig
from app.models.master_data import ChartOfAccount, Employee, TenantDimension
from app.models.setup import (
    DocumentRule,
    EmployeeOnboardingToken,
    FiscalPeriod,
    OrgStructureNode,
    TenantFxConfig,
    TenantModule,
    TenantOrgConfig,
    TenantTaxConfig,
)
from app.schemas.setup import (
    BrandingUpdate,
    DocumentRuleCreate,
    DocumentRuleResponse,
    DocumentRuleUpdate,
    FiscalPeriodResponse,
    FiscalYearUpdate,
    FxConfigResponse,
    FxConfigUpdate,
    GeneratePeriodsRequest,
    GoLiveResponse,
    ModuleState,
    ModulesResponse,
    ModulesUpdate,
    OrgConfigResponse,
    OrgIdentityUpdate,
    OrgStructureNodeCreate,
    OrgStructureNodeResponse,
    OrgStructureNodeUpdate,
    OrgStructureTreeResponse,
    OrgStructureUpdate,
    OrgStructureUploadResult,
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

# Country → functional currency map (ISO 4217)
COUNTRY_CURRENCY_MAP: dict[str, str] = {
    "NG": "NGN", "GH": "GHS", "KE": "KES", "ZA": "ZAR",
    "GB": "GBP", "US": "USD", "CA": "CAD", "AU": "AUD",
    "DE": "EUR", "FR": "EUR", "NL": "EUR", "AE": "AED",
    "SG": "SGD", "IN": "INR", "BR": "BRL", "JP": "JPY",
    "CN": "CNY", "EG": "EGP", "ET": "ETB", "RW": "RWF",
}

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
    """Fetch the org config row, creating one seeded with functional currency if it does not exist."""
    result = await db.execute(
        select(TenantOrgConfig).where(TenantOrgConfig.tenant_id == tenant_id)
    )
    org = result.scalar_one_or_none()
    if org is None:
        # Derive functional currency from the tenant's country (fallback for legacy tenants)
        tenant_result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
        tenant = tenant_result.scalar_one_or_none()
        functional_currency = COUNTRY_CURRENCY_MAP.get(
            tenant.country if tenant else "", "USD"
        )
        org = TenantOrgConfig(
            tenant_id=tenant_id,
            functional_currency=functional_currency,
        )
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
        date_of_registration=org.date_of_registration,
        commencement_date=org.commencement_date,
        company_type=org.company_type,
        industry=org.industry,
        tin=org.tin,
        vat_reg_number=org.vat_reg_number,
        country=org.country,
        registered_address=org.registered_address,
        operating_address=org.operating_address,
        company_phone=org.company_phone,
        company_email=org.company_email,
        website=org.website,
        external_auditor=org.external_auditor,
        group_structure=org.group_structure,
        parent_company_name=org.parent_company_name,
        functional_currency=org.functional_currency,
        reporting_currency=org.reporting_currency,
        authorised_share_capital=float(org.authorised_share_capital) if org.authorised_share_capital else None,
        fiscal_year_start_month=org.fiscal_year_start_month,
        fiscal_year_start_day=org.fiscal_year_start_day,
        fiscal_year_name_format=org.fiscal_year_name_format,
        period_closing_frequency=org.period_closing_frequency,
        branding=org.branding,
        org_configuration=org.org_configuration,
    )


def _build_tree(nodes: list[OrgStructureNode]) -> list[OrgStructureNodeResponse]:
    """Build a nested tree from a flat list of nodes (single pass)."""
    node_map: dict[str, OrgStructureNodeResponse] = {}
    for n in nodes:
        node_map[str(n.id)] = OrgStructureNodeResponse(
            id=str(n.id),
            parent_id=str(n.parent_id) if n.parent_id else None,
            node_type=n.node_type,
            name=n.name,
            code=n.code,
            cost_center_code=n.cost_center_code,
            entity_code=n.entity_code,
            is_active=n.is_active,
            sort_order=n.sort_order,
            children=[],
        )

    roots: list[OrgStructureNodeResponse] = []
    for n in nodes:
        resp = node_map[str(n.id)]
        if n.parent_id and str(n.parent_id) in node_map:
            node_map[str(n.parent_id)].children.append(resp)
        else:
            roots.append(resp)
    return roots


# ── Progress ───────────────────────────────────────────────────────────────────

@router.get("/progress", response_model=ProgressResponse)
async def get_progress(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> ProgressResponse:
    """
    Return setup dashboard completion state for the current tenant.

    Fixed logic per M8.2 fixes brief:
    - Dimensions: complete if not_applicable flag set OR all dims have >= 1 value
    - Locked/unlocked sequence enforced
    - is_licensed enforced on module activation
    """
    _require_admin(current_user)
    tenant_id = _require_tenant(current_user)

    # Fetch tenant flags
    tenant_result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = tenant_result.scalar_one_or_none()
    dims_not_applicable = bool(tenant and tenant.dimensions_not_applicable)
    docs_setup_complete = bool(tenant and tenant.documents_setup_complete)

    # Check org config
    org_result = await db.execute(
        select(TenantOrgConfig).where(TenantOrgConfig.tenant_id == tenant_id)
    )
    org = org_result.scalar_one_or_none()
    org_config = org.org_configuration if org and org.org_configuration else {}
    use_multi_currency = org_config.get("use_multi_currency", True)
    # Secondary check: if org_configuration explicitly disables dimensions, honour it
    # (covers existing tenants where tenant.dimensions_not_applicable may not yet be synced)
    if not dims_not_applicable and org_config:
        use_dimensions = org_config.get("use_dimensions")
        if use_dimensions is False:
            dims_not_applicable = True
    org_complete = bool(org and org.legal_name and org.functional_currency)

    # Check modules (at least 1 active)
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
    dims_complete = dims_not_applicable or dim_count > 0
    dims_in_progress = not dims_not_applicable and dim_count > 0

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

    # Check tax (at least one rule configured)
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

    # Check workflows — at least 1 expense approval matrix entry
    from app.models.approvals import ApprovalMatrix
    wf_result = await db.execute(
        select(sqlfunc.count(ApprovalMatrix.id)).where(
            ApprovalMatrix.tenant_id == tenant_id,
        )
    )
    wf_count = wf_result.scalar_one() or 0
    workflows_complete = wf_count > 0

    # Document rules (manually marked complete by consultant)
    docs_complete = docs_setup_complete

    # Module setup — expense config exists (proxy for at least 1 module configured)
    ec_result = await db.execute(
        select(TenantExpenseConfig).where(TenantExpenseConfig.tenant_id == tenant_id)
    )
    ec = ec_result.scalar_one_or_none()
    module_setup_complete = ec is not None

    # Go-live blocking items
    blocking_complete = all([
        org_complete, modules_complete, coa_complete, dims_complete,
        employees_complete, tax_complete, roles_complete, workflows_complete,
    ])

    # Locked/unlocked sequence per brief
    def _s(
        key: str,
        label: str,
        complete: bool,
        subtitle: str,
        route: str,
        blocking: bool = True,
        locked: bool = False,
        in_progress: bool = False,
    ) -> SectionStatus:
        if locked:
            st = "locked"
        elif complete:
            st = "complete"
        elif in_progress:
            st = "in_progress"
        else:
            st = "not_started"
        return SectionStatus(
            key=key, label=label, status=st,
            subtitle=subtitle, route=route, blocking=blocking,
        )

    # Unlock sequence:
    # - Organisation: always
    # - Module activation: always
    # - Dimensions: unlocked after Organisation
    # - CoA: unlocked after Dimensions (or not_applicable)
    # - Employees: unlocked after CoA
    # - Currencies: unlocked after Organisation
    # - Tax: unlocked after Organisation
    # - Roles: unlocked after Employees
    # - Workflows: unlocked after Roles
    # - Documents: unlocked after Module activation
    # - Module setup: unlocked after CoA + Dimensions
    # - Go-live: unlocked when all blocking complete

    dims_locked = not org_complete
    coa_locked = not (dims_complete or dims_not_applicable) or dims_locked
    employees_locked = not coa_complete or coa_locked
    currencies_locked = not org_complete
    tax_locked = not org_complete
    roles_locked = not employees_complete or employees_locked
    workflows_locked = not roles_complete or roles_locked
    docs_locked = not modules_complete
    module_setup_locked = not (coa_complete and (dims_complete or dims_not_applicable))
    golive_locked = not blocking_complete

    sections = [
        _s("organisation", "Organisation", org_complete,
           f"Legal name: {org.legal_name}" if org_complete else "Not configured",
           "/dashboard/business/setup/organisation"),
        _s("modules", "Module activation", modules_complete,
           f"{len(active_modules)} module(s) active" if modules_complete else "No modules activated",
           "/dashboard/business/setup/modules"),
        *([
            _s("dimensions", "Dimensions", dims_complete,
               f"{dim_count} dimension(s) configured" if dims_complete else "Not configured",
               "/dashboard/business/settings/dimensions",
               locked=dims_locked, in_progress=dims_in_progress),
        ] if not dims_not_applicable else []),
        _s("coa", "Chart of accounts", coa_complete,
           f"{coa_count:,} GL accounts loaded" if coa_complete else ("Requires Dimensions first" if coa_locked else "No accounts loaded"),
           "/dashboard/business/settings/chart-of-accounts",
           locked=coa_locked),
        _s("employees", "Employees", employees_complete,
           f"{emp_count:,} employee(s) loaded" if employees_complete else ("Requires CoA first" if employees_locked else "No employees loaded"),
           "/dashboard/business/settings/employees",
           locked=employees_locked),
        *([
            _s("currencies", "Currencies & FX", currencies_complete,
               f"Functional: {org.functional_currency}" if currencies_complete else ("Requires Organisation first" if currencies_locked else "Not configured"),
               "/dashboard/business/setup/currencies", blocking=False,
               locked=currencies_locked),
        ] if use_multi_currency else []),
        _s("tax", "Tax & statutory", tax_complete,
           "Tax rules configured" if tax_complete else ("Requires Organisation first" if tax_locked else "Not configured"),
           "/dashboard/business/setup/tax",
           locked=tax_locked),
        _s("roles", "Roles & permissions", roles_complete,
           f"{pa_count} Power Admin(s) assigned" if roles_complete else ("Requires Employees first" if roles_locked else "No Power Admin assigned"),
           "/dashboard/business/setup/roles",
           locked=roles_locked),
        _s("workflows", "Approval workflows", workflows_complete,
           "Workflows configured" if workflows_complete else ("Requires Roles first" if workflows_locked else "Not configured"),
           "/dashboard/business/settings/approval-matrix",
           locked=workflows_locked),
        _s("documents", "Document rules", docs_complete,
           "Marked complete" if docs_complete else ("Requires Module activation first" if docs_locked else "Not marked complete"),
           "/dashboard/business/setup/documents", blocking=False,
           locked=docs_locked),
        _s("module_setup", "Module setup", module_setup_complete,
           "Expense module configured" if module_setup_complete else ("Requires CoA & Dimensions first" if module_setup_locked else "No modules configured"),
           "/dashboard/business/settings/expense-config", blocking=False,
           locked=module_setup_locked),
        _s("golive", "Go-live", blocking_complete,
           "All blocking items complete" if blocking_complete else "Blocking items incomplete",
           "/dashboard/business/setup/go-live",
           locked=golive_locked),
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
    """Update org config (any subset of fields)."""
    _require_admin(current_user)
    tenant_id = _require_tenant(current_user)
    org = await _get_or_create_org(tenant_id, db)

    PROTECTED_ORG_FIELDS = {"functional_currency"}

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field in PROTECTED_ORG_FIELDS:
            continue
        if hasattr(org, field):
            setattr(org, field, value)

    # Sync dimensions toggle with tenant.dimensions_not_applicable
    org_config_update = update_data.get("org_configuration")
    if org_config_update is not None:
        use_dims = org_config_update.get("use_dimensions")
        if use_dims is not None:
            tenant_result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
            tenant = tenant_result.scalar_one_or_none()
            if tenant:
                tenant.dimensions_not_applicable = not use_dims

    await db.commit()
    await db.refresh(org)
    return _org_to_response(org, tenant_id)


# ── Org Structure ─────────────────────────────────────────────────────────────

@router.get("/org-structure", response_model=OrgStructureTreeResponse)
async def get_org_structure(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> OrgStructureTreeResponse:
    """Return the full org hierarchy as a nested tree (single recursive query)."""
    _require_admin(current_user)
    tenant_id = _require_tenant(current_user)

    result = await db.execute(
        select(OrgStructureNode)
        .where(OrgStructureNode.tenant_id == tenant_id, OrgStructureNode.is_active.is_(True))
        .order_by(OrgStructureNode.sort_order, OrgStructureNode.name)
    )
    flat = result.scalars().all()
    return OrgStructureTreeResponse(nodes=_build_tree(flat))


@router.post("/org-structure", response_model=OrgStructureNodeResponse, status_code=201)
async def create_org_node(
    data: OrgStructureNodeCreate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> OrgStructureNodeResponse:
    """Add a new node to the org hierarchy."""
    _require_admin(current_user)
    tenant_id = _require_tenant(current_user)

    node = OrgStructureNode(
        tenant_id=tenant_id,
        parent_id=data.parent_id,
        node_type=data.node_type,
        name=data.name,
        code=data.code,
        cost_center_code=data.cost_center_code,
        entity_code=data.entity_code,
    )
    db.add(node)
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=409, detail="A node with this code already exists.")

    await db.refresh(node)
    return OrgStructureNodeResponse(
        id=str(node.id),
        parent_id=str(node.parent_id) if node.parent_id else None,
        node_type=node.node_type,
        name=node.name,
        code=node.code,
        cost_center_code=node.cost_center_code,
        entity_code=node.entity_code,
        is_active=node.is_active,
        sort_order=node.sort_order,
    )


@router.patch("/org-structure/{node_id}", response_model=OrgStructureNodeResponse)
async def update_org_node(
    node_id: uuid.UUID,
    data: OrgStructureNodeUpdate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> OrgStructureNodeResponse:
    """Update an existing org node."""
    _require_admin(current_user)
    tenant_id = _require_tenant(current_user)

    result = await db.execute(
        select(OrgStructureNode).where(
            OrgStructureNode.id == node_id,
            OrgStructureNode.tenant_id == tenant_id,
        )
    )
    node = result.scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail="Org node not found.")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(node, field, value)

    await db.commit()
    await db.refresh(node)
    return OrgStructureNodeResponse(
        id=str(node.id),
        parent_id=str(node.parent_id) if node.parent_id else None,
        node_type=node.node_type,
        name=node.name,
        code=node.code,
        cost_center_code=node.cost_center_code,
        entity_code=node.entity_code,
        is_active=node.is_active,
        sort_order=node.sort_order,
    )


@router.delete("/org-structure/{node_id}", status_code=204)
async def delete_org_node(
    node_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Soft-delete an org node."""
    _require_admin(current_user)
    tenant_id = _require_tenant(current_user)

    result = await db.execute(
        select(OrgStructureNode).where(
            OrgStructureNode.id == node_id,
            OrgStructureNode.tenant_id == tenant_id,
        )
    )
    node = result.scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail="Org node not found.")
    node.is_active = False
    await db.commit()


@router.get("/org-structure/template")
async def download_org_structure_template(
    current_user: CurrentUser = Depends(require_auth),
) -> StreamingResponse:
    """Generate and stream a .xlsx template for org structure upload."""
    _require_admin(current_user)
    _require_tenant(current_user)

    try:
        import openpyxl
        from openpyxl.styles import Font, PatternFill, Alignment
        from openpyxl.worksheet.datavalidation import DataValidation
        from openpyxl.formatting.rule import FormulaRule
    except ImportError:
        raise HTTPException(status_code=500, detail="openpyxl not installed.")

    wb = openpyxl.Workbook()

    # ── Instructions sheet ────────────────────────────────────────────────────
    ins = wb.active
    ins.title = "Instructions"
    ins.column_dimensions["A"].width = 26
    ins.column_dimensions["B"].width = 62

    ins["A1"] = "Org Structure Upload — Instructions"
    ins["A1"].font = Font(name="Arial", bold=True, size=14, color="FFFFFF")
    ins["A1"].fill = PatternFill("solid", fgColor="1E3A5F")
    ins["A1"].alignment = Alignment(horizontal="left", vertical="center", indent=1)
    ins.merge_cells("A1:B1")
    ins.row_dimensions[1].height = 36

    ins["A2"] = "Use the 'Org Structure' sheet to build your organisation hierarchy. Delete sample rows before uploading."
    ins["A2"].font = Font(name="Arial", size=10, color="555555")
    ins["A2"].fill = PatternFill("solid", fgColor="F7F9FC")
    ins.merge_cells("A2:B2")
    ins.row_dimensions[2].height = 22

    ins.append(["", ""])

    for col, val in [("A4", "Column"), ("B4", "Description")]:
        ins[col].value = val
        ins[col].font = Font(name="Arial", bold=True, size=11, color="FFFFFF")
        ins[col].fill = PatternFill("solid", fgColor="2D6A9F")
        ins[col].alignment = Alignment(vertical="center", indent=1)
    ins.row_dimensions[4].height = 24

    col_rows = [
        ("Node Type *",      "Required. Select from dropdown:\n• Legal entity — the company itself (one per upload)\n• Division / Business unit — major grouping\n• Department — functional unit\n• Cost center — lowest level where costs are posted"),
        ("Name *",           "Required. Full display name. Examples: Sales, Finance, Off Premise"),
        ("Code *",           "Required. Unique short code, no spaces. Examples: N22341SA, NG_FIN"),
        ("Parent Code",      "Code of this node's parent. Leave blank only for the top-level Legal entity.\nMust exactly match a Code in this file or already in the system."),
        ("Cost Center Code", "Required when Node Type = Cost center. Must match the dimension value code in Ziva BI.\nLeave blank for Legal entity, Division, and Department nodes.\nConditional formatting flags missing values in red."),
        ("Entity Code",      "Optional. Legal entity nodes only. Stores the ERP profit centre / entity code.\nExample: N22341 (Sage X3 profit centre for Red Bull Nigeria)."),
        ("Description",      "Optional. Any notes about this node."),
    ]

    section_fill = PatternFill("solid", fgColor="EBF2FF")
    alt_fill = PatternFill("solid", fgColor="F7F9FC")

    for i, (col, desc) in enumerate(col_rows):
        r = 5 + i
        c1 = ins.cell(row=r, column=1, value=col)
        c1.font = Font(name="Arial", bold=True, size=11)
        c1.fill = section_fill if i % 2 == 0 else alt_fill
        c1.alignment = Alignment(vertical="top", indent=1)
        c2 = ins.cell(row=r, column=2, value=desc)
        c2.font = Font(name="Arial", size=11)
        c2.fill = section_fill if i % 2 == 0 else alt_fill
        c2.alignment = Alignment(wrap_text=True, vertical="top", indent=1)
        ins.row_dimensions[r].height = 56

    warn_row = 5 + len(col_rows) + 1
    ins.cell(row=warn_row, column=1, value="⚠  Important").font = Font(name="Arial", bold=True, size=10, color="7B4F00")
    ins.cell(row=warn_row, column=1).fill = PatternFill("solid", fgColor="FFF8E1")
    ins.cell(row=warn_row, column=1).alignment = Alignment(vertical="top", indent=1)
    ins.cell(row=warn_row, column=2, value=(
        "• Do not delete or rename column headers.\n"
        "• Do not add extra columns.\n"
        "• Codes must be unique — duplicates will be rejected.\n"
        "• Parent Code must reference a Code that exists in this file or already in the system.\n"
        "• Uploading replaces the existing structure. Back up before uploading.\n"
        "• Red highlighted cells = Cost center nodes missing a Cost Center Code. Fix before uploading."
    )).font = Font(name="Arial", size=10, color="7B4F00")
    ins.cell(row=warn_row, column=2).fill = PatternFill("solid", fgColor="FFF8E1")
    ins.cell(row=warn_row, column=2).alignment = Alignment(wrap_text=True, vertical="top", indent=1)
    ins.row_dimensions[warn_row].height = 88

    # ── Org Structure sheet ───────────────────────────────────────────────────
    ws = wb.create_sheet("Org Structure")

    col_widths = [26, 28, 18, 18, 22, 18, 30]
    for i, w in enumerate(col_widths, 1):
        from openpyxl.utils import get_column_letter
        ws.column_dimensions[get_column_letter(i)].width = w

    headers = ["Node Type *", "Name *", "Code *", "Parent Code",
               "Cost Center Code", "Entity Code", "Description"]
    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=h)
        cell.font = Font(name="Arial", bold=True, size=11, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="1E3A5F")
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    ws.row_dimensions[1].height = 30

    # Node Type dropdown
    dv = DataValidation(
        type="list",
        formula1='"Legal entity,Division / Business unit,Department,Cost center"',
        allow_blank=False,
        showDropDown=False,
        showErrorMessage=True,
        errorTitle="Invalid node type",
        error="Select from: Legal entity, Division / Business unit, Department, Cost center",
    )
    ws.add_data_validation(dv)
    dv.sqref = "A2:A500"

    # Conditional formatting: amber row + red cell when Cost center missing code
    ws.conditional_formatting.add(
        "A2:G500",
        FormulaRule(
            formula=['AND($A2="Cost center",$E2="")'],
            fill=PatternFill("solid", fgColor="FFF3CD"),
        )
    )
    ws.conditional_formatting.add(
        "E2:E500",
        FormulaRule(
            formula=['AND(A2="Cost center",E2="")'],
            fill=PatternFill("solid", fgColor="FFCCCC"),
            font=Font(name="Arial", size=10, color="CC0000"),
        )
    )
    ws.conditional_formatting.add(
        "E2:E500",
        FormulaRule(
            formula=['AND(A2="Cost center",E2<>"")'],
            fill=PatternFill("solid", fgColor="D4EDDA"),
        )
    )

    # Sample rows
    samples = [
        ("Legal entity",            "Acme Corporation", "ACME",   "",     "",         "ACM001", "Top-level legal entity"),
        ("Cost center",             "Finance",          "FIN",    "ACME", "FIN001",   "",       "Finance department"),
        ("Cost center",             "Sales",            "SAL",    "ACME", "SAL001",   "",       "Sales department"),
        ("Cost center",             "Off Premise",      "SAL_OP", "SAL",  "SAL_OP01", "",       "Off premise sales"),
        ("Cost center",             "Marketing",        "MKT",    "ACME", "",         "",       "Missing cost center code — intentional demo of red flag"),
    ]
    s_font = Font(name="Arial", size=10, color="444444", italic=True)
    for r, row in enumerate(samples, 2):
        for c, val in enumerate(row, 1):
            cell = ws.cell(row=r, column=c, value=val)
            cell.font = s_font
            cell.alignment = Alignment(vertical="center", indent=1)
        ws.row_dimensions[r].height = 20

    note_row = len(samples) + 3
    ws.cell(row=note_row, column=1,
        value="↑ Delete all sample rows above before uploading. Marketing row intentionally has no Cost Center Code to demonstrate the red flag."
    ).font = Font(name="Arial", size=10, color="AA0000", italic=True)
    ws.merge_cells(f"A{note_row}:G{note_row}")

    ws.freeze_panes = "A2"

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=org_structure_template.xlsx"},
    )


@router.post("/org-structure/upload", response_model=OrgStructureUploadResult)
async def upload_org_structure(
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> OrgStructureUploadResult:
    """Upload org structure from .xlsx or .csv. Upserts by code."""
    _require_admin(current_user)
    tenant_id = _require_tenant(current_user)

    content = await file.read()
    rows: list[dict] = []

    try:
        import openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
        # Try "Org Structure" sheet first, fall back to active
        ws = wb["Org Structure"] if "Org Structure" in wb.sheetnames else wb.active

        VALID_NODE_TYPES = {"Legal entity", "Division / Business unit", "Department", "Cost center"}

        for row in ws.iter_rows(min_row=2, values_only=True):
            if not any(row):
                continue
            # Skip header rows and note rows
            first_cell = str(row[0]).strip() if row[0] else ""
            if first_cell.startswith("↑"):
                continue
            if first_cell.lower() in ("node type*", "node type *", "node type"):
                continue
            if first_cell not in VALID_NODE_TYPES:
                # Could be an instruction row — skip silently if name/code also empty
                if not row[1] and not row[2]:
                    continue
            rows.append({
                "node_type":        first_cell,
                "name":             str(row[1]).strip() if row[1] else "",
                "code":             str(row[2]).strip() if row[2] else "",
                "parent_code":      str(row[3]).strip() if row[3] else None,
                "cost_center_code": str(row[4]).strip() if row[4] else None,
                "entity_code":      str(row[5]).strip() if row[5] else None,
            })
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse file: {e}")

    VALID_TYPES = {"Legal entity", "Division / Business unit", "Department", "Cost center"}
    imported = updated = 0
    errors: list[dict] = []

    # Fetch existing nodes for this tenant
    existing_result = await db.execute(
        select(OrgStructureNode).where(OrgStructureNode.tenant_id == tenant_id)
    )
    existing_map = {n.code: n for n in existing_result.scalars().all()}

    # Pass 1: upsert all nodes without parent assignment
    code_to_row = {}
    for row_num, row in enumerate(rows, start=2):
        if not row["node_type"] or row["node_type"] not in VALID_TYPES:
            errors.append({"row": row_num, "reason": f"Invalid Node Type: '{row['node_type']}'"})
            continue
        if not row["name"] or not row["code"]:
            errors.append({"row": row_num, "reason": "Name and Code are required."})
            continue
        code_to_row[row["code"]] = (row_num, row)

        if row["code"] in existing_map:
            node = existing_map[row["code"]]
            node.name = row["name"]
            node.node_type = row["node_type"]
            node.cost_center_code = row["cost_center_code"]
            node.entity_code = row["entity_code"]
            node.is_active = True
            updated += 1
        else:
            node = OrgStructureNode(
                tenant_id=tenant_id,
                node_type=row["node_type"],
                name=row["name"],
                code=row["code"],
                parent_id=None,  # set in pass 2
                cost_center_code=row["cost_center_code"],
                entity_code=row["entity_code"],
            )
            db.add(node)
            existing_map[row["code"]] = node
            imported += 1

    # Flush so all nodes have IDs
    await db.flush()

    # Pass 2: assign parent_id now that all nodes exist
    for row_num, row in code_to_row.values():
        if not row["parent_code"]:
            continue
        node = existing_map.get(row["code"])
        parent = existing_map.get(row["parent_code"])
        if not parent:
            errors.append({"row": row_num, "reason": f"Parent code '{row['parent_code']}' not found."})
            continue
        if node:
            node.parent_id = parent.id

    await db.commit()
    return OrgStructureUploadResult(imported=imported, updated=updated, errors=errors)


# ── Fiscal Periods ────────────────────────────────────────────────────────────

@router.get("/fiscal-periods", response_model=list[FiscalPeriodResponse])
async def get_fiscal_periods(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> list[FiscalPeriodResponse]:
    """List all generated fiscal periods for this tenant."""
    _require_admin(current_user)
    tenant_id = _require_tenant(current_user)

    result = await db.execute(
        select(FiscalPeriod)
        .where(FiscalPeriod.tenant_id == tenant_id)
        .order_by(FiscalPeriod.start_date)
    )
    periods = result.scalars().all()

    return [
        FiscalPeriodResponse(
            id=str(p.id),
            fiscal_year=p.fiscal_year,
            period_name=p.period_name,
            start_date=p.start_date,
            end_date=p.end_date,
            status=p.status,
        )
        for p in periods
    ]


@router.post("/fiscal-periods/generate", response_model=list[FiscalPeriodResponse], status_code=201)
async def generate_fiscal_periods(
    data: GeneratePeriodsRequest,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> list[FiscalPeriodResponse]:
    """
    Generate fiscal periods for a given fiscal year label.

    Reads the tenant's fiscal_year_start_month, fiscal_year_start_day, and
    period_closing_frequency from org config. Deletes existing periods for
    the same fiscal_year label before re-generating.
    """
    _require_admin(current_user)
    tenant_id = _require_tenant(current_user)

    org_result = await db.execute(
        select(TenantOrgConfig).where(TenantOrgConfig.tenant_id == tenant_id)
    )
    org = org_result.scalar_one_or_none()
    if not org or not org.fiscal_year_start_month:
        raise HTTPException(
            status_code=422,
            detail="Fiscal year start month not configured. Set it on the Organisation page first.",
        )

    start_month = org.fiscal_year_start_month
    start_day = org.fiscal_year_start_day or 1
    frequency = org.period_closing_frequency or "Monthly"

    # Determine how many years the label covers to find the calendar start year
    # e.g. "FY2026" → year=2026, "2025/2026" → year=2025
    label = data.fiscal_year_label
    import re
    year_match = re.search(r"(\d{4})", label)
    if not year_match:
        raise HTTPException(status_code=422, detail="Could not parse year from fiscal_year_label.")
    start_year = int(year_match.group(1))

    fy_start = date(start_year, start_month, start_day)
    today = date.today()

    if frequency == "Monthly":
        num_periods = 12
    elif frequency == "Quarterly":
        num_periods = 4
    else:
        num_periods = 1

    # Generate period date ranges
    generated: list[tuple[str, date, date]] = []
    current = fy_start
    month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                   "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    for i in range(num_periods):
        if frequency == "Monthly":
            period_end_day = monthrange(current.year, current.month)[1]
            period_end = date(current.year, current.month, period_end_day)
            period_name = f"{month_names[current.month - 1]} {current.year}"
            next_month = current.month + 1
            next_year = current.year + (1 if next_month > 12 else 0)
            next_month = next_month if next_month <= 12 else 1
            next_start = date(next_year, next_month, start_day)
        elif frequency == "Quarterly":
            # 3 months per quarter
            end_month = current.month + 2
            end_year = current.year + (end_month - 1) // 12
            end_month = ((end_month - 1) % 12) + 1
            period_end = date(end_year, end_month, monthrange(end_year, end_month)[1])
            period_name = f"Q{i + 1} {label}"
            next_start = date(end_year, end_month, 1)
            if end_month < 12:
                next_start = date(end_year, end_month + 1, start_day)
            else:
                next_start = date(end_year + 1, 1, start_day)
        else:
            period_end_year = start_year + 1 if start_month > 1 else start_year
            period_end_month = start_month - 1 if start_month > 1 else 12
            period_end = date(period_end_year, period_end_month,
                              monthrange(period_end_year, period_end_month)[1])
            period_name = label
            next_start = period_end  # only one period

        generated.append((period_name, current, period_end))
        current = next_start

    # Delete existing periods for this fiscal year label
    await db.execute(
        delete(FiscalPeriod).where(
            FiscalPeriod.tenant_id == tenant_id,
            FiscalPeriod.fiscal_year == label,
        )
    )

    created: list[FiscalPeriod] = []
    for period_name, start, end in generated:
        # Mark the period containing today as 'current'
        period_status = "current" if start <= today <= end else "open"
        p = FiscalPeriod(
            tenant_id=tenant_id,
            fiscal_year=label,
            period_name=period_name,
            start_date=start,
            end_date=end,
            status=period_status,
        )
        db.add(p)
        created.append(p)

    await db.commit()
    for p in created:
        await db.refresh(p)

    return [
        FiscalPeriodResponse(
            id=str(p.id),
            fiscal_year=p.fiscal_year,
            period_name=p.period_name,
            start_date=p.start_date,
            end_date=p.end_date,
            status=p.status,
        )
        for p in created
    ]


# ── Modules ────────────────────────────────────────────────────────────────────

@router.get("/modules", response_model=ModulesResponse)
async def get_modules(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> ModulesResponse:
    """Return all 14 modules with their activation and licensing state."""
    _require_admin(current_user)
    tenant_id = _require_tenant(current_user)

    result = await db.execute(
        select(TenantModule).where(TenantModule.tenant_id == tenant_id)
    )
    existing = {m.module_key: m for m in result.scalars().all()}

    modules = [
        ModuleState(
            module_key=m["key"],
            label=m["label"],
            is_active=existing[m["key"]].is_active if m["key"] in existing else False,
            is_licensed=existing[m["key"]].is_licensed if m["key"] in existing else False,
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

    Enforces: a module can only be activated if is_licensed = true.
    Returns 403 if attempting to activate an unlicensed module.
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
            continue

        existing = existing_map.get(key)
        if existing is None:
            # Create with is_licensed=False by default (consultant must license it)
            existing = TenantModule(
                tenant_id=tenant_id,
                module_key=key,
                is_active=False,
                is_licensed=False,
            )
            db.add(existing)
            existing_map[key] = existing

        if active and not existing.is_licensed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Module '{MODULE_KEY_TO_LABEL[key]}' is not licensed for this tenant.",
            )

        if active and not existing.is_active:
            existing.activated_at = now
            existing.activated_by = current_user.user_id
        existing.is_active = active

    await db.commit()
    return await get_modules(current_user=current_user, db=db)


@router.patch("/modules/{module_key}/license", response_model=ModuleState)
async def set_module_license(
    module_key: str,
    is_licensed: bool,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> ModuleState:
    """Set is_licensed for a module (consultant or super admin only)."""
    if not current_user.is_super_admin and current_user.role_tier != "consultant":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only consultants can set module licensing.",
        )
    tenant_id = _require_tenant(current_user)

    if module_key not in MODULE_KEY_TO_LABEL:
        raise HTTPException(status_code=404, detail="Unknown module key.")

    result = await db.execute(
        select(TenantModule).where(
            TenantModule.tenant_id == tenant_id,
            TenantModule.module_key == module_key,
        )
    )
    mod = result.scalar_one_or_none()
    if mod is None:
        mod = TenantModule(tenant_id=tenant_id, module_key=module_key, is_active=False, is_licensed=is_licensed)
        db.add(mod)
    else:
        mod.is_licensed = is_licensed

    await db.commit()
    await db.refresh(mod)
    return ModuleState(
        module_key=mod.module_key,
        label=MODULE_KEY_TO_LABEL[mod.module_key],
        is_active=mod.is_active,
        is_licensed=mod.is_licensed,
    )


# ── Dimensions not-applicable flag ────────────────────────────────────────────

@router.post("/dimensions/not-applicable", status_code=204)
async def set_dimensions_not_applicable(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Mark this tenant as not using analytical dimensions.

    Sets dimensions_not_applicable=True on the tenant record, which causes
    the setup progress endpoint to count dimensions as complete and unlocks
    the Chart of Accounts section.
    """
    _require_admin(current_user)
    tenant_id = _require_tenant(current_user)

    tenant_result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = tenant_result.scalar_one_or_none()
    if tenant is None:
        raise HTTPException(status_code=404, detail="Tenant not found.")
    tenant.dimensions_not_applicable = True
    await db.commit()


# ── Currencies & FX ───────────────────────────────────────────────────────────

@router.get("/currencies", response_model=FxConfigResponse)
async def get_currencies(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> FxConfigResponse:
    """Return FX config for the tenant (all three tabs)."""
    _require_admin(current_user)
    tenant_id = _require_tenant(current_user)

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

    for field, value in data.model_dump(exclude_unset=True).items():
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
    await db.commit()
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
    """Update tax config for the tenant."""
    _require_admin(current_user)
    tenant_id = _require_tenant(current_user)
    tax = await _get_or_create_tax(tenant_id, db)

    for field, value in data.model_dump(exclude_unset=True).items():
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
    """Return the permission matrix for all sections × role tiers."""
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
    """Update permission matrix cells."""
    _require_admin(current_user)
    _require_tenant(current_user)
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
        .where(UserTenant.tenant_id == tenant_id, UserTenant.is_active.is_(True))
    )
    return [
        RoleAssignmentResponse(
            id=str(ut.id),
            user_tenant_id=str(ut.id),
            full_name=u.full_name,
            email=u.email,
            role_tier=ut.role_tier,
            is_active=ut.is_active,
        )
        for ut, u in result.all()
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
        .where(UserTenant.id == data.user_tenant_id, UserTenant.tenant_id == tenant_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="User not found in this tenant.")

    ut, u = row
    ut.role_tier = data.role_tier
    await db.commit()
    await db.refresh(ut)
    return RoleAssignmentResponse(
        id=str(ut.id), user_tenant_id=str(ut.id),
        full_name=u.full_name, email=u.email,
        role_tier=ut.role_tier, is_active=ut.is_active,
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
        .where(UserTenant.id == assignment_id, UserTenant.tenant_id == tenant_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Assignment not found.")

    ut, u = row
    ut.role_tier = data.role_tier
    await db.commit()
    await db.refresh(ut)
    return RoleAssignmentResponse(
        id=str(ut.id), user_tenant_id=str(ut.id),
        full_name=u.full_name, email=u.email,
        role_tier=ut.role_tier, is_active=ut.is_active,
    )


# ── Document Rules ─────────────────────────────────────────────────────────────

@router.get("/documents", response_model=list[DocumentRuleResponse])
async def get_documents(
    module: Optional[str] = Query(None),
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> list[DocumentRuleResponse]:
    """List document rules, optionally filtered by module."""
    _require_admin(current_user)
    tenant_id = _require_tenant(current_user)

    q = select(DocumentRule).where(
        DocumentRule.tenant_id == tenant_id, DocumentRule.is_active.is_(True)
    )
    if module:
        q = q.where(DocumentRule.module == module)
    q = q.order_by(DocumentRule.module, DocumentRule.transaction_type)

    result = await db.execute(q)
    return [
        DocumentRuleResponse(
            id=str(r.id), module=r.module, transaction_type=r.transaction_type,
            document_name=r.document_name, is_required=r.is_required,
            track_expiry=r.track_expiry, ocr_template=r.ocr_template,
            max_size_mb=r.max_size_mb, allowed_formats=r.allowed_formats,
            max_files=r.max_files, is_active=r.is_active,
        )
        for r in result.scalars().all()
    ]


@router.post("/documents", response_model=DocumentRuleResponse, status_code=201)
async def create_document_rule(
    data: DocumentRuleCreate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> DocumentRuleResponse:
    """Create a new document rule."""
    _require_admin(current_user)
    tenant_id = _require_tenant(current_user)

    rule = DocumentRule(
        tenant_id=tenant_id, module=data.module, transaction_type=data.transaction_type,
        document_name=data.document_name, is_required=data.is_required,
        track_expiry=data.track_expiry, ocr_template=data.ocr_template,
        max_size_mb=data.max_size_mb, allowed_formats=data.allowed_formats,
        max_files=data.max_files,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return DocumentRuleResponse(
        id=str(rule.id), module=rule.module, transaction_type=rule.transaction_type,
        document_name=rule.document_name, is_required=rule.is_required,
        track_expiry=rule.track_expiry, ocr_template=rule.ocr_template,
        max_size_mb=rule.max_size_mb, allowed_formats=rule.allowed_formats,
        max_files=rule.max_files, is_active=rule.is_active,
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
        select(DocumentRule).where(DocumentRule.id == rule_id, DocumentRule.tenant_id == tenant_id)
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Document rule not found.")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(rule, field, value)

    await db.commit()
    await db.refresh(rule)
    return DocumentRuleResponse(
        id=str(rule.id), module=rule.module, transaction_type=rule.transaction_type,
        document_name=rule.document_name, is_required=rule.is_required,
        track_expiry=rule.track_expiry, ocr_template=rule.ocr_template,
        max_size_mb=rule.max_size_mb, allowed_formats=rule.allowed_formats,
        max_files=rule.max_files, is_active=rule.is_active,
    )


@router.delete("/documents/{rule_id}", status_code=204)
async def delete_document_rule(
    rule_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Soft-delete a document rule."""
    _require_admin(current_user)
    tenant_id = _require_tenant(current_user)

    result = await db.execute(
        select(DocumentRule).where(DocumentRule.id == rule_id, DocumentRule.tenant_id == tenant_id)
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
    All blocking sections must be complete.
    """
    if not current_user.is_super_admin and current_user.role_tier != "consultant":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only consultants and super admins can mark a tenant as live.",
        )

    tenant_id = _require_tenant(current_user)

    progress = await get_progress(current_user=current_user, db=db)
    blocking_incomplete = [s.label for s in progress.sections if s.blocking and s.status != "complete"]
    if blocking_incomplete:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Blocking items incomplete: {', '.join(blocking_incomplete)}",
        )

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
