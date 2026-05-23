"""
ZivaBI — Pydantic schemas for M7 expense configuration and categories.

Used by the expense_config router to validate request bodies and shape API responses.
All category endpoints return ExpenseCategoryResponse which embeds subcategories so
the frontend receives a single hierarchical payload instead of making multiple calls.
"""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, field_validator


# ── Expense Config ────────────────────────────────────────────────────────────

GL_CODING_MODES = Literal["employee", "finance", "category_mapped"]


class TenantExpenseConfigCreate(BaseModel):
    """
    Payload to create or update the tenant's expense form configuration.

    All fields are optional so callers can PATCH individual settings without
    resending the full object.
    """

    gl_coding_mode: GL_CODING_MODES | None = None
    require_category: bool | None = None
    require_subcategory: bool | None = None
    allow_free_text_description: bool | None = None


class TenantExpenseConfigResponse(BaseModel):
    """Current expense config for a tenant, or the system defaults if none exists."""

    gl_coding_mode: str
    require_category: bool
    require_subcategory: bool
    allow_free_text_description: bool

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
    gl_account_suggestion: str | None = None
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
    gl_account_suggestion: str | None = None
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
    gl_account_suggestion: str | None
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
            gl_account_suggestion=c.gl_account_suggestion,
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

    Contains all config flags plus the full active category tree so the form
    can render category/subcategory dropdowns and apply GL coding mode rules
    without making multiple API calls.
    """

    gl_coding_mode: str
    require_category: bool
    require_subcategory: bool
    allow_free_text_description: bool
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
