"""
Accounts Receivable (AR) models — M14.

Five tables:
  customers              — customer master per tenant
  ar_invoices            — AR invoice headers
  ar_invoice_lines       — line items (GL, dimensions, VAT, WHT)
  ar_approvals           — per-step approval audit trail
  ar_invoice_snapshots   — immutable JSONB snapshot at submission

Three-mode routing (posting_mode snapshot on each invoice):
  Lite       → workflow + CSV/Excel export only
  Connected  → + GL coding per line + posting_batches entry on approval
  Full ERP   → + journal_entry on approval + receipt_journal_entry on receipt

Journal flows (Full ERP):
  On APPROVAL:
    DR  accounts_receivable (control)  invoice.net_receivable
    CR  <revenue GL per line>          line.amount_base  (one CR per line)

  On RECEIPT (customer pays):
    DR  <bank GL>              invoice.net_receivable
    CR  accounts_receivable    invoice.net_receivable

AR aging uses due_date to bucket outstanding invoices into
Current / 1–30 / 31–60 / 61–90 / 90+ day buckets per customer.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Boolean, CheckConstraint, Date, DateTime, ForeignKey,
    Integer, Numeric, String, Text, UniqueConstraint, func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Customer(Base):
    """
    Customer master record — one per customer per tenant.

    customer_type controls which tax rules apply (standard, government, ngo,
    corporate, individual, non_resident). These types drive future WHT/VAT
    automation (M19 Tax Engine).

    credit_terms drives automatic due_date computation on new invoices:
      net_30 / net_60 / net_90 — due_date = invoice_date + N days
      immediate                — due_date = invoice_date
      custom                   — due_date = invoice_date + credit_terms_days

    Soft-delete via is_active — deactivated customers cannot be selected on
    new invoices but their historical invoices remain visible.
    """

    __tablename__ = "customers"
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_customer_code_tenant"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(20), nullable=False, comment="Auto-generated C-{NNNN} if not supplied")
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    customer_type: Mapped[str] = mapped_column(String(50), nullable=False, default="standard", comment="standard | government | ngo | corporate | individual | non_resident")
    tax_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, comment="RC number / TIN / tax registration")
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    credit_limit: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True, comment="Maximum outstanding AR balance allowed; NULL = no limit")
    credit_terms: Mapped[Optional[str]] = mapped_column(String(30), nullable=True, comment="net_30 | net_60 | net_90 | immediate | custom")
    credit_terms_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment="Used when credit_terms='custom'")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # relationships
    invoices: Mapped[list["ArInvoice"]] = relationship("ArInvoice", back_populates="customer", lazy="select")


class ArInvoice(Base):
    """
    AR invoice / sales invoice header.

    Status lifecycle:
      DRAFT → SUBMITTED → APPROVED → RECEIVED
      DRAFT → CANCELLED
      SUBMITTED → REJECTED  (reverts to DRAFT for correction)

    Three-mode fields:
      - posting_mode             : snapshot of tenant mode at submission
      - gl_account_id on lines   : populated in Connected + Full ERP
      - journal_entry_id         : approval journal (Full ERP only)
      - receipt_journal_entry_id : receipt journal (Full ERP only)
      - posting_batch_id         : approval posting batch (Connected only)

    Financial totals:
      - total_amount_foreign : sum of line amounts in invoice currency
      - total_amount_base    : converted to functional currency
      - total_vat            : sum of VAT across lines
      - total_wht            : sum of WHT withheld by customer
      - net_receivable       : total_amount_base + total_vat - total_wht
                               (amount we actually receive from the customer)
    """

    __tablename__ = "ar_invoices"
    __table_args__ = (
        UniqueConstraint("tenant_id", "reference", name="uq_ar_invoice_reference"),
        CheckConstraint(
            "status IN ('DRAFT','SUBMITTED','APPROVED','REJECTED','CANCELLED','RECEIVED')",
            name="chk_ar_status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False, index=True)

    # identity
    reference: Mapped[str] = mapped_column(String(50), nullable=False, comment="Internal AR ref e.g. AR-2026-0001")
    invoice_number: Mapped[str] = mapped_column(String(100), nullable=False, comment="Customer-facing invoice number")
    invoice_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True, comment="Computed from credit_terms; editable")
    service_period_start: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    service_period_end: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    # amounts
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="NGN")
    exchange_rate: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False, default=Decimal("1"))
    total_amount_foreign: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    total_amount_base: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    total_vat: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    total_wht: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    net_receivable: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))

    # metadata
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="DRAFT")
    posting_mode: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    duplicate_flag: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # submission
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    submitted_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # approval
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    approved_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # rejection
    rejected_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    rejected_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # cancellation
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # receipt (customer payment received)
    received_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    received_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    receipt_reference: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    receipt_bank_account_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("bank_accounts.id", ondelete="SET NULL"), nullable=True)

    # Full ERP GL links
    journal_entry_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("journal_entries.id", ondelete="SET NULL"), nullable=True)
    receipt_journal_entry_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("journal_entries.id", ondelete="SET NULL"), nullable=True)

    # Connected posting batch
    posting_batch_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("posting_batches.id", ondelete="SET NULL"), nullable=True)

    # audit
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # relationships
    customer: Mapped["Customer"] = relationship("Customer", back_populates="invoices")
    lines: Mapped[list["ArInvoiceLine"]] = relationship("ArInvoiceLine", back_populates="invoice", cascade="all, delete-orphan", order_by="ArInvoiceLine.line_number")
    approvals: Mapped[list["ArApproval"]] = relationship("ArApproval", back_populates="invoice", cascade="all, delete-orphan", order_by="ArApproval.step_order")
    snapshots: Mapped[list["ArInvoiceSnapshot"]] = relationship("ArInvoiceSnapshot", back_populates="invoice", cascade="all, delete-orphan")


class ArInvoiceLine(Base):
    """
    One line item on an AR invoice.

    GL coding fields (gl_account_id, dimension_values) are populated in
    Connected and Full ERP modes. In Lite mode they are left NULL.

    Tax fields:
      vat_applicable / vat_rate / vat_amount    — output VAT on this line
      wht_applicable / wht_rate / wht_amount    — WHT withheld by the customer
      net_receivable_line                        — amount_base + vat_amount - wht_amount

    The rates are entered manually in M14; M19 (Tax Engine) will automate this.
    In Full ERP mode the GL account on each line should be a revenue (PL) account.
    """

    __tablename__ = "ar_invoice_lines"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("ar_invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    line_number: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("1"))
    unit_price: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    amount_foreign: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    amount_base: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))

    # GL coding
    gl_account_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("chart_of_accounts.id", ondelete="SET NULL"), nullable=True)
    dimension_values: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # VAT (output VAT on sales)
    vat_applicable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    vat_rate: Mapped[Decimal] = mapped_column(Numeric(6, 4), nullable=False, default=Decimal("0"))
    vat_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))

    # WHT (customer deducts WHT before paying)
    wht_applicable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    wht_rate: Mapped[Decimal] = mapped_column(Numeric(6, 4), nullable=False, default=Decimal("0"))
    wht_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))

    # net receivable for this line
    net_receivable_line: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))

    # optional category hint (Lite mode reporting)
    category_hint: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # relationships
    invoice: Mapped["ArInvoice"] = relationship("ArInvoice", back_populates="lines")


class ArApproval(Base):
    """
    One approval action record per step per AR invoice.

    Mirrors ap_approvals. Each step_order maps to a step in the approval
    chain built by the existing routing service (module key: 'receivable').

    is_advisory: True → non-blocking; advance to next step regardless of decision.
    """

    __tablename__ = "ar_approvals"
    __table_args__ = (
        CheckConstraint(
            "status IN ('PENDING','APPROVED','REJECTED','REFERRED_BACK','SKIPPED')",
            name="chk_ar_approval_status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("ar_invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    step_order: Mapped[int] = mapped_column(Integer, nullable=False)
    approver_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    role_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("approval_roles.id", ondelete="SET NULL"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="PENDING")
    is_advisory: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    action_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # relationships
    invoice: Mapped["ArInvoice"] = relationship("ArInvoice", back_populates="approvals")


class ArInvoiceSnapshot(Base):
    """
    Immutable JSONB snapshot of the full AR invoice + lines at time of submission.

    Written once on SUBMIT and never updated. Provides a tamper-proof audit
    record of exactly what was approved. Mirrors ap_invoice_snapshots.
    """

    __tablename__ = "ar_invoice_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("ar_invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    snapshot_data: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # relationships
    invoice: Mapped["ArInvoice"] = relationship("ArInvoice", back_populates="snapshots")
