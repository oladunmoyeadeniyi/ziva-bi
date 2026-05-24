"""
ZivaBI — expense management Pydantic schemas.

Request/response shapes for the expenses router (Milestones 3–9).
All monetary amounts are Decimal to avoid floating-point drift.

M7 changes:
  - gl_account is now optional (null in Finance-mode submissions)
  - ExpenseLineCreate/Update accept category_id and subcategory_id
  - ExpenseLineResponse surfaces category_id and subcategory_id

M9 changes:
  - gl_id (UUID): structured CoA reference; sent alongside gl_account
  - dimension_values (dict): {dimension_id_str: value_id_str}
  - is_split_parent, split_parent_id: split-line tracking
  - flag_incorrect, flag_comment: Level-2 GL flagging by employee
  - SuggestionResponse: AI suggestion response for dimension/description pre-fill
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

    M9 additions:
      gl_id           — UUID FK to chart_of_accounts (preferred over free-text gl_account)
      dimension_values — {dimension_id_str: value_id_str} from the form's dimension dropdowns
      is_split_parent  — marks this as the parent of split sub-lines
      split_parent_id  — set on split sub-lines; UUID of the parent line
      flag_incorrect   — Level-2: employee flags the auto-assigned GL as wrong
      flag_comment     — employee explanation for the flag
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
    # M9 fields
    gl_id: uuid.UUID | None = None
    dimension_values: dict | None = None
    is_split_parent: bool = False
    split_parent_id: uuid.UUID | None = None
    flag_incorrect: bool = False
    flag_comment: str | None = None

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
    # M9 fields
    gl_id: str | None
    dimension_values: dict | None
    is_split_parent: bool
    split_parent_id: str | None
    flag_incorrect: bool
    flag_comment: str | None
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
            gl_id=str(line.gl_id) if line.gl_id else None,
            dimension_values=line.dimension_values,
            is_split_parent=line.is_split_parent,
            split_parent_id=str(line.split_parent_id) if line.split_parent_id else None,
            flag_incorrect=line.flag_incorrect,
            flag_comment=line.flag_comment,
            created_at=line.created_at,
        )


# ── Expense Report ────────────────────────────────────────────────────────────

class ExpenseLineUpdate(BaseModel):
    """
    Payload for updating individual fields on an existing expense line (PATCH semantics).

    M7: category_id and subcategory_id are patchable. gl_account accepts None
    to clear the value (Finance-mode tenants may leave it blank).

    M9: adds gl_id, dimension_values, is_split_parent, split_parent_id,
    flag_incorrect, flag_comment as patchable fields.
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
    # M9 fields
    gl_id: uuid.UUID | None = None
    dimension_values: dict | None = None
    is_split_parent: bool | None = None
    split_parent_id: uuid.UUID | None = None
    flag_incorrect: bool | None = None
    flag_comment: str | None = None

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


# ── M9: AI suggestion response ────────────────────────────────────────────────

class DimensionSuggestion(BaseModel):
    """
    A single dimension value suggestion for a specific dimension.

    confidence is 0.0–1.0.  Frontend uses:
      ≥ 0.80 → auto-fill the field
      0.40–0.79 → show as suggestion pill ("Last used: NG_FI")
      < 0.40 → no suggestion shown
    """

    value_id: str
    confidence: float


class SuggestionResponse(BaseModel):
    """
    Pre-fill suggestions returned after an employee selects a GL account.

    Based on the last 10 approved expense lines for this employee + GL.
    description: most recently used description for this GL (or None).
    dimensions: keyed by dimension_id_str; empty dict if no history.
    """

    description: str | None
    dimensions: dict[str, DimensionSuggestion]  # dimension_id → suggestion
