"""
Payroll & HR ORM models — M15.

Seven tables:
  SalaryStructure   — effective-dated per-employee salary component breakdown
  PayrollRun        — a payroll processing batch (monthly)
  PayrollLine       — one line per employee per run (gross + deductions + net)
  Payslip           — issued payslip record (linked to payroll line)
  LeaveType         — leave categories (Annual, Sick, Maternity, etc.)
  LeaveRequest      — individual employee leave application
  LeaveBalance      — per-employee per-year balance tracker

Three-mode posting (Full ERP):
  On payroll approval: DR salary expense / CR salaries payable
  On payment:          DR salaries payable / CR bank

Connected mode: create posting_batch for salary GL entries.
Lite mode: payroll run + CSV export only.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base


class SalaryStructure(Base):
    """
    Effective-dated salary component record for one employee.

    A new row is created whenever the salary changes, preserving history.
    The active structure is the one with the latest effective_date on or before today.

    Attributes:
        basic:             Basic salary component.
        housing:           Housing allowance.
        transport:         Transport allowance.
        meal_allowance:    Meal allowance.
        other_allowances:  JSONB list of {"name": str, "amount": Decimal} items.
        gross_pay:         Pre-computed sum of all components.
        gl_salary_expense_id: GL account to debit on payroll posting.
    """

    __tablename__ = "salary_structures"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    effective_date: Mapped[date] = mapped_column(Date, nullable=False)
    basic: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    housing: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    transport: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    meal_allowance: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    other_allowances: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    gross_pay: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="NGN")
    gl_salary_expense_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("chart_of_accounts.id", ondelete="SET NULL"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class PayrollRun(Base):
    """
    A payroll processing batch covering one period (typically a month).

    Status lifecycle: DRAFT → APPROVED → PAID (or CANCELLED).

    Attributes:
        reference:         PAY-{YYYY}-{NNN:03d}.
        run_date:          Date the run was processed.
        period_start/end:  Payroll period.
        posting_mode:      Snapshot of tenant mode at approval time.
        journal_entry_id:  Set when Full ERP posts the salary journal.
        posting_batch_id:  Set when Connected mode creates a batch.
    """

    __tablename__ = "payroll_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    reference: Mapped[str] = mapped_column(String(30), nullable=False)
    run_date: Mapped[date] = mapped_column(Date, nullable=False)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="DRAFT")
    total_gross: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    total_paye: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    total_pension_employee: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    total_pension_employer: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    total_net: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    posting_mode: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    journal_entry_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("journal_entries.id", ondelete="SET NULL"), nullable=True)
    posting_batch_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("posting_batches.id", ondelete="SET NULL"), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    paid_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("status IN ('DRAFT','APPROVED','PAID','CANCELLED')", name="ck_payroll_run_status"),
        UniqueConstraint("tenant_id", "reference", name="uq_payroll_run_reference"),
    )

    lines: Mapped[list[PayrollLine]] = relationship("PayrollLine", back_populates="run", cascade="all, delete-orphan")
    payslips: Mapped[list[Payslip]] = relationship("Payslip", back_populates="run", cascade="all, delete-orphan")


class PayrollLine(Base):
    """One employee's payroll computation for a single PayrollRun."""

    __tablename__ = "payroll_lines"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("payroll_runs.id", ondelete="CASCADE"), nullable=False, index=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="RESTRICT"), nullable=False, index=True)
    salary_structure_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("salary_structures.id", ondelete="SET NULL"), nullable=True)
    basic: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    housing: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    transport: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    other_allowances: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    gross_pay: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    paye: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    pension_employee: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    pension_employer: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    health_insurance: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    other_deductions: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    total_deductions: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    net_pay: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    payment_status: Mapped[str] = mapped_column(String(20), nullable=False, default="PENDING")
    payment_reference: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("payment_status IN ('PENDING','PAID','HELD')", name="ck_payroll_line_payment_status"),
    )

    run: Mapped[PayrollRun] = relationship("PayrollRun", back_populates="lines")


class Payslip(Base):
    """Issued payslip record for one employee for one payroll run."""

    __tablename__ = "payslips"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("payroll_runs.id", ondelete="CASCADE"), nullable=False, index=True)
    payroll_line_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("payroll_lines.id", ondelete="CASCADE"), nullable=False)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="RESTRICT"), nullable=False, index=True)
    reference: Mapped[str] = mapped_column(String(50), nullable=False)
    payslip_date: Mapped[date] = mapped_column(Date, nullable=False)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    gross_pay: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    total_deductions: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    net_pay: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("tenant_id", "reference", name="uq_payslip_reference"),
    )

    run: Mapped[PayrollRun] = relationship("PayrollRun", back_populates="payslips")


class LeaveType(Base):
    """A leave category definition for a tenant (Annual, Sick, Maternity, etc.)."""

    __tablename__ = "leave_types"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    days_per_year: Mapped[Decimal] = mapped_column(Numeric(5, 1), nullable=False, default=Decimal("0"))
    carry_forward: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    max_carry_forward_days: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 1), nullable=True)
    requires_approval: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_paid: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_leave_type_code"),
    )

    requests: Mapped[list[LeaveRequest]] = relationship("LeaveRequest", back_populates="leave_type")
    balances: Mapped[list[LeaveBalance]] = relationship("LeaveBalance", back_populates="leave_type")


class LeaveRequest(Base):
    """An employee's leave application."""

    __tablename__ = "leave_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    leave_type_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("leave_types.id", ondelete="RESTRICT"), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    days_requested: Mapped[Decimal] = mapped_column(Numeric(5, 1), nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="PENDING")
    approved_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("status IN ('PENDING','APPROVED','REJECTED','CANCELLED')", name="ck_leave_request_status"),
    )

    leave_type: Mapped[LeaveType] = relationship("LeaveType", back_populates="requests")


class LeaveBalance(Base):
    """Per-employee per-year leave balance tracker."""

    __tablename__ = "leave_balances"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    leave_type_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("leave_types.id", ondelete="CASCADE"), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    allocated: Mapped[Decimal] = mapped_column(Numeric(5, 1), nullable=False, default=Decimal("0"))
    taken: Mapped[Decimal] = mapped_column(Numeric(5, 1), nullable=False, default=Decimal("0"))
    pending: Mapped[Decimal] = mapped_column(Numeric(5, 1), nullable=False, default=Decimal("0"))
    carried_forward: Mapped[Decimal] = mapped_column(Numeric(5, 1), nullable=False, default=Decimal("0"))
    remaining: Mapped[Decimal] = mapped_column(Numeric(5, 1), nullable=False, default=Decimal("0"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("tenant_id", "employee_id", "leave_type_id", "year", name="uq_leave_balance"),
    )

    leave_type: Mapped[LeaveType] = relationship("LeaveType", back_populates="balances")
