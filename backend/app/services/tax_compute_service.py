"""
Tax computation service — M19.

Provides functions to:
  1. compute_line_vat()  — compute VAT amount for an invoice line from tenant config
  2. compute_line_wht()  — compute WHT amount for an invoice line from tenant config
  3. compute_paye()      — compute PAYE and pension for an employee salary
  4. build_vat_return()  — aggregate VAT transactions for a period return
  5. build_wht_return()  — aggregate WHT transactions for a period return

All rate lookups use the JSONB blobs in tenant_tax_config (from M8.4).
No new columns are needed — AP/AR models already carry vat_amount and wht_amount.

Nigerian tax specifics:
  VAT:  7.5% standard rate (Finance Act 2020)
  WHT:  varies by transaction category (rent 10%, consulting 5%, construction 5%, etc.)
  PAYE: progressive bands (personal relief, consolidated relief allowance, graduated bands)
  Pension: employee 8%, employer 10% of gross pay (Pension Reform Act)
"""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.setup import TenantTaxConfig


async def _get_tax_config(db: AsyncSession, tenant_id: uuid.UUID) -> TenantTaxConfig:
    """
    Fetch the tenant tax config row.

    Returns:
        TenantTaxConfig ORM object (may have null JSONB fields if not configured).
    """
    result = await db.execute(
        select(TenantTaxConfig).where(TenantTaxConfig.tenant_id == tenant_id)
    )
    cfg = result.scalar_one_or_none()
    if not cfg:
        # Return a stub if not yet configured
        return TenantTaxConfig(tenant_id=tenant_id)
    return cfg


