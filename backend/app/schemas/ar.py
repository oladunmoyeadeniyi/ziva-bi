"""
Pydantic schemas for the Accounts Receivable (AR) module — M14.

Covers:
  - Customer CRUD (CustomerCreate, CustomerUpdate, CustomerResponse, CustomerListItem)
  - AR invoice lifecycle (ArInvoiceCreate, ArInvoiceUpdate, ArInvoiceResponse,
    ArInvoiceListItem, ArInvoiceSubmit, ArInvoiceReceiptRequest)
  - AR invoice line (ArInvoiceLineIn, ArInvoiceLineOut)
  - AR approval trail (ArApprovalOut)
  - AR aging report (ArAgingRow, ArAgingResponse)

Module key used in approval_policies: 'receivable'
"""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


# ── Customers ──────────────────────────────────────────────────────────────────

class CustomerCreate(BaseModel):
    """Fields required to create a new customer master record."""

    name: str
    customer_type: str = "standard"
    code: Optional[str] = None  # auto-generated C-{NNNN} if omitted
    tax_id: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    credit_limit: Optional[Decimal] = None
    credit_terms: Optional[str] = None  # net_30 | net_60 | net_90 | immediate | custom
    credit_terms_days: Optional[int] = None
    notes: Optional[str] = None


class CustomerUpdate(BaseModel):
    """All fields optional — PATCH semantics."""

    name: Optional[str] = None
    customer_type: Optional[str] = None
    tax_id: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    credit_limit: Optional[Decimal] = None
    credit_terms: Optional[str] = None
    credit_terms_days: Optional[int] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class CustomerResponse(BaseModel):
    """Full customer detail including outstanding balance."""

    id: uuid.UUID
    code: str
    name: str
    customer_type: str
    tax_id: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    address: Optional[str]
    credit_limit: Optional[Decimal]
    credit_terms: Optional[str]
    credit_terms_days: Optional[int]
    is_active: bool
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    outstanding_balance: Decimal = Decimal("0")  # sum of net_receivable on APPROVED invoices

    class Config:
        from_attributes = True


class CustomerListItem(BaseModel):
    """Lightweight customer row for list views and dropdowns."""

    id: uuid.UUID
    code: str
    name: str
    customer_type: str
    email: Optional[str]
    is_active: bool
    outstanding_balance: Decimal = Decimal("0")
    credit_limit: Optional[Decimal]

    class Config:
        from_attributes = True


# ── Invoice lines ──────────────────────────────────────────────────────────────

class ArInvoiceLineIn(BaseModel):
    """
    Input schema for one AR invoice line.

    amount_foreign, amount_base, and net_receivable_line are computed server-side
    from quantity × unit_price × exchange_rate; callers may send them for
    pre-validated data or omit them (set to 0 and the server recomputes on save).
    """

    line_number: int
    description: str
    quantity: Decimal = Decimal("1")
    unit_price: Decimal = Decimal("0")
    amount_foreign: Decimal = Decimal("0")
    amount_base: Decimal = Decimal("0")
    gl_account_id: Optional[uuid.UUID] = None
    dimension_values: Optional[dict] = None
    vat_applicable: bool = False
    vat_rate: Decimal = Decimal("0")
    vat_amount: Decimal = Decimal("0")
    wht_applicable: bool = False
    wht_rate: Decimal = Decimal("0")
    wht_amount: Decimal = Decimal("0")
    net_receivable_line: Decimal = Decimal("0")
    category_hint: Optional[str] = None


class ArInvoiceLineOut(BaseModel):
    """Output schema for one AR invoice line."""

    id: uuid.UUID
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
    net_receivable_line: Decimal
    category_hint: Optional[str]

    class Config:
        from_attributes = True


# ── AR approvals ───────────────────────────────────────────────────────────────

class ArApprovalOut(BaseModel):
    """One approval step record on an AR invoice."""

    id: uuid.UUID
    step_order: int
    approver_id: Optional[uuid.UUID]
    status: str
    is_advisory: bool
    action_at: Optional[datetime]
    comment: Optional[str]

    class Config:
        from_attributes = True


# ── AR invoices ────────────────────────────────────────────────────────────────

