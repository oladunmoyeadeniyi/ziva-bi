"""Payment ORM models.

What this module does:
  ExpensePaymentConfig  — per-tenant payment mode (MANUAL | PAYSTACK) + encrypted API keys
  EmployeeBankAccount   — bank account registered for an employee (used as Paystack recipient)
  ExpensePayment        — payment record for an approved expense report

How it connects:
  tenants             ← tenant_id on all tables
  employees           ← employee_id on bank accounts + payments
  users               ← initiated_by / approved_by / created_by

Security note:
  paystack_secret_key_encrypted is ENCRYPTED AT REST — never committed, never logged.
  The service layer handles encrypt/decrypt using PAYMENT_ENCRYPTION_KEY env var.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ExpensePaymentConfig(Base):
    """Per-tenant payment configuration (one row per tenant)."""

    __tablename__ = "expense_payment_configs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, unique=True)
    payment_mode: Mapped[str] = mapped_column(String(20), nullable=False, default="MANUAL")
    paystack_secret_key_encrypted: Mapped[Optional[str]] = mapped_column(Text(), nullable=True)
    paystack_public_key_encrypted: Mapped[Optional[str]] = mapped_column(Text(), nullable=True)
    paystack_subaccount: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (Index("ix_epc_tenant_id", "tenant_id"),)


class EmployeeBankAccount(Base):
    """Bank account registered for reimbursement payments."""

    __tablename__ = "employee_bank_accounts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    bank_name: Mapped[str] = mapped_column(String(100), nullable=False)
    bank_code: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    account_number: Mapped[str] = mapped_column(String(20), nullable=False)
    account_name: Mapped[str] = mapped_column(String(200), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="NGN")
    is_primary: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True)
    paystack_recipient_code: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_verified: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=False)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(), server_default=func.now(), nullable=False)

    payments: Mapped[list["ExpensePayment"]] = relationship("ExpensePayment", back_populates="bank_account", lazy="select")

    __table_args__ = (
        Index("ix_eba_tenant_id", "tenant_id"),
        Index("ix_eba_employee_id", "employee_id"),
    )


class ExpensePayment(Base):
    """Payment record for an approved expense report.

    status lifecycle:
        QUEUED → PROCESSING → PAID       (successful path)
                            → FAILED     (Paystack transfer failed)
                → CANCELLED              (manually cancelled before processing)
    """

    __tablename__ = "expense_payments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    expense_report_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)  # soft link — no FK
    employee_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)
    bank_account_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("employee_bank_accounts.id", ondelete="SET NULL"), nullable=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="NGN")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="QUEUED")
    paystack_transfer_code: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    paystack_reference: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, unique=True)
    paystack_response: Mapped[Optional[str]] = mapped_column(Text(), nullable=True)
    failure_reason: Mapped[Optional[str]] = mapped_column(Text(), nullable=True)
    payment_date: Mapped[Optional[date]] = mapped_column(Date(), nullable=True)
    payment_reference: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    payment_notes: Mapped[Optional[str]] = mapped_column(Text(), nullable=True)
    initiated_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(), server_default=func.now(), onupdate=func.now(), nullable=False)

    bank_account: Mapped[Optional["EmployeeBankAccount"]] = relationship("EmployeeBankAccount", back_populates="payments", lazy="select")

    __table_args__ = (
        Index("ix_ep_tenant_id", "tenant_id"),
        Index("ix_ep_expense_report_id", "expense_report_id"),
        Index("ix_ep_status", "status"),
    )
