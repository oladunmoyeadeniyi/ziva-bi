"""
ZivaBI — Pydantic schemas for M7/M8 expense configuration and categories.

Used by the expense_config router to validate request bodies and shape API responses.
All category endpoints return ExpenseCategoryResponse which embeds subcategories so
the frontend receives a single hierarchical payload instead of making multiple calls.

M8 changes:
  - gl_coding_mode replaced by coding_level (int 0–4) in TenantExpenseConfig
  - FormConfigResponse derives gl_coding_mode from coding_level for backward compat
  - New fields: show_location, require_location
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, field_validator


# ── Expense Config ────────────────────────────────────────────────────────────

def _coding_level_to_gl_mode(level: int) -> str:
    """
    Derive a backward-compatible gl_coding_mode string from the M8 coding_level integer.

    Used by the form-config endpoint so the M7 expense form continues working
    until M9 updates the form to consume coding_level directly.
    """
    if level == 0:
        return "finance"
    elif level <= 3:
        return "category_mapped"
    return "employee"


class TenantExpenseConfigUpdate(BaseModel):
    """
    Payload to update the tenant's expense form configuration (PATCH semantics).

    All fields are optional so callers can update individual settings without
    resending the full object.
    """

    coding_level: int | None = None  # 0–4
    require_category: bool | None = None
    require_subcategory: bool | None = None
    allow_free_text_description: bool | None = None
    show_location: bool | None = None
    require_location: bool | None = None

    @field_validator("coding_level")
    @classmethod
    def validate_coding_level(cls, v: int | None) -> int | None:
        if v is not None and v not in range(5):
            raise ValueError("coding_level must be 0–4.")
        return v


# Keep old name as alias for backward compat with expense_config router import
TenantExpenseConfigCreate = TenantExpenseConfigUpdate


class TenantExpenseConfigResponse(BaseModel):
    """Current expense config for a tenant, or the system defaults if none exists."""

    coding_level: int
    require_category: bool
    require_subcategory: bool
    allow_free_text_description: bool
    show_location: bool
    require_location: bool

    model_config = {"from_attributes": True}


# ── Expense Categories ────────────────────────────────────────────────────────

class ExpenseCategoryCreate(BaseModel):
    """
    Payload for creating a new category or subcategory.

    parent_id = None → top-level category.
    parent_id set → subcategory of the specified parent.
    """

    name: str
    code: str | None = None
    parent_id: uuid.UUID | None = None
    sort_order: int = 0

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Category name is required.")
        return v


class ExpenseCategoryUpdate(BaseModel):
    """Payload for updating an existing category (PATCH semantics)."""

    name: str | None = None
    code: str | None = None
    sort_order: int | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Category name cannot be empty.")
        return v


class ExpenseCategoryResponse(BaseModel):
    """
    Single expense category as returned in API responses.

    subcategories is populated for top-level categories; it is always an empty list
    for subcategory rows (we only support one level of nesting).
    """

    id: str
    tenant_id: str
    name: str
    code: str | None
    parent_id: str | None
    is_active: bool
    sort_order: int
    created_at: datetime
    subcategories: list["ExpenseCategoryResponse"] = []

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm(cls, cat: object, subcats: list | None = None) -> "ExpenseCategoryResponse":
        """Build from an ExpenseCategory ORM instance with optional pre-loaded subcategories."""
        from app.models.expenses import ExpenseCategory  # local import to avoid circulars
        c: "ExpenseCategory" = cat  # type: ignore[assignment]
        return cls(
            id=str(c.id),
            tenant_id=str(c.tenant_id),
            name=c.name,
            code=c.code,
            parent_id=str(c.parent_id) if c.parent_id else None,
            is_active=c.is_active,
            sort_order=c.sort_order,
            created_at=c.created_at,
            subcategories=[
                ExpenseCategoryResponse.from_orm(s)
                for s in (subcats or [])
                if s.is_active
            ],
        )


# ── Form Config (used by expense form on page load) ───────────────────────────

class FormConfigResponse(BaseModel):
    """
    Combined payload that the expense submission form fetches on page load.

    gl_coding_mode is derived from coding_level for backward compat with the M7
    expense form. M9 will update the form to use coding_level directly.
    """

    gl_coding_mode: str  # derived from coding_level; remove in M9
    coding_level: int
    require_category: bool
    require_subcategory: bool
    allow_free_text_description: bool
    show_location: bool
    require_location: bool
    categories: list[ExpenseCategoryResponse]


# ── Finance GL Coding (batch update by Finance role during approval) ──────────

class LineGLCodeUpdate(BaseModel):
    """GL code update for a single expense line (used in batch Finance GL coding)."""

    line_id: uuid.UUID
    gl_account: str | None = None
    pl_group: str | None = None


class FinanceGLCodesRequest(BaseModel):
    """
    Batch request for Finance to set GL codes on submitted expense lines.

    Sent from the approval detail page when the Finance approver fills in GL
    accounts before clicking Approve. All fields are optional; only provided
    fields are written (PATCH semantics per line).
    """

    lines: list[LineGLCodeUpdate]
