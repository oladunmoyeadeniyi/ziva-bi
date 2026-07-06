"""
ZivaBI — M8.2/M8.3 Implementation Portal Pydantic schemas.

Request and response shapes for all /api/setup/* endpoints.
Covers: progress, organisation, org structure, accounting periods, modules,
currencies/FX, tax, roles, documents, go-live, employee self-onboarding.
"""

import uuid
from datetime import date, datetime
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
    lifecycle_status: str = "in_implementation"


# ── Organisation Identity ──────────────────────────────────────────────────────

class OrgIdentityUpdate(BaseModel):
    """PATCH /api/setup/org — identity tab fields (all sections)."""

    # Legal & registration
    legal_name: Optional[str] = None
    rc_number: Optional[str] = None
    date_of_registration: Optional[date] = None
    commencement_date: Optional[date] = None
    first_fiscal_year_end: Optional[date] = None
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

    first_fiscal_year_end: Optional[date] = None
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
    first_fiscal_year_end: Optional[date] = None
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


# ── Accounting Periods (M8.3 Brief 1 — replaces FiscalPeriod schemas) ─────────

class AccountingPeriodResponse(BaseModel):
    """Single accounting period row returned by /api/setup/periods endpoints."""

    id: str
    tenant_id: str
    fiscal_year: str
    period_no: int
    period_name: str
    start_date: date
    end_date: date
    # Status: FUTURE | OPEN | SOFT_CLOSED | OVERDUE | HARD_CLOSED
    status: str
    hard_closed_at: Optional[datetime] = None
    hard_closed_by: Optional[str] = None
    soft_closed_at: Optional[datetime] = None
    grace_expires_at: Optional[datetime] = None
    reopened_count: int = 0


class GeneratePeriodsRequest(BaseModel):
    """POST /api/setup/periods/generate."""

    fiscal_year_label: str  # e.g. "FY2026" or "2025/2026"


class PeriodCheckResponse(BaseModel):
    """GET /api/setup/periods/check?date=YYYY-MM-DD."""

    postable: bool
    reason: str


# ── Grace overrides (M8.3 Brief 2) ───────────────────────────────────────────

class PeriodGraceOverrideResponse(BaseModel):
    """Single grace override row."""

    id: str
    tenant_id: str
    module: str
    applies_to_type: str
    applies_to_role: Optional[str] = None
    applies_to_user_id: Optional[str] = None
    applies_to_user_name: Optional[str] = None  # resolved from users table
    period_type: str
    grace_value: int
    grace_unit: str
    is_default: bool
    created_at: datetime


class PeriodGraceOverrideCreate(BaseModel):
    """POST /api/setup/periods/grace."""

    module: str
    applies_to_type: str
    applies_to_role: Optional[str] = None
    applies_to_user_id: Optional[str] = None
    period_type: str
    grace_value: int
    grace_unit: str


class PeriodGraceOverrideUpdate(BaseModel):
    """PATCH /api/setup/periods/grace/{id}.

    Only grace_value and grace_unit are editable on the default row.
    All fields editable on non-default rows.
    """

    grace_value: Optional[int] = None
    grace_unit: Optional[str] = None
    # Non-default rows only:
    module: Optional[str] = None
    applies_to_type: Optional[str] = None
    applies_to_role: Optional[str] = None
    applies_to_user_id: Optional[str] = None
    period_type: Optional[str] = None


# ── Manual-journal block (M8.3 Brief 2) ──────────────────────────────────────

class JournalBlockUpdate(BaseModel):
    """PATCH /api/setup/periods/journal-block."""

    enabled: bool


class JournalBlockResponse(BaseModel):
    """Response for GET/PATCH /api/setup/periods/journal-block."""

    enabled: bool


# ── Future-dated posting exception (M8.3 Brief 2) ────────────────────────────

class FuturePostingExceptionCreate(BaseModel):
    """POST /api/setup/periods/future-exception."""

    target_date: date
    module: str
    reason: str


class FuturePostingExceptionResponse(BaseModel):
    """Returned by POST /api/setup/periods/future-exception."""

    id: str
    tenant_id: str
    created_by: str
    target_date: date
    module: str
    reason: str
    created_at: datetime


# ── Close checklist (M8.3 Brief 3) ──────────────────────────────────────────

class CloseChecklistItemCreate(BaseModel):
    """POST /api/setup/periods/checklist — add a template item."""

    label: str
    description: Optional[str] = None
    applies_to: str  # "every_close" | "year_end_only"
    sort_order: int = 0


class CloseChecklistItemUpdate(BaseModel):
    """PATCH /api/setup/periods/checklist/{id}."""

    label: Optional[str] = None
    description: Optional[str] = None
    applies_to: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class CloseChecklistItemResponse(BaseModel):
    """Single close checklist template item."""

    id: str
    tenant_id: str
    label: str
    description: Optional[str] = None
    applies_to: str
    sort_order: int
    is_active: bool
    created_at: datetime


class PeriodChecklistEntryResponse(BaseModel):
    """One row returned by GET /api/setup/periods/{period_id}/checklist.

    Combines the checklist item template fields with the current per-period
    completion state (status, who prepared/approved, and when).
    """

    checklist_item_id: str
    label: str
    description: Optional[str] = None
    applies_to: str
    sort_order: int
    # Completion state — None when no completion row exists yet (still "pending").
    completion_id: Optional[str] = None
    status: str  # "pending" | "prepared" | "approved"
    prepared_by: Optional[str] = None
    prepared_at: Optional[datetime] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None


