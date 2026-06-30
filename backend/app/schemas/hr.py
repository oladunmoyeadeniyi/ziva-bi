"""
ZivaBI — Pydantic schemas for M8.1 HR module (employees, cost center config, finance review).

Used by /api/hr/ router for:
  - Employee CRUD, bulk upload, transfer, code history
  - Cost center head assignment (cost_center_config)
  - Finance reviewer configuration (finance_review_config)
"""

import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, field_validator


# ── Employee ──────────────────────────────────────────────────────────────────

class EmployeeCreate(BaseModel):
    """Payload to create a single employee."""

    first_name: str
    last_name: str
    email: str
    other_name: str | None = None
    preferred_name: str | None = None
    employee_code: str | None = None
    phone: str | None = None
    cost_center_id: uuid.UUID | None = None
    line_manager_id: uuid.UUID | None = None
    resumption_date: date | None = None

    @field_validator("first_name", "last_name", "email")
    @classmethod
    def validate_non_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Field is required.")
        return v


class EmployeeUpdate(BaseModel):
    """Payload for updating an employee (PATCH semantics)."""

    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    other_name: str | None = None
    preferred_name: str | None = None
    employee_code: str | None = None
    phone: str | None = None
    cost_center_id: uuid.UUID | None = None
    line_manager_id: uuid.UUID | None = None
    resumption_date: date | None = None
    is_active: bool | None = None


class EmployeeListItem(BaseModel):
    """Lightweight employee row for paginated list responses."""

    id: str
    employee_code: str | None
    first_name: str
    last_name: str
    preferred_name: str | None
    email: str
    phone: str | None
    cost_center_id: str | None
    cost_center_name: str | None
    line_manager_id: str | None
    line_manager_name: str | None
    is_active: bool
    resumption_date: date | None
    # M9.3b: UUID of the linked users row — None if the employee has no portal account.
    # Populated by list_employees via a batch email→user_id lookup.
    user_id: str | None = None

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm(cls, emp: object) -> "EmployeeListItem":
        from app.models.master_data import Employee
        e: Employee = emp  # type: ignore[assignment]
        cc_name = None
        if hasattr(e, "cost_center") and e.cost_center:
            cc_name = e.cost_center.name
        lm_name = None
        if hasattr(e, "line_manager") and e.line_manager:
            lm_name = f"{e.line_manager.first_name} {e.line_manager.last_name}"
        return cls(
            id=str(e.id),
            employee_code=e.employee_code,
            first_name=e.first_name,
            last_name=e.last_name,
            preferred_name=e.preferred_name,
            email=e.email,
            phone=e.phone,
            cost_center_id=str(e.cost_center_id) if e.cost_center_id else None,
            cost_center_name=cc_name,
            line_manager_id=str(e.line_manager_id) if e.line_manager_id else None,
            line_manager_name=lm_name,
            is_active=e.is_active,
            resumption_date=e.resumption_date,
        )


class EmployeeResponse(EmployeeListItem):
    """Full employee detail, extends list item with audit fields."""

    created_at: datetime
    updated_at: datetime
    employee_code_auto_generated: bool
    other_name: str | None = None

    @classmethod
    def from_orm(cls, emp: object) -> "EmployeeResponse":  # type: ignore[override]
        from app.models.master_data import Employee
        e: Employee = emp  # type: ignore[assignment]
        cc_name = None
        if hasattr(e, "cost_center") and e.cost_center:
            cc_name = e.cost_center.name
        lm_name = None
        if hasattr(e, "line_manager") and e.line_manager:
            lm_name = f"{e.line_manager.first_name} {e.line_manager.last_name}"
        return cls(
            id=str(e.id),
            employee_code=e.employee_code,
            first_name=e.first_name,
            last_name=e.last_name,
            other_name=e.other_name,
            preferred_name=e.preferred_name,
            email=e.email,
            phone=e.phone,
            cost_center_id=str(e.cost_center_id) if e.cost_center_id else None,
            cost_center_name=cc_name,
            line_manager_id=str(e.line_manager_id) if e.line_manager_id else None,
            line_manager_name=lm_name,
            is_active=e.is_active,
            resumption_date=e.resumption_date,
            created_at=e.created_at,
            updated_at=e.updated_at,
            employee_code_auto_generated=e.employee_code_auto_generated,
        )