def compute_line_vat(
    amount_base: Decimal,
    vat_config: Optional[dict],
    override_rate: Optional[float] = None,
) -> Decimal:
    """
    Compute VAT for a single invoice line.

    Args:
        amount_base:   Line amount before tax (in base currency).
        vat_config:    tenant_tax_config.vat_config JSONB dict.
        override_rate: Optional per-line override rate (decimal fraction, e.g. 0.075).

    Returns:
        VAT amount (Decimal, 2dp).

    Example:
        compute_line_vat(Decimal("1000000"), {"standard_rate": 7.5}) → Decimal("75000.00")
    """
    if override_rate is not None:
        rate = Decimal(str(override_rate))
    elif vat_config and vat_config.get("vat_registered"):
        rate = Decimal(str(vat_config.get("standard_rate", 7.5))) / Decimal("100")
    else:
        return Decimal("0")
    return (amount_base * rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def compute_line_wht(
    amount_base: Decimal,
    wht_config: Optional[dict],
    transaction_category: Optional[str] = None,
    override_rate: Optional[float] = None,
) -> Decimal:
    """
    Compute WHT for a single invoice line.

    WHT rates are category-specific.  The wht_config.categories list maps
    category names → rates.  Falls back to a default rate or 0.

    Args:
        amount_base:           Line amount before tax.
        wht_config:            tenant_tax_config.wht_config JSONB dict.
        transaction_category:  e.g. "consulting", "rent", "construction".
        override_rate:         Per-line rate override (decimal fraction).

    Returns:
        WHT amount (Decimal, 2dp).
    """
    if override_rate is not None:
        rate = Decimal(str(override_rate))
    elif wht_config:
        # Look up rate from categories list
        categories: list[dict] = wht_config.get("categories", [])
        rate_pct: float = 0.0
        for cat in categories:
            if (cat.get("name") or "").lower() == (transaction_category or "").lower():
                rate_pct = float(cat.get("rate", 0))
                break
        if rate_pct == 0:
            rate_pct = float(wht_config.get("default_rate", 0))
        rate = Decimal(str(rate_pct)) / Decimal("100")
    else:
        return Decimal("0")

    return (amount_base * rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def compute_paye(
    gross_pay: Decimal,
    paye_config: Optional[dict],
) -> dict[str, Decimal]:
    """
    Compute PAYE tax and pension contributions for a monthly payroll line.

    Uses the progressive bands in paye_config.bands.  Each band has:
      { "from": 0, "to": 300000, "rate": 7 }  (annual amounts, annual rate %)

    Personal relief and CRA (Consolidated Relief Allowance) per Finance Act:
      CRA = higher of ₦200,000 or 1% of gross annual pay + 20% of gross annual pay
      Personal relief = ₦200,000 (annual)

    Args:
        gross_pay:   Monthly gross salary (Decimal).
        paye_config: tenant_tax_config.paye_config JSONB dict.

    Returns:
        Dict with keys:
          paye_monthly:       Monthly PAYE deduction.
          employee_pension:   Employee pension contribution (default 8% of gross).
          employer_pension:   Employer pension contribution (default 10% of gross).
          net_pay_after_deductions: gross - paye - employee_pension.
    """
    annual_gross = gross_pay * Decimal("12")

    # Nigerian CRA: max(200000, 0.01 * gross) + 0.20 * gross
    cra = max(Decimal("200000"), annual_gross * Decimal("0.01")) + annual_gross * Decimal("0.20")
    personal_relief = Decimal("200000")
    taxable_income = max(Decimal("0"), annual_gross - cra - personal_relief)

    # Progressive bands from config or default Nigerian 2024 bands
    bands = []
    if paye_config:
        bands = paye_config.get("bands", [])
    if not bands:
        bands = [
            {"from": 0,         "to": 300000,    "rate": 7},
            {"from": 300000,    "to": 600000,     "rate": 11},
            {"from": 600000,    "to": 1100000,    "rate": 15},
            {"from": 1100000,   "to": 1600000,    "rate": 19},
            {"from": 1600000,   "to": 3200000,    "rate": 21},
            {"from": 3200000,   "to": None,        "rate": 24},
        ]

    annual_paye = Decimal("0")
    remaining = taxable_income
    for band in bands:
        if remaining <= 0:
            break
        band_from = Decimal(str(band.get("from", 0)))
        band_to = band.get("to")
        band_to_d = Decimal(str(band_to)) if band_to is not None else None
        band_rate = Decimal(str(band.get("rate", 0))) / Decimal("100")

        if band_to_d is not None:
            band_size = band_to_d - band_from
        else:
            band_size = remaining

        taxable_in_band = min(remaining, band_size)
        annual_paye += (taxable_in_band * band_rate).quantize(Decimal("0.01"))
        remaining -= taxable_in_band

    monthly_paye = (annual_paye / Decimal("12")).quantize(Decimal("0.01"))

    emp_pension_rate = Decimal(str(paye_config.get("employee_pension_rate", 8) if paye_config else 8)) / Decimal("100")
    emplr_pension_rate = Decimal(str(paye_config.get("employer_pension_rate", 10) if paye_config else 10)) / Decimal("100")

    employee_pension = (gross_pay * emp_pension_rate).quantize(Decimal("0.01"))
    employer_pension = (gross_pay * emplr_pension_rate).quantize(Decimal("0.01"))

    return {
        "paye_monthly": monthly_paye,
        "employee_pension": employee_pension,
        "employer_pension": employer_pension,
        "net_pay_after_deductions": gross_pay - monthly_paye - employee_pension,
    }


async def build_vat_summary(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    period_start: date,
    period_end: date,
) -> dict:
    """
    Aggregate VAT output (collected on AR invoices) and VAT input (paid on AP invoices)
    for a period.  Returns a summary dict for rendering the VAT return.

    Args:
        db:           Async DB session.
        tenant_id:    Scoping tenant.
        period_start: Period start date.
        period_end:   Period end date.

    Returns:
        Dict with: output_vat, input_vat, net_vat_payable, transaction_count, lines.
    """
    # VAT output (collected from customers on AR)
    ar_result = await db.execute(
        text(
            """
            SELECT COALESCE(SUM(ai.total_vat), 0) AS output_vat,
                   COUNT(*) AS ar_count
            FROM ar_invoices ai
            WHERE ai.tenant_id = :tenant_id
              AND ai.status IN ('APPROVED', 'RECEIVED')
              AND ai.invoice_date BETWEEN :start AND :end
            """
        ),
        {"tenant_id": str(tenant_id), "start": period_start, "end": period_end},
    )
    ar_row = ar_result.fetchone()
    output_vat = Decimal(str(ar_row.output_vat))
    ar_count = int(ar_row.ar_count)

    # VAT input (paid to vendors on AP)
    ap_result = await db.execute(
        text(
            """
            SELECT COALESCE(SUM(ai.total_vat), 0) AS input_vat,
                   COUNT(*) AS ap_count
            FROM ap_invoices ai
            WHERE ai.tenant_id = :tenant_id
              AND ai.status IN ('APPROVED', 'PAID')
              AND ai.invoice_date BETWEEN :start AND :end
            """
        ),
        {"tenant_id": str(tenant_id), "start": period_start, "end": period_end},
    )
    ap_row = ap_result.fetchone()
    input_vat = Decimal(str(ap_row.input_vat))
    ap_count = int(ap_row.ap_count)

    net = output_vat - input_vat

    return {
        "period_start": period_start,
        "period_end": period_end,
        "output_vat": output_vat,
        "input_vat": input_vat,
        "net_vat_payable": net,
        "ar_invoice_count": ar_count,
        "ap_invoice_count": ap_count,
        "total_transaction_count": ar_count + ap_count,
    }


async def build_wht_summary(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    period_start: date,
    period_end: date,
) -> dict:
    """
    Aggregate WHT deducted on AP and AR transactions for a period.

    Args:
        db:           Async DB session.
        tenant_id:    Scoping tenant.
        period_start: Period start date.
        period_end:   Period end date.

    Returns:
        Dict with: total_wht_deducted, ap_wht, ar_wht, transaction_count.
    """
    ap_result = await db.execute(
        text(
            """
            SELECT COALESCE(SUM(total_wht), 0) AS ap_wht
            FROM ap_invoices
            WHERE tenant_id = :tenant_id
              AND status IN ('APPROVED', 'PAID')
              AND invoice_date BETWEEN :start AND :end
            """
        ),
        {"tenant_id": str(tenant_id), "start": period_start, "end": period_end},
    )
    ap_wht = Decimal(str(ap_result.fetchone().ap_wht))

    ar_result = await db.execute(
        text(
            """
            SELECT COALESCE(SUM(total_wht), 0) AS ar_wht
            FROM ar_invoices
            WHERE tenant_id = :tenant_id
              AND status IN ('APPROVED', 'RECEIVED')
              AND invoice_date BETWEEN :start AND :end
            """
        ),
        {"tenant_id": str(tenant_id), "start": period_start, "end": period_end},
    )
    ar_wht = Decimal(str(ar_result.fetchone().ar_wht))

    return {
        "period_start": period_start,
        "period_end": period_end,
        "ap_wht_deducted": ap_wht,
        "ar_wht_suffered": ar_wht,
        "total_wht_deducted": ap_wht,
        "net_wht_remittable": ap_wht,
    }
