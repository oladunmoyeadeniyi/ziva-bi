"""
ZivaBI — platform (owner portal) Pydantic schemas.

Used exclusively by routers/platform.py — super-admin-only endpoints for
tenant lifecycle management. No tenant-scoped user should ever see these.
"""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel


class TenantListItem(BaseModel):
    """One row in the /api/platform/tenants list."""

    id: str
    name: str
    slug: str
    country: str
    environment: str
    parent_tenant_id: str | None
    lifecycle_status: str
    is_active: bool
    user_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class TenantUserSummary(BaseModel):
    """Compact user record for the tenant detail view."""

    id: str
    full_name: str
    email: str
    role_tier: str | None
    is_active: bool
    user_type: str  # 'employee' | 'external'


class TestEnvSummary(BaseModel):
    """
    Summary of a tenant's environment counterpart, shown inside tenant detail.

    Used both directions: a live tenant's test shadow (test_environment) and,
    since M9.0.1, a test tenant's born-from-promotion live counterpart
    (live_environment). Same shape either way -- id/name/slug/lifecycle_status.
    """

    id: str
    name: str
    slug: str
    lifecycle_status: str


class TenantDetail(BaseModel):
    """Full tenant record for /api/platform/tenants/{tenant_id}."""

    id: str
    name: str
    slug: str
    country: str
    environment: str
    parent_tenant_id: str | None
    lifecycle_status: str
    pre_suspension_status: str | None
    is_active: bool
    user_count: int
    active_module_count: int
    users: list[TenantUserSummary]
    test_environment: TestEnvSummary | None
    live_environment: TestEnvSummary | None = None
    created_at: datetime
    updated_at: datetime


class LifecycleUpdateRequest(BaseModel):
    """
    Body for PATCH /api/platform/tenants/{tenant_id}/lifecycle.

    "suspended" is deliberately excluded — use POST .../suspend instead.
    """

    status: Literal["trial", "in_implementation", "live"]


class SuspendResponse(BaseModel):
    """Returned by suspend and reactivate endpoints."""

    id: str
    lifecycle_status: str
    pre_suspension_status: str | None
    message: str


# ── M9.3a: Consultant access / enter-tenant ───────────────────────────────────

class EnterTenantRequest(BaseModel):
    """
    Optional body for POST /api/platform/tenants/{tenant_id}/enter.

    Only relevant when the target tenant's lifecycle is 'live':
      environment='live'  → support mode, read-only on live data
      environment='test'  → routes to the test shadow, full edit allowed
    Ignored (and not needed) for trial / in_implementation tenants.
    """

    environment: Literal["live", "test"] = "live"


class EnterTenantResponse(BaseModel):
    """
    Returned by POST /api/platform/tenants/{tenant_id}/enter.

    The frontend stores access_token and uses it for all subsequent requests
    targeting the impersonated tenant. No refresh token is issued — the
    impersonation token is short-lived (standard access_token_expire_minutes).
    Re-enter to refresh.
    """

    access_token: str
    token_type: str = "bearer"
    impersonation_mode: str   # "implementation" | "support"
    environment: str          # "live" | "test"
    tenant_id: str
    tenant_name: str


# ── Phase 3a: CoA / Dimensions / promotion diff + apply ──────────────────────

class PromotionDiffItem(BaseModel):
    """
    One proposed change in a promotion diff.

    item_id is stable across diff and apply calls — it encodes the natural key and
    is the value the caller submits in accepted_item_ids to accept this change.

    Scheme:
        coa:{gl_number}                      e.g. "coa:410080"
        dim:{dim_code}                        e.g. "dim:cost_center"
        dimval:{dim_code}:{val_code}          e.g. "dimval:cost_center:NG_FI"
        glreq:{gl_number}:{dim_code}          e.g. "glreq:410080:cost_center"
        accmap:{role_key}                     e.g. "accmap:employee_payable"

    before / after hold human-readable field values (not raw UUIDs — cross-entity
    references are shown as natural key strings).
    """

    item_id: str
    entity: str          # "coa"|"dimension"|"dimension_value"|"gl_requirement"|"account_mapping"
    action: str          # "create"|"update"|"deactivate"
    natural_key: str     # human-readable key, e.g. "410080" or "cost_center:NG_FI"
    label: str           # e.g. "410080 — Financial Discounts"
    before: dict         # current live field values (empty dict for create)
    after: dict          # proposed test field values (empty dict for deactivate)
    changed_fields: list[str]  # populated for update only


