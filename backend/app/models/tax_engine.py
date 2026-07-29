"""
Tax Engine ORM models — M19 (transaction level).

Two tables:
  TaxReturn        — period-level VAT / WHT / PAYE return record
  WhtCertificate   — individual WHT deduction certificate issued to a vendor or customer

The computation logic (reading rates from tenant_tax_config and filling
vat_amount / wht_amount on invoice lines) lives in services/tax_compute_service.py.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base


class TaxReturn(Base):
    """
    A period-level tax return filing (VAT, WHT, PAYE, or Levy).

    One return per (tenant, tax_type, period_start, period_end).
    Status lifecycle: DRAFT → FILED → ACCEPTED (or REJECTED).

    Attributes:
        tax_type:           VAT | WHT | PAYE | LEVY.
        period_start/end:   The tax period this return covers.
        filing_deadline:    Due date for the return.
        status:             DRAFT | FILED | ACCEPTED | REJECTED.
        total_tax_collected: Sum of tax collected on sales (VAT output / WHT received).
        total_tax_paid:     Sum of tax paid on purchases (VAT input / WHT remitted).
        net_payable:        total_tax_collected - total_tax_paid (positive = owe to FIRS).
        filing_reference:   FIRS / state revenue service reference number.
        line_detail:        JSONB breakdown of individual transactions included.
    """

    __tablename__ = "tax_returns"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tax_type: Mapped[str] = mapped_column(String(20), nullable=False)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    filing_deadline: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="DRAFT")
    total_tax_collected: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    total_tax_paid: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    net_payable: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    filing_reference: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    filed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    filed_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    payment_reference: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    payment_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    line_detail: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("tax_type IN ('VAT','WHT','PAYE','LEVY')", name="ck_tax_return_type"),
        CheckConstraint("status IN ('DRAFT','FILED','ACCEPTED','REJECTED')", name="ck_tax_return_status"),
    )

    wht_certificates: Mapped[list[WhtCertificate]] = relationship(
        "WhtCertificate", back_populates="tax_return"
    )


class WhtCertificate(Base):
    """
    A WHT (Withholding Tax) certificate issued when WHT is deducted.

    WHT is deducted at source by the payer (tenant) from the payment to
    a vendor or received from a customer.  A certificate is issued to
    the counterparty as evidence of the deduction.

    Attributes:
        certificate_number: Auto-generated sequential certificate number.
        certificate_type:   VENDOR (AP) or CUSTOMER (AR).
        vendor_id:          Linked vendor (AP WHT).
        customer_id:        Linked customer (AR WHT).
        ap_invoice_id / ar_invoice_id: Source transaction.
        gross_amount:       Invoice amount before WHT.
        wht_rate:           Rate applied (e.g. 0.05 for 5%).
        wht_amount:         gross_amount × wht_rate.
        transaction_date:   Date of the underlying transaction.
        issue_date:         Date the certificate was issued.
        tax_return_id:      FK to the return this certificate is reported in.
    """

    __tablename__ = "wht_certificates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    certificate_number: Mapped[str] = mapped_column(String(50), nullable=False)
    certificate_type: Mapped[str] = mapped_column(String(10), nullable=False, default="VENDOR")
    vendor_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("vendors.id", ondelete="SET NULL"), nullable=True, index=True
    )
    customer_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True
    )
    ap_invoice_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ap_invoices.id", ondelete="SET NULL"), nullable=True
    )
    ar_invoice_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ar_invoices.id", ondelete="SET NULL"), nullable=True
    )
    gross_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    wht_rate: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False)
    wht_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False)
    issue_date: Mapped[date] = mapped_column(Date, nullable=False)
    tax_return_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tax_returns.id", ondelete="SET NULL"), nullable=True
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("tenant_id", "certificate_number", name="uq_wht_cert_number"),
    )

    tax_return: Mapped[Optional[TaxReturn]] = relationship("TaxReturn", back_populates="wht_certificates")
