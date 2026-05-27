"""
ZivaBI — M8.2 Implementation Portal Pydantic schemas.

Request and response shapes for all /api/setup/* endpoints.
Covers: progress, organisation, org structure, fiscal periods, modules,
currencies/FX, tax, roles, documents, go-live, employee self-onboarding.
"""

import uuid
from datetime import date
from typing import Any, Optional

from pydantic import BaseModel


# ── Progress / Dashboard ──────────────────────────────────────────────────────

class SectionStatus(BaseModel):
    """A single setup checklist card on the setup dashboard."""

    key: str
    label: str
    status: str  # 'complete' | 'in_progress' | 'not_started' | 'locked'
    subtitle: str
    route: str
    blocking: bool


class ProgressResponse(BaseModel):
    """GET /api/setup/progress — setup dashboard completion state."""

    sections: list[SectionStatus]
    total: int
    completed: int
    percentage: int


# ── Organisation Identity ──────────────────────────────────────────────────────

class OrgIdentityUpdate(BaseModel):
    """PATCH /api/setup/org — identity tab fields (all sections)."""

    # Legal & registration
    legal_name: Optional[str] = None
    rc_number: Optional[str] = None
    date_of_registration: Optional[date] = None
    commencement_date: Optional[date] = None
    company_type: Optional[str] = None
    industry: Optional[str] = None
    tin: Optional[str] = None
    vat_reg_number: Optional[str] = None
    # Contact & address
    country: Optional[str] = None
    registered_address: Optional[str] = None
    operating_address: Optional[str] = None
    company_phone: Optional[str] = None
    company_email: Optional[str] = None
    website: Optional[str] = None
    external_auditor: Optional[str] = None
    # Group & currency
    group_structure: Optional[str] = None
    parent_company_name: Optional[str] = None
    reporting_currency: Optional[str] = None
    authorised_share_capital: Optional[float] = None
    # Configuration tab
    org_configuration: Optional[dict] = None


class FiscalYearUpdate(BaseModel):
    """Fiscal year tab fields."""

    fiscal_year_start_month: Optional[int] = None
    fiscal_year_start_day: Optional[int] = None
    fiscal_year_name_format: Optional[str] = None
    period_closing_frequency: Optional[str] = None


class OrgStructureUpdate(BaseModel):
    """Structure tab — stored via the org_structure endpoints, not JSONB."""

    pass  # kept for backward-compat with PATCH /org


class BrandingUpdate(BaseModel):
    """Branding tab fields."""

    branding: Optional[dict] = None  # { logo_url, primary_colour, button_style }


class OrgConfigResponse(BaseModel):
    """Full org config response — covers all four identity tabs."""

    tenant_id: str
    # Legal & registration
    legal_name: Optional[str] = None
    rc_number: Optional[str] = None
    date_of_registration: Optional[date] = None
    commencement_date: Optional[date] = None
    company_type: Optional[str] = None
    industry: Optional[str] = None
    tin: Optional[str] = None
    vat_reg_number: Optional[str] = None
    # Contact & address
    country: Optional[str] = None
    registered_address: Optional[str] = None
    operating_address: Optional[str] = None
    company_phone: Optional[str] = None
    company_email: Optional[str] = None
    website: Optional[str] = None
    external_auditor: Optional[str] = None
    # Group & currency
    group_structure: Optional[str] = None
    parent_company_name: Optional[str] = None
    functional_currency: Optional[str] = None
    reporting_currency: Optional[str] = None
    authorised_share_capital: Optional[float] = None
    # Fiscal year
    fiscal_year_start_month: Optional[int] = None
    fiscal_year_start_day: Optional[int] = None
    fiscal_year_name_format: Optional[str] = None
    period_closing_frequency: Optional[str] = None
    # Branding
    branding: Optional[dict] = None
    # Configuration tab
    org_configuration: Optional[dict] = None


# ── Org Structure ─────────────────────────────────────────────────────────────

class OrgStructureNodeCreate(BaseModel):
    """POST /api/setup/org-structure — add a node."""

    node_type: str  # 'legal_entity' | 'division' | 'department' | 'cost_center'
    name: str
    code: str
    parent_id: Optional[uuid.UUID] = None
    cost_center_code: Optional[str] = None
    entity_code: Optional[str] = None


class OrgStructureNodeUpdate(BaseModel):
    """PATCH /api/setup/org-structure/{id}."""

    name: Optional[str] = None
    node_type: Optional[str] = None
    parent_id: Optional[uuid.UUID] = None
    cost_center_code: Optional[str] = None
    entity_code: Optional[str] = None
    sort_order: Optional[int] = None


class OrgStructureNodeResponse(BaseModel):
    """Single org structure node."""

    id: str
    parent_id: Optional[str] = None
    node_type: str
    name: str
    code: str
    cost_center_code: Optional[str] = None
    entity_code: Optional[str] = None
    is_active: bool
    sort_order: int
    children: list["OrgStructureNodeResponse"] = []


OrgStructureNodeResponse.model_rebuild()


class OrgStructureTreeResponse(BaseModel):
    """GET /api/setup/org-structure — full tree."""

    nodes: list[OrgStructureNodeResponse]


class OrgStructureUploadResult(BaseModel):
    """POST /api/setup/org-structure/upload — import result."""

    imported: int
    updated: int
    errors: list[dict[str, Any]]


# ── Fiscal Periods ────────────────────────────────────────────────────────────

class FiscalPeriodResponse(BaseModel):
    """Single fiscal period row."""

    id: str
    fiscal_year: str
    period_name: str
    start_date: date
    end_date: date
    status: str  # 'open' | 'current' | 'closed'


