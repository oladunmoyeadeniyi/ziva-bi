"""
Budget variance computation service — M16.

Provides compute_variance() which queries actuals from three possible sources
depending on the tenant's posting_mode:

  full_erp   → journal_lines (debit − credit per GL account in date range)
  connected  → returns empty actuals (GL lives in external ERP; posting_batches has no per-GL rows)
  lite       → expense report lines + AP invoice lines in APPROVED/PAID status

The YTD budget is the pro-rated share of annual_amount up to as_at_date.
If monthly_allocations is provided, the YTD budget is the sum of months
that fall fully within period_start..as_at_date.
"""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.budget import BudgetLine, BudgetPeriod
from app.models.master_data import ChartOfAccount
from app.schemas.budget import (
    BudgetVarianceResponse,
    BudgetVarianceRow,
    BudgetVarianceTotals,
)


def _ytd_budget(
    line: BudgetLine,
    period: BudgetPeriod,
    as_at: date,
) -> Decimal:
    """
    Compute the pro-rated YTD budget for a line up to as_at_date.

    If monthly_allocations is provided and populated, sum the months whose
    first day falls before or on as_at.  Otherwise pro-rate annual_amount
    by the fraction of the period elapsed.

    Args:
        line:    The BudgetLine ORM object.
        period:  The parent BudgetPeriod.
        as_at:   The reporting cut-off date.

    Returns:
        Pro-rated Decimal amount.
    """
    effective_end = min(as_at, period.period_end)
    if effective_end < period.period_start:
        return Decimal("0")

    alloc = line.monthly_allocations
    if alloc:
        total = Decimal("0")
        for month_str, amount in alloc.items():
            try:
                m = int(month_str)
                first_of_month = date(period.period_start.year if m >= period.period_start.month else period.period_end.year, m, 1)
                if first_of_month <= effective_end:
                    total += Decimal(str(amount))
            except (ValueError, TypeError):
                continue
        return total

    # Linear pro-ration
    period_days = (period.period_end - period.period_start).days + 1
    elapsed_days = (effective_end - period.period_start).days + 1
    if period_days <= 0:
        return line.annual_amount
    ratio = Decimal(str(elapsed_days)) / Decimal(str(period_days))
    return (line.annual_amount * ratio).quantize(Decimal("0.01"))


async def _actuals_full_erp(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    gl_ids: list[uuid.UUID],
    start: date,
    end: date,
) -> dict[uuid.UUID, Decimal]:
    """
    Pull actuals from journal_lines for Full ERP tenants.
    Net = SUM(debit) - SUM(credit) per GL account.

    Args:
        db:        Async DB session.
        tenant_id: Scoping tenant.
        gl_ids:    GL account IDs to include (from budget lines).
        start/end: Date range.

    Returns:
        Dict mapping gl_account_id → net debit amount.
    """
    if not gl_ids:
        return {}
    result = await db.execute(
        text(
            """
            SELECT jl.gl_account_id,
                   COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0) AS net
            FROM journal_lines jl
            JOIN journal_entries je ON je.id = jl.journal_entry_id
            WHERE je.tenant_id = :tenant_id
              AND je.entry_date BETWEEN :start AND :end
              AND je.status = 'POSTED'
              AND jl.gl_account_id = ANY(:gl_ids)
            GROUP BY jl.gl_account_id
            """
        ),
        {"tenant_id": str(tenant_id), "start": start, "end": end, "gl_ids": [str(g) for g in gl_ids]},
    )
    return {uuid.UUID(row.gl_account_id): Decimal(str(row.net)) for row in result.fetchall()}


async def _actuals_connected(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    gl_ids: list[uuid.UUID],
    start: date,
    end: date,
) -> dict[uuid.UUID, Decimal]:
    """
    Pull actuals for Connected tenants.

    In Connected mode, approved transactions are serialised into the
    `posting_batches.transactions` JSONB blob (one blob per batch — no
    per-GL-account columns exist on the table).  The authoritative GL
    ledger lives in the external ERP; we cannot reconstruct per-GL
    actuals from the blob without mapping every line's posting_role to
    the tenant's external account codes.

    This function therefore returns an empty dict (zero actuals).  The
    resulting variance report will show the full budget as favourable
    variance, which is a deliberate safe under-statement.  Finance teams
    in Connected mode should consult their external ERP for actual
    GL-level spend.

    Args:
        db:        Async DB session (unused — no DB query made).
        tenant_id: Scoping tenant (unused).
        gl_ids:    GL account IDs (unused).
        start/end: Date range (unused).

    Returns:
        Empty dict.
    """
    return {}


