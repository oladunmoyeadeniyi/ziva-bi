"""
Accounts Payable (AP) models — M11.

Five tables:
  vendors              — supplier master per tenant
  ap_invoices          — AP invoice/bill headers
  ap_invoice_lines     — line items (GL, dimensions, VAT, WHT)
  ap_approvals         — per-step approval audit trail
  ap_invoice_snapshots — immutable JSONB snapshot at submission

Three-mode routing (posting_mode snapshot on each invoice):
  Lite       → workflow + CSV/Excel export only
  Connected  → + GL coding per line + posting_batches entry on approval
  Full ERP   → + journal_entry on approval + payment_journal_entry on payment
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


class Vendor(Base):
    """
    Supplier master record — one per vendor per tenant.

    vendor_type controls which tax rules apply (standard, event_agency,
    clearing_agent, three_pl, professional_service, insurance, non_resident, etc.).
    These types drive future WHT/VAT automation (M19 Tax Engine).

    Soft-delete via is_active flag — deactivated vendors cannot be selected
    on new invoices but their historical invoices remain visible.
    """

    __tablename__ = "vendors"
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_vendor_code_tenant"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    vendor_type: Mapped[str] = mapped_column(String(50), nullable=False, default="standard", comment="standard | event_agency | clearing_agent | three_pl | professional_service | insurance | non_resident | one_time")
    tax_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, comment="RC number / TIN / tax registration")
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    bank_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    bank_account_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    bank_sort_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Vendor portal (migration w6x7y8z9a0b1)
    portal_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    portal_token: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # relationships
    invoices: Mapped[list["ApInvoice"]] = relationship("ApInvoice", back_populates="vendor", lazy="select")


class ApInvoice(Base):
    """
    AP invoice / vendor bill header.

    Status lifecycle:
      DRAFT → SUBMITTED → APPROVED → PAID
      DRAFT → CANCELLED
      SUBMITTED → REJECTED  (reverts to DRAFT for correction)

    Three-mode fields:
      - posting_mode       : snapshot of tenant mode at submission time
      - gl_account_id      : on lines (Connected + Full ERP)
      - journal_entry_id   : populated on approval (Full ERP only)
      - payment_journal_entry_id : populated on payment (Full ERP only)
      - posting_batch_id   : populated on approval (Connected only)

    Financial totals:
      - total_amount_foreign : sum of line amounts in invoice currency
      - total_amount_base    : converted to functional currency
      - total_vat            : sum of VAT across lines
      - total_wht            : sum of WHT across lines
      - net_payable          : total_amount_base - total_wht (amount vendor receives)
    """

    __tablename__ = "ap_invoices"
    __table_args__ = (
        UniqueConstraint("tenant_id", "vendor_id", "invoice_number", name="uq_ap_invoice_number_vendor"),
        CheckConstraint("status IN ('DRAFT','SUBMITTED','APPROVED','REJECTED','CANCELLED','PAID')", name="chk_ap_status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    vendor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=False)

    # identity
    reference: Mapped[str] = mapped_column(String(50), nullable=False, comment="Internal AP ref e.g. AP-2026-0001")
    invoice_number: Mapped[str] = mapped_column(String(100), nullable=False, comment="Vendor's invoice number")
    invoice_date: Mapped[date] = mapped_column(Date, nullable=False)
    received_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    # amounts
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="NGN")
    exchange_rate: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False, default=Decimal("1"))
    total_amount_foreign: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    total_amount_base: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    total_vat: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    total_wht: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    net_payable: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))

    # metadata
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="DRAFT")
    posting_mode: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    duplicate_flag: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_advance_settlement: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

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

    # payment
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    paid_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    payment_reference: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    payment_bank_account_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("bank_accounts.id", ondelete="SET NULL"), nullable=True)

    # Full ERP GL links
    journal_entry_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("journal_entries.id", ondelete="SET NULL"), nullable=True)
    payment_journal_entry_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("journal_entries.id", ondelete="SET NULL"), nullable=True)

    # Connected posting batch
    posting_batch_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("posting_batches.id", ondelete="SET NULL"), nullable=True)

    # audit
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # relationships
    vendor: Mapped["Vendor"] = relationship("Vendor", back_populates="invoices")
    lines: Mapped[list["ApInvoiceLine"]] = relationship("ApInvoiceLine", back_populates="invoice", cascade="all, delete-orphan", order_by="ApInvoiceLine.line_number")
    approvals: Mapped[list["ApApproval"]] = relationship("ApApproval", back_populates="invoice", cascade="all, delete-orphan", order_by="ApApproval.step_order")
    snapshots: Mapped[list["ApInvoiceSnapshot"]] = relationship("ApInvoiceSnapshot", back_populates="invoice", cascade="all, delete-orphan")


class ApInvoiceLine(Base):
    """
    One line item on an AP invoice.

    GL coding fields (gl_account_id, dimension_values) are populated in
    Connected and Full ERP modes. In Lite mode they are left NULL.

    Tax fields:
      vat_applicable / vat_rate / vat_amount  — VAT on this line
      wht_applicable / wht_rate / wht_amount  — WHT deducted from this line
      net_payable_line                         — amount_base - wht_amount

    The tax fields store the computed values; the rates come from the
    tenant tax configuration (M8.4) filtered by vendor_type. In M11 v1
    the rates are entered manually; M19 (Tax Engine) will automate this.
    """

    __tablename__ = "ap_invoice_lines"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("ap_invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    line_number: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("1"))
    unit_price: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    amount_foreign: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    amount_base: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))

    # GL coding
    gl_account_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("chart_of_accounts.id", ondelete="SET NULL"), nullable=True)
    dimension_values: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # VAT
    vat_applicable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    vat_rate: Mapped[Decimal] = mapped_column(Numeric(6, 4), nullable=False, default=Decimal("0"))
    vat_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))

    # WHT
    wht_applicable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    wht_rate: Mapped[Decimal] = mapped_column(Numeric(6, 4), nullable=False, default=Decimal("0"))
    wht_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))

    # net payable for this line
    net_payable_line: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))

    # optional category hint (Lite mode reporting)
    category_hint: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # relationships
    invoice: Mapped["ApInvoice"] = relationship("ApInvoice", back_populates="lines")


class ApApproval(Base):
    """
    One approval action record per step per AP invoice.

    Mirrors expense_approvals. Each step_order maps to a step in the
    approval chain built by the existing routing service. The routing
    service uses the submitter's designation + invoice total to determine
    the chain (ceiling + finance review chain for the 'procurement' function).

    is_advisory: True → non-blocking; advance to next step regardless of decision.
    """

    __tablename__ = "ap_approvals"
    __table_args__ = (
        CheckConstraint(
            "status IN ('PENDING','APPROVED','REJECTED','REFERRED_BACK','SKIPPED')",
            name="chk_ap_approval_status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("ap_invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    step_order: Mapped[int] = mapped_column(Integer, nullable=False)
    approver_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    role_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("approval_roles.id", ondelete="SET NULL"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="PENDING")
    is_advisory: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    action_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # relationships
    invoice: Mapped["ApInvoice"] = relationship("ApInvoice", back_populates="approvals")


class ApInvoiceSnapshot(Base):
    """
    Immutable JSONB snapshot of the full invoice + lines at time of submission.

    Written once on SUBMIT and never updated. Provides a tamper-proof
    audit record of exactly what was approved. Mirrors expense_report_snapshots.
    """

    __tablename__ = "ap_invoice_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("ap_invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    snapshot_data: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # relationships
    invoice: Mapped["ApInvoice"] = relationship("ApInvoice", back_populates="snapshots")