class GeneratePeriodsRequest(BaseModel):
    """POST /api/setup/fiscal-periods/generate."""

    fiscal_year_label: str  # e.g. "FY2026" or "2025/2026"


# ── Modules ───────────────────────────────────────────────────────────────────

class ModuleState(BaseModel):
    """Single module activation state."""

    module_key: str
    label: str
    is_active: bool
    is_licensed: bool = False


class ModulesResponse(BaseModel):
    """GET /api/setup/modules."""

    modules: list[ModuleState]


class ModulesUpdate(BaseModel):
    """PATCH /api/setup/modules — map of module_key → is_active."""

    modules: dict[str, bool]


# ── Currencies & FX ───────────────────────────────────────────────────────────

class FxConfigUpdate(BaseModel):
    """PATCH /api/setup/currencies or sub-tabs."""

    reporting_currency: Optional[str] = None
    additional_currencies: Optional[list[dict[str, Any]]] = None
    fx_rates: Optional[list[dict[str, Any]]] = None
    revaluation_rules: Optional[dict[str, Any]] = None


class FxConfigResponse(BaseModel):
    """GET /api/setup/currencies."""

    functional_currency: Optional[str] = None
    reporting_currency: Optional[str] = None
    additional_currencies: Optional[list[dict[str, Any]]] = None
    fx_rates: Optional[list[dict[str, Any]]] = None
    revaluation_rules: Optional[dict[str, Any]] = None


# ── Tax & Statutory ───────────────────────────────────────────────────────────

class TaxConfigUpdate(BaseModel):
    """PATCH /api/setup/tax."""

    vat_config: Optional[dict[str, Any]] = None
    wht_config: Optional[dict[str, Any]] = None
    paye_config: Optional[dict[str, Any]] = None
    other_statutory: Optional[dict[str, Any]] = None


class TaxConfigResponse(BaseModel):
    """GET /api/setup/tax."""

    vat_config: Optional[dict[str, Any]] = None
    wht_config: Optional[dict[str, Any]] = None
    paye_config: Optional[dict[str, Any]] = None
    other_statutory: Optional[dict[str, Any]] = None


# ── Roles & Permissions ───────────────────────────────────────────────────────

class PermissionMatrixCell(BaseModel):
    """One cell in the permission matrix."""

    section: str
    role_tier: str
    access_level: str  # 'full' | 'read_only' | 'none' | 'delegatable'


class PermissionMatrixUpdate(BaseModel):
    """PATCH /api/setup/roles/matrix."""

    cells: list[PermissionMatrixCell]


class PermissionMatrixResponse(BaseModel):
    """GET /api/setup/roles/matrix."""

    cells: list[PermissionMatrixCell]


class RoleAssignmentCreate(BaseModel):
    """POST /api/setup/roles/assignments."""

    user_tenant_id: uuid.UUID
    role_tier: str  # 'power_admin' | 'functional_admin'


class RoleAssignmentUpdate(BaseModel):
    """PATCH /api/setup/roles/assignments/{id}."""

    role_tier: str


class RoleAssignmentResponse(BaseModel):
    """Single role assignment row."""

    id: str
    user_tenant_id: str
    full_name: str
    email: str
    role_tier: Optional[str]
    is_active: bool


# ── Document Rules ────────────────────────────────────────────────────────────

class DocumentRuleCreate(BaseModel):
    """POST /api/setup/documents."""

    module: str
    transaction_type: str
    document_name: str
    is_required: bool = True
    track_expiry: bool = False
    ocr_template: Optional[str] = None
    max_size_mb: int = 10
    allowed_formats: Optional[list[str]] = None
    max_files: int = 0


class DocumentRuleUpdate(BaseModel):
    """PATCH /api/setup/documents/{id}."""

    transaction_type: Optional[str] = None
    document_name: Optional[str] = None
    is_required: Optional[bool] = None
    track_expiry: Optional[bool] = None
    ocr_template: Optional[str] = None
    max_size_mb: Optional[int] = None
    allowed_formats: Optional[list[str]] = None
    max_files: Optional[int] = None
    is_active: Optional[bool] = None


class DocumentRuleResponse(BaseModel):
    """Single document rule row."""

    id: str
    module: str
    transaction_type: str
    document_name: str
    is_required: bool
    track_expiry: bool
    ocr_template: Optional[str]
    max_size_mb: int
    allowed_formats: Optional[list[str]]
    max_files: int
    is_active: bool


# ── Employee Self-onboarding ──────────────────────────────────────────────────

class EmployeeInviteCreate(BaseModel):
    """POST /api/hr/employees/invite — HR sends a self-onboarding invite."""

    first_name: str
    last_name: str
    email: str
    cost_center_id: Optional[uuid.UUID] = None
    start_date: Optional[date] = None


class SelfOnboardingSubmit(BaseModel):
    """POST /onboard/{token} — new hire submits their details."""

    other_name: Optional[str] = None
    preferred_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    residential_address: Optional[str] = None
    nin: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_relationship: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_account_name: Optional[str] = None
    bvn: Optional[str] = None


class SelfOnboardingTokenResponse(BaseModel):
    """GET /onboard/{token} — public token validation."""

    employee_id: str
    first_name: str
    last_name: str
    email: str
    tenant_name: str
    expires_at: str


# ── Go-live ────────────────────────────────────────────────────────────────────

class GoLiveResponse(BaseModel):
    """POST /api/setup/go-live response."""

    message: str
    tenant_id: str