async def _actuals_lite(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    gl_ids: list[uuid.UUID],
    start: date,
    end: date,
) -> dict[uuid.UUID, Decimal]:
    """
    Pull actuals from approved AP invoice lines for Lite tenants.
    Expense report lines are also included where a GL is coded.

    Args:
        db:        Async DB session.
        tenant_id: Scoping tenant.
        gl_ids:    GL account IDs.
        start/end: Date range.

    Returns:
        Dict mapping gl_account_id → total amount_base.
    """
    if not gl_ids:
        return {}
    result = await db.execute(
        text(
            """
            SELECT apl.gl_account_id,
                   COALESCE(SUM(apl.amount_base), 0) AS total
            FROM ap_invoice_lines apl
            JOIN ap_invoices api ON api.id = apl.invoice_id
            WHERE api.tenant_id = :tenant_id
              AND api.status IN ('APPROVED', 'PAID')
              AND api.invoice_date BETWEEN :start AND :end
              AND apl.gl_account_id = ANY(:gl_ids)
            GROUP BY apl.gl_account_id
            UNION ALL
            SELECT el.gl_id AS gl_account_id,
                   COALESCE(SUM(el.amount), 0)
            FROM expense_lines el
            JOIN expense_reports er ON er.id = el.report_id
            WHERE er.tenant_id = :tenant_id
              AND er.status = 'APPROVED'
              AND er.submitted_at::date BETWEEN :start AND :end
              AND el.gl_id = ANY(:gl_ids)
            GROUP BY el.gl_id
            """
        ),
        {"tenant_id": str(tenant_id), "start": start, "end": end, "gl_ids": [str(g) for g in gl_ids]},
    )
    totals: dict[uuid.UUID, Decimal] = {}
    for row in result.fetchall():
        gid = uuid.UUID(row.gl_account_id)
        totals[gid] = totals.get(gid, Decimal("0")) + Decimal(str(row.total))
    return totals


async def compute_variance(
    db: AsyncSession,
    period: BudgetPeriod,
    as_at: date,
    posting_mode: str,
) -> BudgetVarianceResponse:
    """
    Build the full variance report for a budget period.

    Queries budget lines, looks up GL account metadata, then fetches actuals
    from the appropriate source based on posting_mode.

    Args:
        db:           Async DB session.
        period:       BudgetPeriod ORM instance (with .lines loaded).
        as_at:        Reporting cut-off date.
        posting_mode: "full_erp" | "connected" | "lite".

    Returns:
        BudgetVarianceResponse with per-line and totals data.
    """
    lines = period.lines

    # Collect GL account IDs for enrichment + actuals lookup
    gl_ids = [ln.gl_account_id for ln in lines if ln.gl_account_id]

    # Fetch GL account metadata
    gl_meta: dict[uuid.UUID, ChartOfAccount] = {}
    if gl_ids:
        result = await db.execute(
            select(ChartOfAccount).where(ChartOfAccount.id.in_(gl_ids))
        )
        for acc in result.scalars().all():
            gl_meta[acc.id] = acc

    # Fetch actuals
    effective_end = min(as_at, period.period_end)
    if posting_mode == "full_erp":
        actuals = await _actuals_full_erp(db, period.tenant_id, gl_ids, period.period_start, effective_end)
        data_source = "gl_entries"
    elif posting_mode == "connected":
        actuals = await _actuals_connected(db, period.tenant_id, gl_ids, period.period_start, effective_end)
        data_source = "posting_batches"
    else:
        actuals = await _actuals_lite(db, period.tenant_id, gl_ids, period.period_start, effective_end)
        data_source = "expense_reports"

    # Build rows
    rows: list[BudgetVarianceRow] = []
    total_annual = Decimal("0")
    total_ytd = Decimal("0")
    total_actual = Decimal("0")

    for ln in lines:
        ytd = _ytd_budget(ln, period, as_at)
        actual = actuals.get(ln.gl_account_id, Decimal("0")) if ln.gl_account_id else Decimal("0")
        variance = ytd - actual
        variance_pct: Optional[float] = None
        if ytd != 0:
            variance_pct = float((variance / ytd * 100).quantize(Decimal("0.01")))

        acc = gl_meta.get(ln.gl_account_id) if ln.gl_account_id else None

        rows.append(
            BudgetVarianceRow(
                gl_account_id=ln.gl_account_id,
                gl_code=acc.gl_number if acc else None,
                gl_name=acc.gl_name if acc else ln.description,
                department_id=ln.department_id,
                department_name=None,
                annual_budget=ln.annual_amount,
                ytd_budget=ytd,
                actual_amount=actual,
                variance=variance,
                variance_pct=variance_pct,
            )
        )
        total_annual += ln.annual_amount
        total_ytd += ytd
        total_actual += actual

    total_variance = total_ytd - total_actual
    total_pct: Optional[float] = None
    if total_ytd != 0:
        total_pct = float((total_variance / total_ytd * 100).quantize(Decimal("0.01")))

    return BudgetVarianceResponse(
        period_id=period.id,
        period_name=period.name,
        as_at_date=as_at,
        data_source=data_source,
        rows=rows,
        totals=BudgetVarianceTotals(
            annual_budget=total_annual,
            ytd_budget=total_ytd,
            actual_amount=total_actual,
            variance=total_variance,
            variance_pct=total_pct,
        ),
    )