class ArInvoiceCreate(BaseModel):
    """
    Create a new DRAFT AR invoice.

    Lines are required at creation. Totals (total_amount_base, total_vat,
    total_wht, net_receivable) are recomputed server-side from lines.
    """

    customer_id: uuid.UUID
    invoice_number: str = Field(..., description="Customer-facing invoice number")
    invoice_date: date
    due_date: Optional[date] = None
    service_period_start: Optional[date] = None
    service_period_end: Optional[date] = None
    currency: str = "NGN"
    exchange_rate: Decimal = Decimal("1")
    description: Optional[str] = None
    lines: list[ArInvoiceLineIn] = []


class ArInvoiceUpdate(BaseModel):
    """
    Replace a DRAFT AR invoice (PUT semantics — replaces all lines).

    Only allowed when status is DRAFT.
    """

    customer_id: Optional[uuid.UUID] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[date] = None
    due_date: Optional[date] = None
    service_period_start: Optional[date] = None
    service_period_end: Optional[date] = None
    currency: Optional[str] = None
    exchange_rate: Optional[Decimal] = None
    description: Optional[str] = None
    lines: Optional[list[ArInvoiceLineIn]] = None


class ArInvoiceSubmit(BaseModel):
    """
    Submit an AR invoice for approval.

    selected_approver_id is the manual fallback when no 'receivable' approval
    policy exists on this tenant. When a policy exists, the approval chain is
    computed automatically from the submitter's designation + invoice total.
    """

    selected_approver_id: Optional[uuid.UUID] = None


class ArInvoiceReceiptRequest(BaseModel):
    """Record receipt of payment from the customer."""

    receipt_date: date
    receipt_reference: Optional[str] = None
    bank_account_id: Optional[uuid.UUID] = None  # where the money was received


class ArInvoiceListItem(BaseModel):
    """Lightweight AR invoice row for list views."""

    id: uuid.UUID
    reference: str
    invoice_number: str
    customer_id: uuid.UUID
    customer_name: str
    customer_code: str
    invoice_date: date
    due_date: Optional[date]
    currency: str
    total_amount_base: Decimal
    net_receivable: Decimal
    status: str
    duplicate_flag: bool
    days_overdue: Optional[int] = None  # computed; None if not yet due

    class Config:
        from_attributes = True


class ArInvoiceResponse(BaseModel):
    """Full AR invoice detail including lines and approval trail."""

    id: uuid.UUID
    reference: str
    invoice_number: str
    customer_id: uuid.UUID
    customer_name: str
    customer_code: str
    invoice_date: date
    due_date: Optional[date]
    service_period_start: Optional[date]
    service_period_end: Optional[date]
    currency: str
    exchange_rate: Decimal
    total_amount_foreign: Decimal
    total_amount_base: Decimal
    total_vat: Decimal
    total_wht: Decimal
    net_receivable: Decimal
    description: Optional[str]
    status: str
    posting_mode: Optional[str]
    duplicate_flag: bool
    submitted_at: Optional[datetime]
    approved_at: Optional[datetime]
    rejected_at: Optional[datetime]
    rejection_reason: Optional[str]
    received_at: Optional[datetime]
    receipt_reference: Optional[str]
    journal_entry_id: Optional[uuid.UUID]
    receipt_journal_entry_id: Optional[uuid.UUID]
    posting_batch_id: Optional[uuid.UUID]
    created_at: datetime
    lines: list[ArInvoiceLineOut] = []
    approvals: list[ArApprovalOut] = []

    class Config:
        from_attributes = True


# ── AR Aging ───────────────────────────────────────────────────────────────────

class ArAgingBucket(BaseModel):
    """One aging bucket for a customer."""

    current: Decimal = Decimal("0")    # not yet due
    days_1_30: Decimal = Decimal("0")
    days_31_60: Decimal = Decimal("0")
    days_61_90: Decimal = Decimal("0")
    days_over_90: Decimal = Decimal("0")
    total: Decimal = Decimal("0")


class ArAgingRow(BaseModel):
    """Aging summary for one customer."""

    customer_id: uuid.UUID
    customer_code: str
    customer_name: str
    buckets: ArAgingBucket
    invoice_count: int


class ArAgingResponse(BaseModel):
    """Full AR aging report as at a given date."""

    as_at_date: date
    rows: list[ArAgingRow]
    totals: ArAgingBucket