# ── Employee Transfer ─────────────────────────────────────────────────────────

class TransferCreate(BaseModel):
    """Payload to transfer an employee to a new cost center."""

    to_cost_center_id: uuid.UUID
    effective_date: date
    notes: str | None = None


class TransferResponse(BaseModel):
    """A cost center transfer record."""

    id: str
    employee_id: str
    from_cost_center_id: str | None
    from_cost_center_name: str | None
    to_cost_center_id: str | None
    to_cost_center_name: str | None
    effective_date: date
    notes: str | None
    transferred_by: str | None
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm(cls, t: object) -> "TransferResponse":
        from app.models.master_data import EmployeeTransfer
        tr: EmployeeTransfer = t  # type: ignore[assignment]
        from_name = tr.from_cost_center.name if hasattr(tr, "from_cost_center") and tr.from_cost_center else None
        to_name = tr.to_cost_center.name if hasattr(tr, "to_cost_center") and tr.to_cost_center else None
        return cls(
            id=str(tr.id),
            employee_id=str(tr.employee_id),
            from_cost_center_id=str(tr.from_cost_center_id) if tr.from_cost_center_id else None,
            from_cost_center_name=from_name,
            to_cost_center_id=str(tr.to_cost_center_id) if tr.to_cost_center_id else None,
            to_cost_center_name=to_name,
            effective_date=tr.effective_date,
            notes=tr.notes,
            transferred_by=str(tr.transferred_by) if tr.transferred_by else None,
            created_at=tr.created_at,
        )


# ── Employee Code Update ──────────────────────────────────────────────────────

