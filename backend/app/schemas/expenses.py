"""
ZivaBI — expense management Pydantic schemas.

Request/response shapes for the expenses router (Milestones 3–7).
All monetary amounts are Decimal to avoid floating-point drift.

M7 changes:
  - gl_account is now optional (null in Finance-mode submissions)
  - ExpenseLineCreate/Update accept category_id and subcategory_id
  - ExpenseLineResponse surfaces category_id and subcategory_id
"""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, field_validator


# ── Expense Line ──────────────────────────────────────────────────────────────

class ExpenseLineCreate(BaseModel):
    """
    Payload for adding a single line to a DRAFT report.

    gl_account is optional since M7: Finance-mode tenants leave it blank and
    Finance fills it in during the approval step.  Employee-mode tenants should
    always provide it (enforced by the frontend; the backend stores whatever
    it receives).
    """

    gl_account: str | None = None
    pl_group: str | None = None
    io_dimension: str | None = None
    cost_center: str | None = None
    location: str | None = None
    invoice_date: date | None = None
    invoice_number: str | None = None
    description: str
    amount: Decimal
    # M7 category fields
    category_id: uuid.UUID | None = None
    subcategory_id: uuid.UUID | None = None

    @field_validator("gl_account")
    @classmethod
    def validate_gl(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            return v or None  # coerce empty string to None
        return v

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Description is required.")
        return v

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Amount must be greater than zero.")
        return v


class ExpenseLineResponse(BaseModel):
    """Single expense line as returned in API responses."""

    id: str
    report_id: str
    line_number: int
    pl_group: str | None
    gl_account: str | None
    io_dimension: str | None
    cost_center: str | None
    location: str | None
    invoice_date: date | None
    invoice_number: str | None
    description: str
    amount: Decimal
    category_id: str | None
    subcategory_id: str | None
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm(cls, line: Any) -> "ExpenseLineResponse":
        """Build from an ExpenseLine ORM instance."""
        return cls(
            id=str(line.id),
            report_id=str(line.report_id),
            line_number=line.line_number,
            pl_group=line.pl_group,
            gl_account=line.gl_account,
            io_dimension=line.io_dimension,
            cost_center=line.cost_center,
            location=line.location,
            invoice_date=line.invoice_date,
            invoice_number=line.invoice_number,
            description=line.description,
            amount=line.amount,
            category_id=str(line.category_id) if line.category_id else None,
            subcategory_id=str(line.subcategory_id) if line.subcategory_id else None,
            created_at=line.created_at,
        )


# ── Expense Report ────────────────────────────────────────────────────────────

class ExpenseLineUpdate(BaseModel):
    """
    Payload for updating individual fields on an existing expense line (PATCH semantics).

    M7: category_id and subcategory_id are patchable. gl_account accepts None
    to clear the value (Finance-mode tenants may leave it blank).
    """

    gl_account: str | None = None
    pl_group: str | None = None
    io_dimension: str | None = None
    cost_center: str | None = None
    location: str | None = None
    invoice_date: date | None = None
    invoice_number: str | None = None
    description: str | None = None
    amount: Decimal | None = None
    category_id: uuid.UUID | None = None
    subcategory_id: uuid.UUID | None = None

    @field_validator("gl_account")
    @classmethod
    def validate_gl(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            return v or None
        return v

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Description cannot be empty.")
        return v

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: Decimal | None) -> Decimal | None:
        if v is not None and v <= 0:
            raise ValueError("Amount must be greater than zero.")
        return v


class ExpenseReportCreate(BaseModel):
    """Payload for creating a new DRAFT expense report."""

    report_date: date
    employee_function: str | None = None


class ExpenseReportUpdate(BaseModel):
    """Payload for updating header fields of a DRAFT report."""

    report_date: date | None = None
    employee_function: str | None = None


class ExpenseReportResponse(BaseModel):
    """
    Full expense report as returned in API responses.

    lines is populated only on single-report GET; for the list endpoint
    it is an empty list and line_count reflects the actual count.

    M4 additions:
      current_approval_level  — active approval level (null when not in approval)
      rejection_comment       — set when status = REJECTED
    """

    id: str
    tenant_id: str
    report_number: str
    employee_id: str
    employee_code: str | None
    employee_function: str | None
    report_date: date
    status: str
    currency: str
    total_amount: Decimal
    submitted_at: datetime | None
    current_approval_level: int | None
    rejection_comment: str | None
    created_at: datetime
    updated_at: datetime
    lines: list[ExpenseLineResponse] = []
    line_count: int = 0

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm(cls, report: Any, include_lines: bool = True) -> "ExpenseReportResponse":
        """Build from an ExpenseReport ORM instance."""
        lines = (
            [ExpenseLineResponse.from_orm(ln) for ln in (report.lines or [])]
            if include_lines
            else []
        )
        return cls(
            id=str(report.id),
            tenant_id=str(report.tenant_id),
            report_number=report.report_number,
            employee_id=str(report.employee_id),
            employee_code=report.employee_code,
            employee_function=report.employee_function,
            report_date=report.report_date,
            status=report.status,
            currency=report.currency,
            total_amount=report.total_amount,
            submitted_at=report.submitted_at,
            current_approval_level=report.current_approval_level,
            rejection_comment=report.rejection_comment,
            created_at=report.created_at,
            updated_at=report.updated_at,
            lines=lines,
            line_count=len(report.lines) if report.lines is not None else 0,
        )
