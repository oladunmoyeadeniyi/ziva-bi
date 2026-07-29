"""
Pydantic schemas for Tax Engine M19 — tax returns + WHT certificates.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict


# ── Tax Returns ────────────────────────────────────────────────────────────────

class TaxReturnCreate(BaseModel):
    tax_type: str                        # VAT | WHT | PAYE | LEVY
    period_start: date
    period_end: date
    filing_deadline: Optional[date] = None
    notes: Optional[str] = None


class TaxReturnUpdate(BaseModel):
    filing_reference: Optional[str] = None
    payment_reference: Optional[str] = None
    payment_date: Optional[date] = None
    notes: Optional[str] = None
    status: Optional[str] = None


class TaxReturnResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    tax_type: str
    period_start: date
    period_end: date
    filing_deadline: Optional[date]
    status: str
    total_tax_collected: Decimal
    total_tax_paid: Decimal
    net_payable: Decimal
    filing_reference: Optional[str]
    filed_at: Optional[datetime]
    filed_by_id: Optional[uuid.UUID]
    payment_reference: Optional[str]
    payment_date: Optional[date]
    notes: Optional[str]
    line_detail: Optional[dict[str, Any]]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── WHT Certificates ───────────────────────────────────────────────────────────

class WhtCertificateCreate(BaseModel):
    certificate_type: str = "VENDOR"     # VENDOR | CUSTOMER
    vendor_id: Optional[uuid.UUID] = None
    customer_id: Optional[uuid.UUID] = None
    ap_invoice_id: Optional[uuid.UUID] = None
    ar_invoice_id: Optional[uuid.UUID] = None
    gross_amount: Decimal
    wht_rate: Decimal
    wht_amount: Decimal
    transaction_date: date
    issue_date: date
    notes: Optional[str] = None


class WhtCertificateResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    certificate_number: str
    certificate_type: str
    vendor_id: Optional[uuid.UUID]
    vendor_name: Optional[str] = None
    customer_id: Optional[uuid.UUID]
    customer_name: Optional[str] = None
    ap_invoice_id: Optional[uuid.UUID]
    ar_invoice_id: Optional[uuid.UUID]
    gross_amount: Decimal
    wht_rate: Decimal
    wht_amount: Decimal
    transaction_date: date
    issue_date: date
    tax_return_id: Optional[uuid.UUID]
    notes: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── VAT / WHT Summary (computed on-the-fly) ───────────────────────────────────

class VatSummaryResponse(BaseModel):
    period_start: date
    period_end: date
    output_vat: Decimal
    input_vat: Decimal
    net_vat_payable: Decimal
    ar_invoice_count: int
    ap_invoice_count: int
    total_transaction_count: int


class WhtSummaryResponse(BaseModel):
    period_start: date
    period_end: date
    ap_wht_deducted: Decimal
    ar_wht_suffered: Decimal
    total_wht_deducted: Decimal
    net_wht_remittable: Decimal