class PromotionDiff(BaseModel):
    """Full structured diff returned by POST /promotion/diff."""

    dimensions: list[PromotionDiffItem]
    coa: list[PromotionDiffItem]
    dimension_values: list[PromotionDiffItem]
    gl_requirements: list[PromotionDiffItem]
    account_mappings: list[PromotionDiffItem]
    total_changes: int


class PromotionApplyRequest(BaseModel):
    """Body for POST /promotion/apply — list of item_ids from the diff to accept."""

    accepted_item_ids: list[str]


class PromotionApplyResult(BaseModel):
    """Summary returned after a successful apply."""

    created: dict[str, int]     # counts per entity type
    updated: dict[str, int]
    deactivated: dict[str, int]
    total_applied: int
    message: str


# ── M9.3b: User-level impersonation ──────────────────────────────────────────

class UserImpersonateRequest(BaseModel):
    """
    Optional body for POST /api/platform/tenants/{tenant_id}/users/{user_id}/impersonate.

    entry_point records how the impersonation was initiated for the audit trail.
    Defaults to "user_list" (the Super Admin portal user list).
    """

    entry_point: Literal["user_list", "employee_list"] = "user_list"


class ImpersonatedUserSummary(BaseModel):
    """Compact view of the user being impersonated, returned in the token response."""

    id: str
    full_name: str
    email: str
    role: str | None


class UserImpersonateResponse(BaseModel):
    """
    Returned by POST /api/platform/tenants/{tenant_id}/users/{user_id}/impersonate.

    access_token: a short-lived JWT whose sub is the TARGET user (not the SA).
                  The frontend stores this as the active token for the duration
                  of the impersonation session.
    session_id: the ImpersonationSession.id — pass to POST /impersonation/{id}/end.
    target_user: compact display info for the banner ("You are viewing as …").
    """

    access_token: str
    token_type: str = "bearer"
    session_id: str
    target_user: ImpersonatedUserSummary


class ImpersonationEndResponse(BaseModel):
    """Returned by POST /api/platform/impersonation/{session_id}/end."""

    session_id: str
    message: str


# ── #49 Consultant system config ──────────────────────────────────────────────

class ModuleLicenseItem(BaseModel):
    """One module row in the system config response."""

    key: str
    label: str
    is_licensed: bool
    is_active: bool


class SystemConfigResponse(BaseModel):
    """
    Returned by GET /api/platform/tenants/{id}/system-config.

    posting_mode: three-mode routing setting (lite | connected | full_erp).
    modules: every known module key with its licensed + active flags.
    """

    posting_mode: str
    modules: list[ModuleLicenseItem]


class SystemConfigUpdate(BaseModel):
    """
    Body for PATCH /api/platform/tenants/{id}/system-config.

    posting_mode: set to None to leave unchanged.
    module_licenses: map of module_key -> is_licensed; omit keys to leave unchanged.
    """

    posting_mode: Optional[Literal["lite", "connected", "full_erp"]] = None
    module_licenses: Optional[dict[str, bool]] = None


class TrialListItem(BaseModel):
    """One row in the GET /api/platform/trials list.

    Carries trial-specific fields (lead_status, implementation_notes) alongside
    the core tenant identity. industry/company_email are joined from
    TenantOrgConfig (nullable — a fresh trial may not have set them yet).
    """

    id: str
    name: str
    slug: str
    country: str
    environment: str
    lifecycle_status: str
    lead_status: str            # new | contacted | qualified | disqualified
    implementation_notes: str | None
    industry: str | None        # from TenantOrgConfig (nullable on fresh trials)
    company_email: str | None   # from TenantOrgConfig (nullable on fresh trials)
    user_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class TrialLeadUpdate(BaseModel):
    """Body for PATCH /api/platform/trials/{tenant_id}.

    Both fields are optional — send only what you're changing.
    lead_status values: new | contacted | qualified | disqualified.
    """

    lead_status: Optional[Literal["new", "contacted", "qualified", "disqualified"]] = None
    implementation_notes: Optional[str] = None


class NukeTenantRequest(BaseModel):
    """
    Body for DELETE /api/platform/tenants/{tenant_id}.

    confirmation_slug must exactly match the tenant slug.
    For live tenants, confirm_live_delete must also be True —
    this extra flag forces the SA to explicitly acknowledge they
    are destroying a live (potentially real-company) tenant.
    """

    confirmation_slug: str
    confirm_live_delete: bool = False
