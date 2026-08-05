"""Petty Cash ORM models.

What this module does:
  PettyCashFund        — a named cash float held by a custodian employee.
  PettyCashTransaction — a debit (DISBURSEMENT) or credit (RETIREMENT/REPLENISHMENT/ADJUSTMENT)
                         against a fund.

How it connects:
  employees           ← custodian of the fund + per-transaction employee
  chart_of_accounts   ← gl_account_id (the cash account) + expense_gl_account_id
  journal_entries     ← optional GL posting for Full-ERP tenants
  users               ← recorded_by / approved_by / created_by
"""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Boolean, DateTime, Date, ForeignKey, Index, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PettyCashFund(Base):
    """A petty cash fund (physical cash float).

    Parameters:
        name                — descriptive name, e.g. "Head Office Petty Cash"
        custodian_id        — employee responsible for the fund
        gl_account_id       — balance-sheet cash account in CoA
        expense_gl_account_id — default expense account for disbursements
        currency_code       — ISO 4217 code (default NGN)
        float_amount        — authorised maximum float
        current_balance     — running balance (updated on every transaction)
        is_active           — soft disable without deleting history
    """

    __tablename__ = "petty_cash_funds"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text(), nullable=True)
    custodian_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)
    gl_account_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("chart_of_accounts.id", ondelete="SET NULL"), nullable=True)
    expense_gl_account_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("chart_of_accounts.id", ondelete="SET NULL"), nullable=True)
    currency_code: Mapped[str] = mapped_column(String(3), nullable=False, default="NGN")
    float_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    current_balance: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    is_active: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(), server_default=func.now(), onupdate=func.now(), nullable=False)

    transactions: Mapped[list["PettyCashTransaction"]] = relationship(
        "PettyCashTransaction", back_populates="fund", lazy="select"
    )

    __table_args__ = (Index("ix_petty_cash_funds_tenant_id", "tenant_id"),)


class PettyCashTransaction(Base):
    """A single debit or credit against a petty cash fund.

    transaction_type:
        DISBURSEMENT    — cash given out to an employee (reduces balance)
        RETIREMENT      — employee submits receipts to account for cash received (no balance change; clears outstanding)
        REPLENISHMENT   — finance tops up the fund from the main bank account (increases balance)
        ADJUSTMENT      — manual correction with notes

    Parameters:
        balance_after   — snapshot of fund.current_balance immediately after this transaction
        expense_report_id — soft link to an expense_report (no FK, loose UUID to avoid circular import)
    """

    __tablename__ = "petty_cash_transactions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    fund_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("petty_cash_funds.id", ondelete="RESTRICT"), nullable=False)
    transaction_type: Mapped[str] = mapped_column(String(20), nullable=False)
    employee_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    reference: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    transaction_date: Mapped[date] = mapped_column(Date(), nullable=False)
    expense_report_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    journal_entry_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("journal_entries.id", ondelete="SET NULL"), nullable=True)
    balance_after: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    recorded_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text(), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(), server_default=func.now(), nullable=False)

    fund: Mapped["PettyCashFund"] = relationship("PettyCashFund", back_populates="transactions", lazy="select")

    __table_args__ = (
        Index("ix_pct_tenant_id", "tenant_id"),
        Index("ix_pct_fund_id", "fund_id"),
        Index("ix_pct_txn_date", "transaction_date"),
    )