class PeriodChecklistCompletionResponse(BaseModel):
    """Returned by prepare/approve endpoints."""

    id: str
    period_id: str
    checklist_item_id: str
    item_label_snapshot: str
    status: str
    prepared_by: Optional[str] = None
    prepared_at: Optional[datetime] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    created_at: datetime


# ── Year-end two-stage close + audit log (M8.3 Brief 4) ─────────────────────

class ReopenRequest(BaseModel):
    """Optional body for POST /api/setup/periods/{id}/reopen — reason for audit trail."""

    reason: Optional[str] = None


class FiscalYearStateResponse(BaseModel):
    """Returned by year-state GET/PATCH and management/statutory-close POST."""

    id: Optional[str] = None
    tenant_id: str
    fiscal_year: str
    status: str  # OPEN | AUDIT_PENDING | AUDIT_OVERDUE | STATUTORY_CLOSED
    management_closed_at: Optional[datetime] = None
    management_closed_by: Optional[str] = None
    audit_grace_months: int
    audit_grace_expires_at: Optional[datetime] = None
    statutory_closed_at: Optional[datetime] = None
    statutory_closed_by: Optional[str] = None
    retained_earnings_rolled: bool = False
    created_at: Optional[datetime] = None


class ManagementCloseRequest(BaseModel):
    """POST /api/setup/periods/management-close."""

    fiscal_year_label: str


class StatutoryCloseRequest(BaseModel):
    """POST /api/setup/periods/statutory-close."""

    fiscal_year_label: str


class AuditGraceUpdate(BaseModel):
    """PATCH /api/setup/periods/year-state/{fiscal_year} — update per-year grace window."""

    audit_grace_months: int


class PeriodAuditLogResponse(BaseModel):
    """Single period audit log entry."""

    id: str
    tenant_id: str
    fiscal_year: Optional[str] = None
    period_id: Optional[str] = None
    action: str
    actor_id: str
    detail: Optional[str] = None
    created_at: datetime


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
    """PATCH /api/setup/currencies.

    enabled_currencies and reporting_currency are written to tenant_org_config
    (the single source of truth for currency identity).
    fx_rates and revaluation_rules are written to tenant_fx_config.
    """

    enabled_currencies: Optional[list[str]] = None
    reporting_currency: Optional[str] = None
    fx_rates: Optional[list[dict[str, Any]]] = None
    revaluation_rules: Optional[dict[str, Any]] = None


class FxConfigResponse(BaseModel):
    """GET /api/setup/currencies.

    functional_currency, enabled_currencies, and reporting_currency all come
    from tenant_org_config (single source of truth).
    fx_rates and revaluation_rules come from tenant_fx_config.
    """

    functional_currency: Optional[str] = None
    enabled_currencies: Optional[list[str]] = None
    reporting_currency: Optional[str] = None
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
    """PATCH /api/setup/roles/assignments/{id}. Send role_tier=null to remove the tier."""

    role_tier: Optional[str] = None


class RoleAssignmentResponse(BaseModel):
    """Single role assignment row."""

    id: str
    user_id: str           # User.id — used to match against CC head_user_id
    user_tenant_id: str
    full_name: str
    email: str
    role_tier: Optional[str]
    is_active: bool


class FunctionalScopeItem(BaseModel):
    """A single section grant with its access level."""

    section: str
    access_level: str  # 'full' | 'read_only' | 'none'


class FunctionalScopeUpdate(BaseModel):
    """PATCH /api/setup/roles/assignments/{id}/scope — replaces all scope sections."""

    sections: list[FunctionalScopeItem]  # empty list = no access


class FunctionalScopeResponse(BaseModel):
    """GET /api/setup/roles/assignments/{id}/scope."""

    user_tenant_id: str
    sections: list[FunctionalScopeItem]  # granted sections with their individual access levels


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


# ── System Function Mappings ───────────────────────────────────────────────────

class FunctionMappingItem(BaseModel):
    """A single function → cost-centre mapping returned from the API."""

    id: str
    function_code: str
    cost_center_id: str
    cost_center_name: str
    cost_center_code: str
    is_primary: bool


class FunctionMappingUpsertItem(BaseModel):
    """One row in a PUT /api/setup/function-mappings request body."""

    function_code: str
    cost_center_id: str
    is_primary: bool = True


class FunctionMappingsResponse(BaseModel):
    """GET /api/setup/function-mappings response."""

    mappings: list[FunctionMappingItem]


class FunctionTeamMember(BaseModel):
    """One member of the team returned by GET /api/setup/functions/{code}/team."""

    role_id: str
    role_name: str
    designation: Optional[str]
    cost_center_id: str
    cost_center_name: str
    occupants: list[dict]


class FunctionTeamResponse(BaseModel):
    """GET /api/setup/functions/{code}/team response."""

    function_code: str
    function_label: str
    cost_centers: list[str]
    team: list[FunctionTeamMember]


# ── Go-live ────────────────────────────────────────────────────────────────────

class GoLiveResponse(BaseModel):
    """POST /api/setup/go-live response."""

    message: str
    tenant_id: str
