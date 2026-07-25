"""
Purchase Order, GRN, and 3-Way Match Pydantic schemas — M11b.

Covers:
  PurchaseOrderLineIn / PurchaseOrderCreate / PurchaseOrderUpdate / PurchaseOrderResponse / PurchaseOrderDetail
  GrnLineIn / GrnCreate / GrnResponse / GrnDetail
  MatchLineIn / MatchCreateBody / MatchResponse / MatchReportRow
  PoToleranceConfigUpdate / PoToleranceConfigResponse
  PoActionBody (approve / reject)
  PoApprovalResponse

All Decimal fields use str-serialisable Decimal type to avoid float precision loss in JSON.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


# ─────────────────────────────────────────────────────────────────────────────
# Purchase Order Schemas
# ─────────────────────────────────────────────────────────────────────────────

class PurchaseOrderLineIn(BaseModel):
    """One line item on a Purchase Order (create/update)."""
    line_number: int
    description: str
    unit_of_measure: str = "units"
    quantity_ordered: Decimal = Decimal("1")
    unit_price: Decimal = Decimal("0")
    gl_account_id: Optional[uuid.UUID] = None
    dimension_values: Optional[dict] = None
    vat_applicable: bool = False
    vat_rate: Decimal = Decimal("0")
    wht_applicable: bool = False
    wht_rate: Decimal = Decimal("0")
    category_hint: Optional[str] = None


class PurchaseOrderCreate(BaseModel):
    """Fields required to create a new Purchase Order (DRAFT)."""
    vendor_id: uuid.UUID
    title: str
    delivery_date: Optional[date] = None
    delivery_address: Optional[str] = None
    currency: str = "NGN"
    exchange_rate: Decimal = Decimal("1")
    notes: Optional[str] = None
    department_id: Optional[uuid.UUID] = None
    lines: list[PurchaseOrderLineIn] = Field(default_factory=list)


class PurchaseOrderUpdate(BaseModel):
    """All fields optional — only allowed on DRAFT POs."""
    vendor_id: Optional[uuid.UUID] = None
    title: Optional[str] = None
    delivery_date: Optional[date] = None
    delivery_address: Optional[str] = None
    currency: Optional[str] = None
    exchange_rate: Optional[Decimal] = None
    notes: Optional[str] = None
    department_id: Optional[uuid.UUID] = None
    lines: Optional[list[PurchaseOrderLineIn]] = None


class PurchaseOrderLineResponse(BaseModel):
    """PO line as returned from the API."""
    id: uuid.UUID
    po_id: uuid.UUID
    line_number: int
    description: str
    unit_of_measure: str
    quantity_ordered: Decimal
    unit_price: Decimal
    amount_foreign: Decimal
    amount_base: Decimal
    quantity_received: Decimal
    quantity_invoiced: Decimal
    gl_account_id: Optional[uuid.UUID]
    dimension_values: Optional[dict]
    vat_applicable: bool
    vat_rate: Decimal
    wht_applicable: bool
    wht_rate: Decimal
    category_hint: Optional[str]

    model_config = {"from_attributes": True}


class PurchaseOrderResponse(BaseModel):
    """PO summary (list view)."""
    id: uuid.UUID
    tenant_id: uuid.UUID
    vendor_id: uuid.UUID
    po_number: str
    title: str
    status: str
    currency: str
    total_amount_foreign: Decimal
    total_amount_base: Decimal
    amount_received: Decimal
    amount_invoiced: Decimal
    delivery_date: Optional[date]
    created_at: datetime
    submitted_at: Optional[datetime]
    approved_at: Optional[datetime]

    model_config = {"from_attributes": True}


class PurchaseOrderDetail(PurchaseOrderResponse):
    """Full PO with lines and approval history (detail view)."""
    requester_id: Optional[uuid.UUID]
    department_id: Optional[uuid.UUID]
    delivery_address: Optional[str]
    exchange_rate: Decimal
    notes: Optional[str]
    posting_mode: Optional[str]
    submitted_by: Optional[uuid.UUID]
    approved_by: Optional[uuid.UUID]
    rejected_at: Optional[datetime]
    rejected_by: Optional[uuid.UUID]
    rejection_reason: Optional[str]
    sent_at: Optional[datetime]
    closed_at: Optional[datetime]
    cancelled_at: Optional[datetime]
    journal_entry_id: Optional[uuid.UUID]
    posting_batch_id: Optional[uuid.UUID]
    updated_at: datetime
    lines: list[PurchaseOrderLineResponse] = Field(default_factory=list)
    approvals: list["PoApprovalResponse"] = Field(default_factory=list)

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────────────────────
# PO Approval Schemas
# ─────────────────────────────────────────────────────────────────────────────

class PoApprovalResponse(BaseModel):
    """One approval step record."""
    id: uuid.UUID
    po_id: uuid.UUID
    step_order: int
    approver_id: Optional[uuid.UUID]
    role_id: Optional[uuid.UUID]
    status: str
    is_advisory: bool
    action_at: Optional[datetime]
    comment: Optional[str]

    model_config = {"from_attributes": True}


class PoActionBody(BaseModel):
    """Body for approve / reject actions on a PO."""
    comment: Optional[str] = None


class PoRejectBody(BaseModel):
    """Body for rejecting a PO — rejection_reason is required."""
    rejection_reason: str
    comment: Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────────
# GRN Schemas
# ─────────────────────────────────────────────────────────────────────────────

class GrnLineIn(BaseModel):
    """One received line item on a GRN."""
    po_line_id: uuid.UUID
    line_number: int
    description: str
    quantity_received: Decimal = Decimal("0")
    condition_notes: Optional[str] = None


class GrnCreate(BaseModel):
    """Fields required to create a new GRN (DRAFT)."""
    po_id: uuid.UUID
    receipt_date: date
    delivery_note_number: Optional[str] = None
    notes: Optional[str] = None
    lines: list[GrnLineIn] = Field(default_factory=list)


class GrnLineResponse(BaseModel):
    """GRN line as returned from API."""
    id: uuid.UUID
    grn_id: uuid.UUID
    po_line_id: uuid.UUID
    line_number: int
    description: str
    quantity_received: Decimal
    unit_price_on_po: Decimal
    amount_base: Decimal
    condition_notes: Optional[str]

    model_config = {"from_attributes": True}


class GrnResponse(BaseModel):
    """GRN summary (list view)."""
    id: uuid.UUID
    tenant_id: uuid.UUID
    po_id: uuid.UUID
    grn_number: str
    receipt_date: date
    status: str
    delivery_note_number: Optional[str]
    confirmed_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class GrnDetail(GrnResponse):
    """Full GRN with lines."""
    received_by: Optional[uuid.UUID]
    notes: Optional[str]
    confirmed_by: Optional[uuid.UUID]
    grni_journal_entry_id: Optional[uuid.UUID]
    grni_posting_batch_id: Optional[uuid.UUID]
    created_by: Optional[uuid.UUID]
    lines: list[GrnLineResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────────────────────
# 3-Way Match Schemas
# ─────────────────────────────────────────────────────────────────────────────

class MatchLineIn(BaseModel):
    """
    One match pairing when creating/recording a 3-way match.

    invoice_line_id — the AP invoice line being matched
    grn_line_id     — the GRN line confirming receipt
    matched_quantity — how many units this match covers
                       (can be partial: one invoice line ↔ multiple GRN lines)
    """
    invoice_line_id: uuid.UUID
    grn_line_id: uuid.UUID
    matched_quantity: Decimal


class MatchCreateBody(BaseModel):
    """
    Body to create 3-way match records for an invoice.

    invoice_id is the parent invoice. Each entry in matches pairs one
    invoice line with one GRN line. The match engine computes variance
    and match_status automatically.
    """
    invoice_id: uuid.UUID
    matches: list[MatchLineIn]


class MatchOverrideBody(BaseModel):
    """Body to manually override a match status to MANUAL_OVERRIDE."""
    override_comment: str


class MatchResponse(BaseModel):
    """One match record returned from API."""
    id: uuid.UUID
    tenant_id: uuid.UUID
    invoice_id: uuid.UUID
    invoice_line_id: uuid.UUID
    grn_id: uuid.UUID
    grn_line_id: uuid.UUID
    po_id: uuid.UUID
    po_line_id: uuid.UUID
    matched_quantity: Decimal
    matched_amount_base: Decimal
    price_variance: Decimal
    price_variance_pct: Decimal
    qty_variance: Decimal
    match_status: str
    override_comment: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class MatchReportRow(BaseModel):
    """
    One row in the match report — aggregated per invoice.

    Used by GET /api/po/match-report to give AP staff a status overview
    of all matched invoices: how many lines matched clean, how many have
    variances, whether payment is blocked.
    """
    invoice_id: uuid.UUID
    invoice_reference: str
    vendor_name: str
    total_invoice_amount: Decimal
    total_matched_amount: Decimal
    line_count: int
    clean_match_count: int
    variance_count: int
    payment_blocked: bool
    match_statuses: list[str]


# ─────────────────────────────────────────────────────────────────────────────
# Tolerance Config Schemas
# ─────────────────────────────────────────────────────────────────────────────

class PoToleranceConfigUpdate(BaseModel):
    """Fields to update tolerance config (all optional for PATCH)."""
    price_tolerance_pct: Optional[Decimal] = None
    qty_tolerance_pct: Optional[Decimal] = None
    auto_approve_within_tolerance: Optional[bool] = None
    block_payment_on_variance: Optional[bool] = None


class PoToleranceConfigResponse(BaseModel):
    """Tolerance config as returned from API."""
    id: uuid.UUID
    tenant_id: uuid.UUID
    price_tolerance_pct: Decimal
    qty_tolerance_pct: Decimal
    auto_approve_within_tolerance: bool
    block_payment_on_variance: bool
    updated_at: datetime

    model_config = {"from_attributes": True}