class CodeUpdateRequest(BaseModel):
    """Payload to update an employee's code (retrospective or progressive)."""

    new_code: str
    change_type: str  # 'retrospective' | 'progressive'
    effective_date: date
    notes: str | None = None

    @field_validator("change_type")
    @classmethod
    def validate_change_type(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in ("retrospective", "progressive"):
            raise ValueError("change_type must be 'retrospective' or 'progressive'.")
        return v

    @field_validator("new_code")
    @classmethod
    def validate_new_code(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("new_code is required.")
        return v


class CodeHistoryResponse(BaseModel):
    """A single employee code history record."""

    id: str
    employee_id: str
    old_code: str | None
    new_code: str
    change_type: str | None
    effective_date: date
    changed_by: str | None
    changed_at: datetime
    notes: str | None

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm(cls, h: object) -> "CodeHistoryResponse":
        from app.models.master_data import EmployeeCodeHistory
        ch: EmployeeCodeHistory = h  # type: ignore[assignment]
        return cls(
            id=str(ch.id),
            employee_id=str(ch.employee_id),
            old_code=ch.old_code,
            new_code=ch.new_code,
            change_type=ch.change_type,
            effective_date=ch.effective_date,
            changed_by=str(ch.changed_by) if ch.changed_by else None,
            changed_at=ch.changed_at,
            notes=ch.notes,
        )


class EmployeeHistoryResponse(BaseModel):
    """Combined code history + transfer history for an employee."""

    code_history: list[CodeHistoryResponse] = []
    transfers: list[TransferResponse] = []


# ── Employee Upload ───────────────────────────────────────────────────────────

class EmployeeUploadResult(BaseModel):
    """Result returned by the employee bulk upload endpoint."""

    imported: int
    updated: int = 0
    skipped: int
    errors: list[dict]  # [{row, reason}]
    head_assignments: int = 0  # CostCenterConfig rows upserted via head-of-cc column


# ── Cost Center Options ───────────────────────────────────────────────────────

class CostCenterOption(BaseModel):
    """Lightweight cost-center option for dropdowns. Returned by GET /api/hr/cost-centers/options."""

    id: str
    code: str
    name: str


# ── Cost Center Config ────────────────────────────────────────────────────────

class CostCenterHeadUpdate(BaseModel):
    """Payload to set or update the head of a cost center."""

    head_employee_id: uuid.UUID | None = None
    head_user_id: uuid.UUID | None = None


class CostCenterConfigResponse(BaseModel):
    """A cost center configuration record."""

    id: str
    cost_center_id: str
    cost_center_code: str | None
    cost_center_name: str | None
    head_employee_id: str | None
    head_employee_name: str | None
    head_user_id: str | None
    head_user_name: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm(cls, cfg: object) -> "CostCenterConfigResponse":
        from app.models.master_data import CostCenterConfig
        c: CostCenterConfig = cfg  # type: ignore[assignment]
        emp_name = None
        if hasattr(c, "head_employee") and c.head_employee:
            emp_name = f"{c.head_employee.first_name} {c.head_employee.last_name}"
        user_name = None
        if hasattr(c, "head_user") and c.head_user:
            user_name = f"{c.head_user.first_name} {c.head_user.last_name}"
        cc_code = c.cost_center.code if hasattr(c, "cost_center") and c.cost_center else None
        cc_name = c.cost_center.name if hasattr(c, "cost_center") and c.cost_center else None
        return cls(
            id=str(c.id),
            cost_center_id=str(c.cost_center_id),
            cost_center_code=cc_code,
            cost_center_name=cc_name,
            head_employee_id=str(c.head_employee_id) if c.head_employee_id else None,
            head_employee_name=emp_name,
            head_user_id=str(c.head_user_id) if c.head_user_id else None,
            head_user_name=user_name,
            created_at=c.created_at,
            updated_at=c.updated_at,
        )


# ── Finance Review Config ─────────────────────────────────────────────────────

class FinanceReviewerCreate(BaseModel):
    """Payload to add a finance reviewer."""

    module: str  # 'expense_retirement' | 'accounts_payable'
    reviewer_user_id: uuid.UUID
    review_level: int = 1
    cost_center_id: uuid.UUID | None = None  # None = applies to all cost centers

    @field_validator("module")
    @classmethod
    def validate_module(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in ("expense_retirement", "accounts_payable"):
            raise ValueError("module must be 'expense_retirement' or 'accounts_payable'.")
        return v

    @field_validator("review_level")
    @classmethod
    def validate_review_level(cls, v: int) -> int:
        if v < 1:
            raise ValueError("review_level must be at least 1.")
        return v


class FinanceReviewerUpdate(BaseModel):
    """Payload to update a reviewer's level or scope."""

    review_level: int | None = None
    cost_center_id: uuid.UUID | None = None


class FinanceReviewConfigResponse(BaseModel):
    """A finance review configuration record."""

    id: str
    module: str
    reviewer_user_id: str
    reviewer_name: str | None
    reviewer_email: str | None
    review_level: int
    cost_center_id: str | None
    cost_center_name: str | None
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm(cls, cfg: object) -> "FinanceReviewConfigResponse":
        from app.models.master_data import FinanceReviewConfig
        c: FinanceReviewConfig = cfg  # type: ignore[assignment]
        user_name = None
        user_email = None
        if hasattr(c, "reviewer") and c.reviewer:
            user_name = f"{c.reviewer.first_name} {c.reviewer.last_name}"
            user_email = c.reviewer.email
        cc_name = c.cost_center.name if hasattr(c, "cost_center") and c.cost_center else None
        return cls(
            id=str(c.id),
            module=c.module,
            reviewer_user_id=str(c.reviewer_user_id),
            reviewer_name=user_name,
            reviewer_email=user_email,
            review_level=c.review_level,
            cost_center_id=str(c.cost_center_id) if c.cost_center_id else None,
            cost_center_name=cc_name,
            created_at=c.created_at,
        )
