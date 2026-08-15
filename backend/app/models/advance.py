"""
PRAD — Employee Advance & Retirement ORM models.

Tables:
    employee_advances           Advance request lifecycle (DRAFT → ISSUED → RETIRED)
    advance_retirements         Retirement submission (employee accounts for spend)
    advance_retirement_lines    Individual line items within a retirement

Business logic:
    - An advance must be ISSUED (cash disbursed) before it can be retired.
    - A retirement links back to exactly one advance.
    - Multiple partial retirements are allowed until the advance is FULLY_RETIRED.
    - balance on the retirement = total_claimed - advance_amount.
      Positive → company reimburses employee (overspend).
      Negative → employee refunds company (underspend).

Three-mode GL treatment:
    Lite      — no GL posting; advance is tracked for workflow only.
    Connected — advance issuance creates a posting_batch row for the external ERP.
    Full ERP  — advance issuance: DR Employee Advance / CR Cash.
                retirement:       DR Expense GL(s)     / CR Employee Advance.
                overspend:        DR Expense            / CR Employee Payable.
                underspend:       DR Employee Payable   / CR Employee Advance.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Boolean, Date, DateTime, ForeignKey, Index, Numeric,
    String, Text, Integer, func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class EmployeeAdvance(Base):
    """
    An employee's request for a cash advance.

    Status flow:
        DRAFT → SUBMITTED → APPROVED → ISSUED → PARTIALLY_RETIRED → FULLY_RETIRED
        DRAFT → SUBMITTED → REJECTED
        DRAFT / SUBMITTED → CANCELLED

    Parameters:
        advance_number     Auto-assigned reference (ADV-YYYY-NNNN).
        advance_type       TRAVEL | OPERATIONAL | OTHER.
        purpose            Free-text description of what the advance is for.
        amount             Total advance requested.
        due_retirement_date  Tenant-configured deadline to retire the advance.
        total_retired      Running sum of approved retirement amounts; updated on each
                           approved retirement posting.
        gl_advance_account_id  Balance-sheet clearing account (Employee Advance).
        gl_cash_account_id     Cash / bank account to credit on issuance.
    """

    __tablename__ = "employee_advances"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    advance_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    advance_type: Mapped[str] = mapped_column(String(30), nullable=False, default="TRAVEL")
    purpose: Mapped[str] = mapped_column(Text(), nullable=False)

    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="NGN")

    status: Mapped[str] = mapped_column(String(30), nullable=False, default="DRAFT")

    request_date: Mapped[date] = mapped_column(Date(), nullable=False)
    required_by_date: Mapped[Optional[date]] = mapped_column(Date(), nullable=True)
    due_retirement_date: Mapped[Optional[date]] = mapped_column(Date(), nullable=True)

    # Approval chain — mirrors expense_reports
    current_approval_level: Mapped[Optional[int]] = mapped_column(Integer(), nullable=True)
    rejection_comment: Mapped[Optional[str]] = mapped_column(Text(), nullable=True)
    rejected_at_level: Mapped[Optional[int]] = mapped_column(Integer(), nullable=True)

    # GL accounts (Full ERP mode; nullable for Lite / Connected tenants)
    gl_advance_account_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chart_of_accounts.id", ondelete="SET NULL"), nullable=True
    )
    gl_cash_account_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chart_of_accounts.id", ondelete="SET NULL"), nullable=True
    )

    # Issuance tracking
    issued_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    issued_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Running retirement total (updated on each approved retirement)
    total_retired: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))

    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text(), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    retirements: Mapped[list["AdvanceRetirement"]] = relationship(
        "AdvanceRetirement", back_populates="advance", lazy="select"
    )

    __table_args__ = (
        Index("ix_employee_advances_tenant_id",   "tenant_id"),
        Index("ix_employee_advances_employee_id", "employee_id"),
        Index("ix_employee_advances_status",      "status"),
    )


class AdvanceRetirement(Base):
    """
    A retirement submission — the employee accounts for how the advance was spent.

    One advance can have multiple partial retirements until fully_retired.
    The balance field records (total_claimed - advance_amount):
        positive  → overspent → company reimburses employee
        negative  → underspent → employee refunds company
        zero      → exactly on budget

    Parameters:
        retirement_number   Auto-assigned reference (RET-YYYY-NNNN).
        advance_amount      Snapshot of employee_advance.amount at retirement time.
        total_claimed       Sum of approved retirement line amounts.
        balance             total_claimed - advance_amount (computed by router).
        journal_entry_id    Loose UUID ref to journal_entries (no FK to avoid circular import).
        posting_batch_id    Loose UUID ref to posting_batches (Connected mode).
    """

    __tablename__ = "advance_retirements"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    advance_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employee_advances.id", ondelete="CASCADE"), nullable=False
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    retirement_number: Mapped[str] = mapped_column(String(50), nullable=False)
    retirement_date: Mapped[date] = mapped_column(Date(), nullable=False)

    advance_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    total_claimed: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    balance: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))

    status: Mapped[str] = mapped_column(String(30), nullable=False, default="DRAFT")
    current_approval_level: Mapped[Optional[int]] = mapped_column(Integer(), nullable=True)
    rejection_comment: Mapped[Optional[str]] = mapped_column(Text(), nullable=True)
    rejected_at_level: Mapped[Optional[int]] = mapped_column(Integer(), nullable=True)

    # GL posting refs (loose UUIDs — avoids circular FK with journal_entries / posting_batches)
    journal_entry_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    posting_batch_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)

    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    posted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text(), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    advance: Mapped["EmployeeAdvance"] = relationship("EmployeeAdvance", back_populates="retirements", lazy="select")
    lines: Mapped[list["AdvanceRetirementLine"]] = relationship(
        "AdvanceRetirementLine", back_populates="retirement", lazy="select"
    )

    __table_args__ = (
        Index("ix_advance_retirements_tenant_id",  "tenant_id"),
        Index("ix_advance_retirements_advance_id", "advance_id"),
        Index("ix_advance_retirements_employee",   "employee_id"),
        Index("ix_advance_retirements_status",     "status"),
    )


class AdvanceRetirementLine(Base):
    """
    A single expense item within a retirement submission.

    Mirrors expense_lines in structure: amount, GL code, dimension values, category.

    Parameters:
        gl_id             FK → chart_of_accounts (Full ERP mode).
        dimension_values  JSONB {dimension_id: value_id} per-line selections.
        category_id       Loose UUID ref → expense_categories (no FK to avoid cross-module import).
        subcategory_id    Loose UUID ref → expense_categories.
    """

    __tablename__ = "advance_retirement_lines"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    retirement_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("advance_retirements.id", ondelete="CASCADE"), nullable=False
    )
    advance_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employee_advances.id", ondelete="CASCADE"), nullable=False
    )

    description: Mapped[str] = mapped_column(String(500), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="NGN")
    receipt_date: Mapped[Optional[date]] = mapped_column(Date(), nullable=True)

    # GL coding
    gl_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chart_of_accounts.id", ondelete="SET NULL"), nullable=True
    )
    dimension_values: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Category (loose UUID refs — no FK to avoid cross-module circular import)
    category_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    subcategory_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    retirement: Mapped["AdvanceRetirement"] = relationship("AdvanceRetirement", back_populates="lines", lazy="select")

    __table_args__ = (
        Index("ix_arl_tenant_id",     "tenant_id"),
        Index("ix_arl_retirement_id", "retirement_id"),
    )
