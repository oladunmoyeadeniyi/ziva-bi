"""
Purchase Order, GRN, and 3-Way Match ORM models — M11b.

Eight tables:
  purchase_orders        — PO header per tenant
  purchase_order_lines   — line items (qty, price, GL coding)
  po_approvals           — per-step approval audit trail (mirrors ap_approvals)
  po_snapshots           — immutable JSONB snapshot at submission
  goods_receipt_notes    — GRN header (DRAFT → CONFIRMED)
  grn_lines              — received quantities per PO line
  ap_invoice_po_matches  — junction: invoice line ↔ GRN line (3-way match)
  po_tolerance_config    — per-tenant price/qty tolerance settings

Three-mode routing (posting_mode snapshotted at PO approval):
  Lite      → workflow + CSV export only; no GL
  Connected → + GL coding on lines + posting_batches on PO approval / GRN confirm
  Full ERP  → + journal entries (GRNI accrual on GRN; GRNI clearance on invoice match)

Key invariants:
  - grni role_key used: "grni" (already seeded in catalogue-redesign migration)
  - po_commitment role_key: "po_commitment" (seeded in M11b migration; default OFF)
  - GRN is immutable once CONFIRMED — same pattern as approved expense snapshots
  - 3-way match uses a junction table (N:M: one invoice line ↔ many GRN lines)
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


class PurchaseOrder(Base):
    """
    Purchase Order header — one per approved purchase request per tenant.

    Status lifecycle:
      DRAFT → SUBMITTED → APPROVED → SENT → PARTIALLY_RECEIVED → FULLY_RECEIVED → CLOSED
      SUBMITTED → REJECTED  (revert to DRAFT for edits)
      DRAFT / SUBMITTED / APPROVED → CANCELLED

    Three-mode fields:
      posting_mode       — snapshot of tenant posting mode at approval time
      journal_entry_id   — Full ERP commitment journal (optional; default OFF)
      posting_batch_id   — Connected mode batch

    Running totals updated as GRNs are confirmed:
      amount_received — sum(grn_line.amount_base) confirmed against this PO
      amount_invoiced — sum(matched_amount_base) from ap_invoice_po_matches
    """

    __tablename__ = "purchase_orders"
    __table_args__ = (
        UniqueConstraint("tenant_id", "po_number", name="uq_po_number_tenant"),
        CheckConstraint(
            "status IN ('DRAFT','SUBMITTED','APPROVED','REJECTED','SENT',"
            "'PARTIALLY_RECEIVED','FULLY_RECEIVED','CLOSED','CANCELLED')",
            name="chk_po_status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    vendor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=False, index=True)
    po_number: Mapped[str] = mapped_column(String(50), nullable=False)
    requester_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    department_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("org_structure.id", ondelete="SET NULL"), nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    delivery_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    delivery_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="NGN")
    exchange_rate: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False, default=Decimal("1"))
    total_amount_foreign: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    total_amount_base: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    amount_received: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    amount_invoiced: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="DRAFT")
    posting_mode: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Submission
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    submitted_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Approval
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    approved_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Rejection
    rejected_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    rejected_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Sent to vendor
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    sent_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Closed
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Cancelled
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # GL links
    journal_entry_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("journal_entries.id", ondelete="SET NULL"), nullable=True)
    posting_batch_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("posting_batches.id", ondelete="SET NULL"), nullable=True)

    # Audit
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    lines: Mapped[list["PurchaseOrderLine"]] = relationship("PurchaseOrderLine", back_populates="po", cascade="all, delete-orphan", lazy="select")
    approvals: Mapped[list["PoApproval"]] = relationship("PoApproval", back_populates="po", cascade="all, delete-orphan", lazy="select")
    snapshots: Mapped[list["PoSnapshot"]] = relationship("PoSnapshot", back_populates="po", cascade="all, delete-orphan", lazy="select")
    grns: Mapped[list["GoodsReceiptNote"]] = relationship("GoodsReceiptNote", back_populates="po", lazy="select")


class PurchaseOrderLine(Base):
    """
    Purchase Order line item.

    amount_foreign = quantity_ordered × unit_price
    amount_base    = amount_foreign × exchange_rate

    quantity_received and quantity_invoiced are running totals maintained by
    the GRN confirmation and invoice match processes respectively.

    gl_account_id is used in Connected and Full ERP modes. In Lite mode it
    is optional and only used for reporting (category_hint covers this case).
    """

    __tablename__ = "purchase_order_lines"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    po_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    line_number: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    unit_of_measure: Mapped[str] = mapped_column(String(30), nullable=False, default="units")
    quantity_ordered: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("1"))
    unit_price: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    amount_foreign: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    amount_base: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    quantity_received: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0"))
    quantity_invoiced: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0"))

    # GL coding (Connected + Full ERP)
    gl_account_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("chart_of_accounts.id", ondelete="SET NULL"), nullable=True)
    dimension_values: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Tax fields (for GRNI valuation and later invoice matching)
    vat_applicable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    vat_rate: Mapped[Decimal] = mapped_column(Numeric(6, 4), nullable=False, default=Decimal("0"))
    wht_applicable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    wht_rate: Mapped[Decimal] = mapped_column(Numeric(6, 4), nullable=False, default=Decimal("0"))

    # Lite mode reporting hint
    category_hint: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Relationships
    po: Mapped["PurchaseOrder"] = relationship("PurchaseOrder", back_populates="lines")
    grn_lines: Mapped[list["GrnLine"]] = relationship("GrnLine", back_populates="po_line", lazy="select")
    matches: Mapped[list["ApInvoicePoMatch"]] = relationship("ApInvoicePoMatch", back_populates="po_line", lazy="select")


class PoApproval(Base):
    """
    One approval action record per step per Purchase Order.

    Mirrors ap_approvals exactly. step_order maps to a step in the chain
    built by compute_chain(module='po'). is_advisory follows the same
    semantics as expense/AP advisory steps — does not block chain advance.
    """

    __tablename__ = "po_approvals"
    __table_args__ = (
        CheckConstraint(
            "status IN ('PENDING','APPROVED','REJECTED','REFERRED_BACK','SKIPPED')",
            name="chk_po_approval_status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    po_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    step_order: Mapped[int] = mapped_column(Integer, nullable=False)
    approver_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    role_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("approval_roles.id", ondelete="SET NULL"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="PENDING")
    is_advisory: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    action_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    po: Mapped["PurchaseOrder"] = relationship("PurchaseOrder", back_populates="approvals")


class PoSnapshot(Base):
    """
    Immutable JSONB snapshot of a PO written at submission time.

    Same pattern as ap_invoice_snapshots and expense submission snapshots.
    Once written, never modified. Provides a legal audit trail of what
    was approved regardless of subsequent edits (which are blocked on
    non-DRAFT POs anyway).
    """

    __tablename__ = "po_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    po_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    snapshot_data: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    po: Mapped["PurchaseOrder"] = relationship("PurchaseOrder", back_populates="snapshots")


class GoodsReceiptNote(Base):
    """
    Goods Receipt Note — records physical delivery of goods against a PO.

    GRN is a warehouse/operations event; it is created by the person who
    physically receives the goods (not finance). Once CONFIRMED it is
    immutable — confirmation triggers:
      1. Increment po_line.quantity_received for each GRN line
      2. Update purchase_orders.amount_received
      3. Advance PO status to PARTIALLY_RECEIVED or FULLY_RECEIVED
      4. Post GRNI accrual journal (Full ERP) or posting_batch (Connected)

    The grni_journal_entry_id and grni_posting_batch_id are populated by
    the po_posting service on confirmation.
    """

    __tablename__ = "goods_receipt_notes"
    __table_args__ = (
        UniqueConstraint("tenant_id", "grn_number", name="uq_grn_number_tenant"),
        CheckConstraint("status IN ('DRAFT','CONFIRMED')", name="chk_grn_status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    po_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("purchase_orders.id"), nullable=False, index=True)
    grn_number: Mapped[str] = mapped_column(String(50), nullable=False)
    received_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    receipt_date: Mapped[date] = mapped_column(Date, nullable=False)
    delivery_note_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="DRAFT")
    confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    confirmed_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    grni_journal_entry_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("journal_entries.id", ondelete="SET NULL"), nullable=True)
    grni_posting_batch_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("posting_batches.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    po: Mapped["PurchaseOrder"] = relationship("PurchaseOrder", back_populates="grns")
    lines: Mapped[list["GrnLine"]] = relationship("GrnLine", back_populates="grn", cascade="all, delete-orphan", lazy="select")
    matches: Mapped[list["ApInvoicePoMatch"]] = relationship("ApInvoicePoMatch", back_populates="grn", lazy="select")


class GrnLine(Base):
    """
    One delivery confirmation line per PO line per GRN.

    quantity_received: how many units were actually received in this GRN.
    unit_price_on_po: copied from po_line.unit_price at GRN creation time
                      to lock in the GRNI valuation regardless of PO edits.
    amount_base: quantity_received × unit_price_on_po × exchange_rate.

    The over-receipt guard in the router prevents quantity_received from
    exceeding po_line.quantity_ordered - po_line.quantity_received_so_far.
    """

    __tablename__ = "grn_lines"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    grn_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("goods_receipt_notes.id", ondelete="CASCADE"), nullable=False, index=True)
    po_line_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("purchase_order_lines.id"), nullable=False, index=True)
    line_number: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    quantity_received: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0"))
    unit_price_on_po: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    amount_base: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    condition_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    grn: Mapped["GoodsReceiptNote"] = relationship("GoodsReceiptNote", back_populates="lines")
    po_line: Mapped["PurchaseOrderLine"] = relationship("PurchaseOrderLine", back_populates="grn_lines")
    matches: Mapped[list["ApInvoicePoMatch"]] = relationship("ApInvoicePoMatch", back_populates="grn_line", lazy="select")


class ApInvoicePoMatch(Base):
    """
    3-Way Match record: links one AP invoice line to one GRN line.

    This is an N:M junction table — one invoice line can match to multiple
    GRN lines (split deliveries), and one GRN line can be partially matched
    to multiple invoice lines (partial billing).

    po_id and po_line_id are denormalised for query speed — they can be
    derived from grn_id → grn.po_id, but including them avoids the join.

    Variance fields are frozen at match creation time:
      price_variance     = invoice unit price − PO unit price (absolute)
      price_variance_pct = price_variance / po unit price (as fraction)
      qty_variance       = matched_quantity − grn_line.quantity_received

    match_status is computed by po_match_engine.compute_match_status()
    at match creation time and can be overridden by finance to MANUAL_OVERRIDE.
    """

    __tablename__ = "ap_invoice_po_matches"
    __table_args__ = (
        CheckConstraint(
            "match_status IN ('MATCHED','PRICE_VARIANCE','QTY_VARIANCE',"
            "'OVER_INVOICED','UNDER_INVOICED','MANUAL_OVERRIDE')",
            name="chk_match_status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    invoice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("ap_invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    invoice_line_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("ap_invoice_lines.id", ondelete="CASCADE"), nullable=False)
    grn_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("goods_receipt_notes.id"), nullable=False, index=True)
    grn_line_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("grn_lines.id"), nullable=False)
    po_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("purchase_orders.id"), nullable=False, index=True)
    po_line_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("purchase_order_lines.id"), nullable=False)
    matched_quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0"))
    matched_amount_base: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    price_variance: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    price_variance_pct: Mapped[Decimal] = mapped_column(Numeric(6, 4), nullable=False, default=Decimal("0"))
    qty_variance: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0"))
    match_status: Mapped[str] = mapped_column(String(30), nullable=False, default="MATCHED")
    override_comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    grn: Mapped["GoodsReceiptNote"] = relationship("GoodsReceiptNote", back_populates="matches")
    grn_line: Mapped["GrnLine"] = relationship("GrnLine", back_populates="matches")
    po_line: Mapped["PurchaseOrderLine"] = relationship("PurchaseOrderLine", back_populates="matches")


class PoToleranceConfig(Base):
    """
    Per-tenant 3-way match tolerance configuration.

    price_tolerance_pct: fraction (e.g. 0.02 = 2%). If the invoice unit price
        exceeds PO unit price by more than this fraction, match_status becomes
        PRICE_VARIANCE. Default 2%.

    qty_tolerance_pct: fraction. If matched_quantity exceeds GRN quantity by
        more than this fraction, match_status becomes QTY_VARIANCE. Default 5%.

    auto_approve_within_tolerance: if True, PRICE_VARIANCE / QTY_VARIANCE
        matches within tolerance are automatically set to MATCHED. Default OFF.

    block_payment_on_variance: if True, AP invoice payment is blocked when any
        match record has status PRICE_VARIANCE, QTY_VARIANCE, or OVER_INVOICED
        unless overridden. Default ON.
    """

    __tablename__ = "po_tolerance_config"
    __table_args__ = (
        UniqueConstraint("tenant_id", name="uq_po_tolerance_tenant"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    price_tolerance_pct: Mapped[Decimal] = mapped_column(Numeric(6, 4), nullable=False, default=Decimal("0.02"))
    qty_tolerance_pct: Mapped[Decimal] = mapped_column(Numeric(6, 4), nullable=False, default=Decimal("0.05"))
    auto_approve_within_tolerance: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    block_payment_on_variance: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    updated_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
