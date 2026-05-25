"""
ZivaBI — M8.2 Implementation Portal Pydantic schemas.

Request and response shapes for all /api/setup/* endpoints.
Covers: progress, organisation, modules, currencies/FX, tax, roles, documents, go-live.
"""

import uuid
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


# ── Organisation ──────────────────────────────────────────────────────────────

class OrgIdentityUpdate(BaseModel):
    """PATCH /api/setup/org — identity tab fields."""

    legal_name: Optional[str] = None
    rc_number: Optional[str] = None
    industry: Optional[str] = None
    functional_currency: Optional[str] = None
    reporting_currency: Optional[str] = None
    country: Optional[str] = None
    group_structure: Optional[str] = None
    parent_company_name: Optional[str] = None
    tin: Optional[str] = None
    vat_reg_number: Optional[str] = None


class FiscalYearUpdate(BaseModel):
    """Fiscal year tab fields."""

    fiscal_year_start_month: Optional[int] = None
    fiscal_year_start_day: Optional[int] = None
    period_frequency: Optional[str] = None


class OrgStructureUpdate(BaseModel):
    """Structure tab — tree of org nodes stored as JSONB."""

    org_structure: Optional[dict] = None


class BrandingUpdate(BaseModel):
    """Branding tab fields."""

    branding: Optional[dict] = None  # { logo_url, primary_colour, button_style }


class OrgConfigResponse(BaseModel):
    """Full org config response."""

    tenant_id: str
    legal_name: Optional[str] = None
    rc_number: Optional[str] = None
    industry: Optional[str] = None
    functional_currency: Optional[str] = None
    reporting_currency: Optional[str] = None
    country: Optional[str] = None
    group_structure: Optional[str] = None
    parent_company_name: Optional[str] = None
    tin: Optional[str] = None
    vat_reg_number: Optional[str] = None
    fiscal_year_start_month: Optional[int] = None
    fiscal_year_start_day: Optional[int] = None
    period_frequency: Optional[str] = None
    org_structure: Optional[dict] = None
    branding: Optional[dict] = None


# ── Modules ───────────────────────────────────────────────────────────────────

class ModuleState(BaseModel):
    """Single module activation state."""

    module_key: str
    label: str
    is_active: bool


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


# ── Go-live ────────────────────────────────────────────────────────────────────

class GoLiveResponse(BaseModel):
    """POST /api/setup/go-live response."""

    message: str
    tenant_id: str
