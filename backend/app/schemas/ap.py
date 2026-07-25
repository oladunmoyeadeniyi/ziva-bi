"""
Accounts Payable (AP) Pydantic schemas — M11.

Covers:
  VendorCreate / VendorUpdate / VendorResponse
  ApInvoiceLineIn / ApInvoiceCreate / ApInvoiceUpdate / ApInvoiceResponse / ApInvoiceDetail
  ApApprovalResponse
  ApAgeingRow / ApAgingResponse
  ApActionBody (approve / reject / pay)
"""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


# ── Vendor schemas ────────────────────────────────────────────────────────────

class VendorCreate(BaseModel):
    """Fields required to create a new vendor."""
    code: Optional[str] = None          # auto-generated if blank
    name: str
    vendor_type: str = "standard"
    tax_id: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_sort_code: Optional[str] = None
    notes: Optional[str] = None


class VendorUpdate(BaseModel):
    """All fields optional for PATCH."""
    name: Optional[str] = None
    vendor_type: Optional[str] = None
    tax_id: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_sort_code: Optional[str] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class VendorResponse(BaseModel):
    """Vendor returned from API."""
    id: uuid.UUID
    tenant_id: uuid.UUID
    code: str
    name: str
    vendor_type: str
    tax_id: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    address: Optional[str]
    bank_name: Optional[str]
    bank_account_number: Optional[str]
    bank_sort_code: Optional[str]
    is_active: bool
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Invoice line schemas ───────────────────────────────────────────────────────

class ApInvoiceLineIn(BaseModel):
    """One line item on an AP invoice (create/update)."""
    line_number: int
    description: str
    quantity: Decimal = Decimal("1")
    unit_price: Decimal = Decimal("0")
    amount_foreign: Decimal = Decimal("0")
    gl_account_id: Optional[uuid.UUID] = None
    dimension_values: Optional[dict] = None
    vat_applicable: bool = False
    vat_rate: Decimal = Decimal("0")
    wht_applicable: bool = False
    wht_rate: Decimal = Decimal("0")
    category_hint: Optional[str] = None


class ApInvoiceLineResponse(BaseModel):
    """Line item returned from API."""
    id: uuid.UUID
    invoice_id: uuid.UUID
    line_number: int
    description: str
    quantity: Decimal
    unit_price: Decimal
    amount_foreign: Decimal
    amount_base: Decimal
    gl_account_id: Optional[uuid.UUID]
    dimension_values: Optional[dict]
    vat_applicable: bool
    vat_rate: Decimal
    vat_amount: Decimal
    wht_applicable: bool
    wht_rate: Decimal
    wht_amount: Decimal
    net_payable_line: Decimal
    category_hint: Optional[str]

    model_config = {"from_attributes": True}


# ── Invoice schemas ────────────────────────────────────────────────────────────

class ApInvoiceCreate(BaseModel):
    """Create a new DRAFT AP invoice."""
    vendor_id: uuid.UUID
    invoice_number: str
    invoice_date: date
    received_date: Optional[date] = None   # defaults to today if not provided
    due_date: Optional[date] = None
    currency: str = "NGN"
    exchange_rate: Decimal = Decimal("1")
    description: Optional[str] = None
    lines: list[ApInvoiceLineIn] = Field(default_factory=list)


class ApInvoiceUpdate(BaseModel):
    """Update a DRAFT invoice — all fields optional."""
    vendor_id: Optional[uuid.UUID] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[date] = None
    received_date: Optional[date] = None
    due_date: Optional[date] = None
    currency: Optional[str] = None
    exchange_rate: Optional[Decimal] = None
    description: Optional[str] = None
    lines: Optional[list[ApInvoiceLineIn]] = None


class ApApprovalResponse(BaseModel):
    """One approval step response."""
    id: uuid.UUID
    step_order: int
    approver_id: Optional[uuid.UUID]
    role_id: Optional[uuid.UUID]
    status: str
    is_advisory: bool
    action_at: Optional[datetime]
    comment: Optional[str]

    model_config = {"from_attributes": True}


class ApInvoiceResponse(BaseModel):
    """Summary AP invoice row (for list views)."""
    id: uuid.UUID
    tenant_id: uuid.UUID
    vendor_id: uuid.UUID
    vendor_name: str
    reference: str
    invoice_number: str
    invoice_date: date
    due_date: Optional[date]
    currency: str
    total_amount_base: Decimal
    total_vat: Decimal
    total_wht: Decimal
    net_payable: Decimal
    status: str
    duplicate_flag: bool
    submitted_at: Optional[datetime]
    approved_at: Optional[datetime]
    paid_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class ApInvoiceDetail(ApInvoiceResponse):
    """Full AP invoice with lines + approvals."""
    received_date: date
    exchange_rate: Decimal
    total_amount_foreign: Decimal
    description: Optional[str]
    posting_mode: Optional[str]
    is_advance_settlement: bool
    rejection_reason: Optional[str]
    payment_reference: Optional[str]
    journal_entry_id: Optional[uuid.UUID]
    payment_journal_entry_id: Optional[uuid.UUID]
    posting_batch_id: Optional[uuid.UUID]
    lines: list[ApInvoiceLineResponse]
    approvals: list[ApApprovalResponse]

    model_config = {"from_attributes": True}


# ── Action schemas ─────────────────────────────────────────────────────────────

class ApApproveBody(BaseModel):
    """Body for approve action."""
    comment: Optional[str] = None


class ApRejectBody(BaseModel):
    """Body for reject action."""
    reason: str


class ApPayBody(BaseModel):
    """Body for recording payment."""
    payment_reference: Optional[str] = None
    payment_bank_account_id: Optional[uuid.UUID] = None
    paid_at: Optional[date] = None   # defaults to today


# ── Export / Aging schemas ─────────────────────────────────────────────────────

class ApAgingVendorRow(BaseModel):
    """One vendor row in the AP aging report."""
    vendor_id: uuid.UUID
    vendor_code: str
    vendor_name: str
    current: Decimal        # not yet due
    days_1_30: Decimal
    days_31_60: Decimal
    days_61_90: Decimal
    days_90_plus: Decimal
    total: Decimal

    model_config = {"from_attributes": True}


class ApAgingResponse(BaseModel):
    """Full AP aging response."""
    as_at_date: date
    rows: list[ApAgingVendorRow]
    grand_current: Decimal
    grand_1_30: Decimal
    grand_31_60: Decimal
    grand_61_90: Decimal
    grand_90_plus: Decimal
    grand_total: Decimal
