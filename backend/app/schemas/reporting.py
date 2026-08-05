"""Pydantic schemas for the Reporting & Analytics module."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


VALID_REPORT_TYPES = [
    "expense_summary", "expense_by_category", "expense_by_department",
    "ar_aging", "ar_invoice_summary",
    "ap_aging", "ap_invoice_summary",
    "budget_variance", "budget_summary",
    "payroll_summary",
    "tax_summary",
    "inventory_valuation",
    "asset_register",
    "cash_flow_summary",
    "gl_activity",
]

VALID_MODULES = [
    "expense", "ar", "ap", "payroll", "budget", "tax",
    "inventory", "fixed_assets", "gl", "consolidation",
]


class SavedReportCreate(BaseModel):
    """Payload for creating a saved report definition."""

    name: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    report_type: str
    module: str
    filters: dict[str, Any] = Field(default_factory=dict)
    is_shared: bool = False


class SavedReportRead(BaseModel):
    """Saved report row — returned by list and get endpoints."""

    id: uuid.UUID
    name: str
    description: str | None
    report_type: str
    module: str
    filters: dict[str, Any]
    is_shared: bool
    created_by: uuid.UUID | None
    created_at: datetime
    last_run_at: datetime | None

    model_config = {"from_attributes": True}


class ReportRunRequest(BaseModel):
    """Payload for running a report (built-in or saved)."""

    report_type: str
    filters: dict[str, Any] = Field(default_factory=dict)


class ReportRunResponse(BaseModel):
    """Result of a report run."""

    report_type: str
    filters: dict[str, Any]
    row_count: int
    rows: list[dict[str, Any]]
