"""
Pydantic schemas for Payroll & HR — M15.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict


# ── Salary Structures ──────────────────────────────────────────────────────────

class SalaryStructureCreate(BaseModel):
    employee_id: uuid.UUID
    effective_date: date
    basic: Decimal = Decimal("0")
    housing: Decimal = Decimal("0")
    transport: Decimal = Decimal("0")
    meal_allowance: Decimal = Decimal("0")
    other_allowances: Optional[list[dict[str, Any]]] = None
    currency: str = "NGN"
    gl_salary_expense_id: Optional[uuid.UUID] = None


class SalaryStructureResponse(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    effective_date: date
    basic: Decimal
    housing: Decimal
    transport: Decimal
    meal_allowance: Decimal
    other_allowances: Optional[list[dict[str, Any]]]
    gross_pay: Decimal
    currency: str
    gl_salary_expense_id: Optional[uuid.UUID]
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Payroll Runs ───────────────────────────────────────────────────────────────

class PayrollRunCreate(BaseModel):
    run_date: date
    period_start: date
    period_end: date
    notes: Optional[str] = None


class PayrollRunResponse(BaseModel):
    id: uuid.UUID
    reference: str
    run_date: date
    period_start: date
    period_end: date
    status: str
    total_gross: Decimal
    total_paye: Decimal
    total_pension_employee: Decimal
    total_pension_employer: Decimal
    total_net: Decimal
    posting_mode: Optional[str]
    journal_entry_id: Optional[uuid.UUID]
    posting_batch_id: Optional[uuid.UUID]
    notes: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Payroll Lines ──────────────────────────────────────────────────────────────

class PayrollLineResponse(BaseModel):
    id: uuid.UUID
    run_id: uuid.UUID
    employee_id: uuid.UUID
    employee_name: Optional[str] = None
    employee_code: Optional[str] = None
    basic: Decimal
    housing: Decimal
    transport: Decimal
    gross_pay: Decimal
    paye: Decimal
    pension_employee: Decimal
    pension_employer: Decimal
    health_insurance: Decimal
    total_deductions: Decimal
    net_pay: Decimal
    payment_status: str

    model_config = ConfigDict(from_attributes=True)


# ── Leave Types ────────────────────────────────────────────────────────────────

class LeaveTypeCreate(BaseModel):
    name: str
    code: str
    days_per_year: Decimal = Decimal("0")
    carry_forward: bool = False
    max_carry_forward_days: Optional[Decimal] = None
    requires_approval: bool = True
    is_paid: bool = True


class LeaveTypeResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    code: str
    days_per_year: Decimal
    carry_forward: bool
    max_carry_forward_days: Optional[Decimal]
    requires_approval: bool
    is_paid: bool
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Leave Requests ─────────────────────────────────────────────────────────────

class LeaveRequestCreate(BaseModel):
    employee_id: uuid.UUID
    leave_type_id: uuid.UUID
    start_date: date
    end_date: date
    days_requested: Decimal
    reason: Optional[str] = None


class LeaveRequestResponse(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    leave_type_id: uuid.UUID
    leave_type_name: Optional[str] = None
    start_date: date
    end_date: date
    days_requested: Decimal
    reason: Optional[str]
    status: str
    approved_by_id: Optional[uuid.UUID]
    approved_at: Optional[datetime]
    rejection_reason: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Leave Balances ─────────────────────────────────────────────────────────────

class LeaveBalanceResponse(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    leave_type_id: uuid.UUID
    leave_type_name: Optional[str] = None
    year: int
    allocated: Decimal
    taken: Decimal
    pending: Decimal
    carried_forward: Decimal
    remaining: Decimal

    model_config = ConfigDict(from_attributes=True)
