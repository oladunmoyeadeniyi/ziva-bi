"""
Pydantic schemas for Budget & Planning (M16).

Covers:
  - BudgetPeriod  create / update / response / list-item
  - BudgetLine    create / update / response
  - BudgetVarianceRow / BudgetVarianceResponse  (variance report output)
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, field_validator


# ── BudgetLine ─────────────────────────────────────────────────────────────

class BudgetLineIn(BaseModel):
    """Input schema for creating or updating a budget line."""

    gl_account_id: Optional[uuid.UUID] = None
    department_id: Optional[uuid.UUID] = None
    description: Optional[str] = None
    annual_amount: Decimal = Decimal("0")
    monthly_allocations: Optional[dict[str, Decimal]] = None  # {"01": 50000.00, ...}
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class BudgetLineOut(BaseModel):
    """Response schema for a single budget line."""

    id: uuid.UUID
    budget_period_id: uuid.UUID
    gl_account_id: Optional[uuid.UUID]
    gl_code: Optional[str] = None
    gl_name: Optional[str] = None
    department_id: Optional[uuid.UUID]
    department_name: Optional[str] = None
    description: Optional[str]
    annual_amount: Decimal
    monthly_allocations: Optional[dict[str, Any]]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── BudgetPeriod ───────────────────────────────────────────────────────────

class BudgetPeriodCreate(BaseModel):
    """Request body for creating a new budget period."""

    name: str
    fiscal_year: int
    period_start: date
    period_end: date
    description: Optional[str] = None
    lines: Optional[list[BudgetLineIn]] = None

    @field_validator("period_end")
    @classmethod
    def end_after_start(cls, v: date, info) -> date:
        start = info.data.get("period_start")
        if start and v < start:
            raise ValueError("period_end must be on or after period_start")
        return v


class BudgetPeriodUpdate(BaseModel):
    """Request body for updating a budget period (DRAFT only)."""

    name: Optional[str] = None
    description: Optional[str] = None
    period_start: Optional[date] = None
    period_end: Optional[date] = None


class BudgetPeriodListItem(BaseModel):
    """Compact response for the budget period list page."""

    id: uuid.UUID
    name: str
    fiscal_year: int
    period_start: date
    period_end: date
    status: str
    line_count: int = 0
    total_budget: Decimal = Decimal("0")
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BudgetPeriodResponse(BaseModel):
    """Full budget period response including lines."""

    id: uuid.UUID
    name: str
    fiscal_year: int
    period_start: date
    period_end: date
    status: str
    description: Optional[str]
    created_by_id: Optional[uuid.UUID]
    approved_by_id: Optional[uuid.UUID]
    approved_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    lines: list[BudgetLineOut] = []

    model_config = ConfigDict(from_attributes=True)


# ── Variance Report ────────────────────────────────────────────────────────

class BudgetVarianceRow(BaseModel):
    """One row in the variance report — one GL account."""

    gl_account_id: Optional[uuid.UUID]
    gl_code: Optional[str]
    gl_name: Optional[str]
    department_id: Optional[uuid.UUID]
    department_name: Optional[str]
    annual_budget: Decimal
    ytd_budget: Decimal        # pro-rated budget up to as_at_date
    actual_amount: Decimal     # actuals from GL / batches / exports
    variance: Decimal          # ytd_budget - actual_amount (positive = under budget)
    variance_pct: Optional[float]  # variance / ytd_budget × 100


class BudgetVarianceTotals(BaseModel):
    """Grand-total row for the variance report."""

    annual_budget: Decimal
    ytd_budget: Decimal
    actual_amount: Decimal
    variance: Decimal
    variance_pct: Optional[float]


class BudgetVarianceResponse(BaseModel):
    """Full variance report response."""

    period_id: uuid.UUID
    period_name: str
    as_at_date: date
    data_source: str           # "gl_entries" | "posting_batches" | "expense_reports"
    rows: list[BudgetVarianceRow]
    totals: BudgetVarianceTotals
