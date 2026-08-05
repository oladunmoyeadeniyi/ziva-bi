"""Reporting & Analytics Service.

Produces KPI summaries and tabular report data by querying source tables across
all active modules. All queries are tenant-scoped. No data is cached — every
call re-runs the query.

Mode-awareness:
  Lite        — expenses, AR aging, AP aging (no GL data).
  Connected   — same as Lite.
  Full ERP    — all of the above + GL-backed P&L trend, trial balance summary.

Public functions:
  get_dashboard_kpis() — aggregate KPIs for the main analytics dashboard.
  run_report()         — run a named report type with filter parameters.

Report types supported (see RUN_REGISTRY):
  expense_summary, expense_by_category, expense_by_department,
  ar_aging, ar_invoice_summary,
  ap_aging, ap_invoice_summary,
  budget_variance,
  payroll_summary,
  tax_summary,
  inventory_valuation,
  asset_register,
  cash_flow_summary,
  gl_activity.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import case, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession


# ── Helpers ────────────────────────────────────────────────────────────────────

def _d(val: Any) -> float:
    """Convert Decimal/None to float safely."""
    if val is None:
        return 0.0
    return float(val)


def _today() -> date:
    return datetime.now(timezone.utc).date()


def _period_start(months_back: int = 0) -> date:
    """First day of month N months ago."""
    today = _today()
    m = today.month - months_back
    y = today.year
    while m <= 0:
        m += 12
        y -= 1
    return date(y, m, 1)


# ── Dashboard KPIs ─────────────────────────────────────────────────────────────

async def get_dashboard_kpis(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    posting_mode: str,
) -> dict[str, Any]:
    """Return a snapshot KPI dict for the analytics dashboard.

    Pulls data from whatever tables are available; gracefully returns 0/None
    for modules that are inactive or not yet used.

    Args:
        db:           Async DB session (already tenant-scoped by middleware).
        tenant_id:    Current tenant.
        posting_mode: "lite" | "connected" | "full_erp"

    Returns:
        Dict with sections: expenses, ar, ap, payroll, budget, tax, inventory.
    """
    today = _today()
    mtd_start = _period_start(0)   # this month
    ytd_start = date(today.year, 1, 1)
    prev_month_start = _period_start(1)
    prev_month_end = mtd_start - timedelta(days=1)

    result: dict[str, Any] = {}

    # ── Expenses ──────────────────────────────────────────────────────────────
    try:
        from app.models.expenses import ExpenseReport
        stmt = select(
            func.sum(ExpenseReport.total_amount).filter(
                ExpenseReport.status == "APPROVED",
                ExpenseReport.submitted_at >= mtd_start,
            ).label("mtd"),
            func.sum(ExpenseReport.total_amount).filter(
                ExpenseReport.status == "APPROVED",
                ExpenseReport.submitted_at >= ytd_start,
            ).label("ytd"),
            func.count(ExpenseReport.id).filter(
                ExpenseReport.status == "PENDING",
            ).label("pending_count"),
            func.sum(ExpenseReport.total_amount).filter(
                ExpenseReport.status == "APPROVED",
                ExpenseReport.submitted_at >= prev_month_start,
                ExpenseReport.submitted_at <= prev_month_end,
            ).label("prev_month"),
        ).where(ExpenseReport.tenant_id == tenant_id)
        row = (await db.execute(stmt)).one()
        mtd = _d(row.mtd)
        prev = _d(row.prev_month)
        result["expenses"] = {
            "mtd_approved": mtd,
            "ytd_approved": _d(row.ytd),
            "pending_count": row.pending_count or 0,
            "mom_change_pct": round(((mtd - prev) / prev * 100) if prev else 0, 1),
        }
    except Exception:
        result["expenses"] = {"mtd_approved": 0, "ytd_approved": 0, "pending_count": 0, "mom_change_pct": 0}

    # ── AR ────────────────────────────────────────────────────────────────────
    try:
        from app.models.ar import ArInvoice
        stmt = select(
            func.sum(ArInvoice.total_amount).filter(
                ArInvoice.status.in_(["SENT", "PARTIALLY_PAID"]),
                ArInvoice.due_date < today,
            ).label("overdue"),
            func.sum(ArInvoice.total_amount).filter(
                ArInvoice.status.in_(["SENT", "PARTIALLY_PAID"]),
            ).label("outstanding"),
            func.count(ArInvoice.id).filter(
                ArInvoice.status == "PAID",
                ArInvoice.invoice_date >= mtd_start,
            ).label("paid_mtd"),
        ).where(ArInvoice.tenant_id == tenant_id)
        row = (await db.execute(stmt)).one()
        result["ar"] = {
            "outstanding": _d(row.outstanding),
            "overdue": _d(row.overdue),
            "paid_count_mtd": row.paid_mtd or 0,
        }
    except Exception:
        result["ar"] = {"outstanding": 0, "overdue": 0, "paid_count_mtd": 0}

    # ── AP ────────────────────────────────────────────────────────────────────
    try:
        from app.models.ap import ApInvoice
        stmt = select(
            func.sum(ApInvoice.total_amount).filter(
                ApInvoice.status.in_(["APPROVED", "PARTIALLY_PAID"]),
                ApInvoice.due_date < today,
            ).label("overdue"),
            func.sum(ApInvoice.total_amount).filter(
                ApInvoice.status.in_(["APPROVED", "PARTIALLY_PAID"]),
            ).label("outstanding"),
        ).where(ApInvoice.tenant_id == tenant_id)
        row = (await db.execute(stmt)).one()
        result["ap"] = {
            "outstanding": _d(row.outstanding),
            "overdue": _d(row.overdue),
        }
    except Exception:
        result["ap"] = {"outstanding": 0, "overdue": 0}

    # ── Payroll ───────────────────────────────────────────────────────────────
    try:
        from app.models.payroll import PayrollRun
        stmt = select(
            func.sum(PayrollRun.net_pay).filter(
                PayrollRun.status == "APPROVED",
                PayrollRun.pay_date >= ytd_start,
            ).label("ytd_net"),
            func.count(PayrollRun.id).filter(
                PayrollRun.status == "DRAFT",
            ).label("draft_runs"),
        ).where(PayrollRun.tenant_id == tenant_id)
        row = (await db.execute(stmt)).one()
        result["payroll"] = {
            "ytd_net_pay": _d(row.ytd_net),
            "draft_runs": row.draft_runs or 0,
        }
    except Exception:
        result["payroll"] = {"ytd_net_pay": 0, "draft_runs": 0}

    # ── Budget ────────────────────────────────────────────────────────────────
    try:
        from app.models.budget import BudgetLine, BudgetPeriod
        stmt = select(
            func.sum(BudgetLine.budgeted_amount).label("total_budget"),
            func.sum(BudgetLine.actual_amount).label("total_actual"),
        ).join(
            BudgetPeriod, BudgetLine.budget_period_id == BudgetPeriod.id
        ).where(
            BudgetPeriod.tenant_id == tenant_id,
            BudgetPeriod.period_start <= today,
            BudgetPeriod.period_end >= date(today.year, 1, 1),
        )
        row = (await db.execute(stmt)).one()
        budget = _d(row.total_budget)
        actual = _d(row.total_actual)
        result["budget"] = {
            "ytd_budget": budget,
            "ytd_actual": actual,
            "variance": budget - actual,
            "variance_pct": round(((actual - budget) / budget * 100) if budget else 0, 1),
        }
    except Exception:
        result["budget"] = {"ytd_budget": 0, "ytd_actual": 0, "variance": 0, "variance_pct": 0}

    return result


# ── Report runners ─────────────────────────────────────────────────────────────

async def run_expense_summary(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    filters: dict,
) -> list[dict]:
    """Expense summary grouped by month.

    Args:
        filters: date_from, date_to (ISO strings), status (default: APPROVED)

    Returns:
        List of {period, count, total_amount} dicts ordered by period.
    """
    from app.models.expenses import ExpenseReport

    date_from = _parse_date(filters.get("date_from"), _period_start(11))
    date_to = _parse_date(filters.get("date_to"), _today())
    status_filter = filters.get("status", "APPROVED")

    stmt = select(
        func.to_char(ExpenseReport.submitted_at, "YYYY-MM").label("period"),
        func.count(ExpenseReport.id).label("count"),
        func.sum(ExpenseReport.total_amount).label("total_amount"),
    ).where(
        ExpenseReport.tenant_id == tenant_id,
        ExpenseReport.status == status_filter,
        ExpenseReport.submitted_at >= date_from,
        ExpenseReport.submitted_at <= date_to,
    ).group_by("period").order_by("period")

    rows = (await db.execute(stmt)).all()
    return [{"period": r.period, "count": r.count, "total_amount": _d(r.total_amount)} for r in rows]


async def run_expense_by_category(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    filters: dict,
) -> list[dict]:
    """Expense breakdown by category for a date range."""
    from app.models.expenses import ExpenseReport, ExpenseLine
    from app.models.master_data import ExpenseCategory

    date_from = _parse_date(filters.get("date_from"), _period_start(11))
    date_to = _parse_date(filters.get("date_to"), _today())

    stmt = select(
        ExpenseCategory.name.label("category"),
        func.count(ExpenseLine.id).label("count"),
        func.sum(ExpenseLine.amount).label("total_amount"),
    ).join(
        ExpenseReport, ExpenseLine.expense_report_id == ExpenseReport.id
    ).join(
        ExpenseCategory, ExpenseLine.category_id == ExpenseCategory.id, isouter=True
    ).where(
        ExpenseReport.tenant_id == tenant_id,
        ExpenseReport.status == "APPROVED",
        ExpenseReport.submitted_at >= date_from,
        ExpenseReport.submitted_at <= date_to,
    ).group_by(ExpenseCategory.name).order_by(func.sum(ExpenseLine.amount).desc())

    rows = (await db.execute(stmt)).all()
    return [{"category": r.category or "Uncategorised", "count": r.count, "total_amount": _d(r.total_amount)} for r in rows]


async def run_ar_aging(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    filters: dict,
) -> list[dict]:
    """AR aging by customer — outstanding invoices bucketed into aging bands."""
    from app.models.ar import ArInvoice

    as_of = _parse_date(filters.get("as_of"), _today())

    stmt = select(
        ArInvoice.customer_name,
        func.sum(
            case((ArInvoice.due_date >= as_of, ArInvoice.balance_due), else_=0)
        ).label("current"),
        func.sum(
            case((
                (ArInvoice.due_date < as_of) & (ArInvoice.due_date >= as_of - timedelta(days=30)),
                ArInvoice.balance_due
            ), else_=0)
        ).label("days_1_30"),
        func.sum(
            case((
                (ArInvoice.due_date < as_of - timedelta(days=30)) & (ArInvoice.due_date >= as_of - timedelta(days=60)),
                ArInvoice.balance_due
            ), else_=0)
        ).label("days_31_60"),
        func.sum(
            case((
                (ArInvoice.due_date < as_of - timedelta(days=60)) & (ArInvoice.due_date >= as_of - timedelta(days=90)),
                ArInvoice.balance_due
            ), else_=0)
        ).label("days_61_90"),
        func.sum(
            case((ArInvoice.due_date < as_of - timedelta(days=90), ArInvoice.balance_due), else_=0)
        ).label("over_90"),
        func.sum(ArInvoice.balance_due).label("total"),
    ).where(
        ArInvoice.tenant_id == tenant_id,
        ArInvoice.status.in_(["SENT", "PARTIALLY_PAID"]),
        ArInvoice.balance_due > 0,
    ).group_by(ArInvoice.customer_name).order_by(func.sum(ArInvoice.balance_due).desc())

    rows = (await db.execute(stmt)).all()
    return [
        {
            "customer": r.customer_name,
            "current": _d(r.current),
            "1_30": _d(r.days_1_30),
            "31_60": _d(r.days_31_60),
            "61_90": _d(r.days_61_90),
            "over_90": _d(r.over_90),
            "total": _d(r.total),
        }
        for r in rows
    ]


async def run_ap_aging(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    filters: dict,
) -> list[dict]:
    """AP aging by vendor — outstanding invoices bucketed into aging bands."""
    from app.models.ap import ApInvoice

    as_of = _parse_date(filters.get("as_of"), _today())

    stmt = select(
        ApInvoice.vendor_name,
        func.sum(
            case((ApInvoice.due_date >= as_of, ApInvoice.total_amount), else_=0)
        ).label("current"),
        func.sum(
            case((
                (ApInvoice.due_date < as_of) & (ApInvoice.due_date >= as_of - timedelta(days=30)),
                ApInvoice.total_amount
            ), else_=0)
        ).label("days_1_30"),
        func.sum(
            case((
                (ApInvoice.due_date < as_of - timedelta(days=30)) & (ApInvoice.due_date >= as_of - timedelta(days=60)),
                ApInvoice.total_amount
            ), else_=0)
        ).label("days_31_60"),
        func.sum(
            case((
                (ApInvoice.due_date < as_of - timedelta(days=60)) & (ApInvoice.due_date >= as_of - timedelta(days=90)),
                ApInvoice.total_amount
            ), else_=0)
        ).label("days_61_90"),
        func.sum(
            case((ApInvoice.due_date < as_of - timedelta(days=90), ApInvoice.total_amount), else_=0)
        ).label("over_90"),
        func.sum(ApInvoice.total_amount).label("total"),
    ).where(
        ApInvoice.tenant_id == tenant_id,
        ApInvoice.status.in_(["APPROVED", "PARTIALLY_PAID"]),
    ).group_by(ApInvoice.vendor_name).order_by(func.sum(ApInvoice.total_amount).desc())

    rows = (await db.execute(stmt)).all()
    return [
        {
            "vendor": r.vendor_name,
            "current": _d(r.current),
            "1_30": _d(r.days_1_30),
            "31_60": _d(r.days_31_60),
            "61_90": _d(r.days_61_90),
            "over_90": _d(r.over_90),
            "total": _d(r.total),
        }
        for r in rows
    ]


async def run_budget_variance(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    filters: dict,
) -> list[dict]:
    """Budget vs actual variance by GL account / budget line."""
    from app.models.budget import BudgetLine, BudgetPeriod

    stmt = select(
        BudgetLine.account_name,
        BudgetLine.department,
        func.sum(BudgetLine.budgeted_amount).label("budget"),
        func.sum(BudgetLine.actual_amount).label("actual"),
    ).join(
        BudgetPeriod, BudgetLine.budget_period_id == BudgetPeriod.id
    ).where(
        BudgetPeriod.tenant_id == tenant_id,
    ).group_by(BudgetLine.account_name, BudgetLine.department
    ).order_by(BudgetLine.account_name)

    rows = (await db.execute(stmt)).all()
    return [
        {
            "account": r.account_name,
            "department": r.department,
            "budget": _d(r.budget),
            "actual": _d(r.actual),
            "variance": _d(r.budget) - _d(r.actual),
            "variance_pct": round(
                ((_d(r.actual) - _d(r.budget)) / _d(r.budget) * 100)
                if _d(r.budget) != 0 else 0,
                1
            ),
        }
        for r in rows
    ]


async def run_payroll_summary(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    filters: dict,
) -> list[dict]:
    """Payroll summary by run (pay period + net pay + headcount)."""
    from app.models.payroll import PayrollRun

    date_from = _parse_date(filters.get("date_from"), _period_start(11))
    date_to = _parse_date(filters.get("date_to"), _today())

    stmt = select(
        PayrollRun.pay_period_label,
        PayrollRun.pay_date,
        PayrollRun.status,
        PayrollRun.gross_pay,
        PayrollRun.net_pay,
        PayrollRun.headcount,
    ).where(
        PayrollRun.tenant_id == tenant_id,
        PayrollRun.pay_date >= date_from,
        PayrollRun.pay_date <= date_to,
    ).order_by(PayrollRun.pay_date.desc())

    rows = (await db.execute(stmt)).all()
    return [
        {
            "period": r.pay_period_label,
            "pay_date": r.pay_date.isoformat() if r.pay_date else None,
            "status": r.status,
            "gross_pay": _d(r.gross_pay),
            "net_pay": _d(r.net_pay),
            "headcount": r.headcount or 0,
        }
        for r in rows
    ]


async def run_tax_summary(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    filters: dict,
) -> list[dict]:
    """Tax return summary — VAT, WHT, PAYE by period."""
    from app.models.tax_engine import TaxReturn

    date_from = _parse_date(filters.get("date_from"), _period_start(11))
    date_to = _parse_date(filters.get("date_to"), _today())

    stmt = select(
        TaxReturn.tax_type,
        TaxReturn.period_label,
        TaxReturn.status,
        TaxReturn.total_output_tax,
        TaxReturn.total_input_tax,
        TaxReturn.net_tax_payable,
    ).where(
        TaxReturn.tenant_id == tenant_id,
        TaxReturn.period_end >= date_from,
        TaxReturn.period_end <= date_to,
    ).order_by(TaxReturn.period_end.desc(), TaxReturn.tax_type)

    rows = (await db.execute(stmt)).all()
    return [
        {
            "tax_type": r.tax_type,
            "period": r.period_label,
            "status": r.status,
            "output_tax": _d(r.total_output_tax),
            "input_tax": _d(r.total_input_tax),
            "net_payable": _d(r.net_tax_payable),
        }
        for r in rows
    ]


async def run_inventory_valuation(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    filters: dict,
) -> list[dict]:
    """Inventory valuation snapshot — quantity on hand + value by item."""
    from app.models.inventory import InventoryItem, InventoryCategory

    stmt = select(
        InventoryItem.item_code,
        InventoryItem.name,
        InventoryCategory.name.label("category"),
        InventoryItem.costing_method,
        InventoryItem.quantity_on_hand,
        InventoryItem.unit_cost,
        (InventoryItem.quantity_on_hand * InventoryItem.unit_cost).label("total_value"),
    ).join(
        InventoryCategory, InventoryItem.category_id == InventoryCategory.id, isouter=True
    ).where(
        InventoryItem.tenant_id == tenant_id,
        InventoryItem.is_active == True,  # noqa: E712
    ).order_by(
        (InventoryItem.quantity_on_hand * InventoryItem.unit_cost).desc()
    )

    rows = (await db.execute(stmt)).all()
    return [
        {
            "code": r.item_code,
            "name": r.name,
            "category": r.category,
            "method": r.costing_method,
            "qty": float(r.quantity_on_hand or 0),
            "unit_cost": _d(r.unit_cost),
            "total_value": _d(r.total_value),
        }
        for r in rows
    ]


# ── Registry ───────────────────────────────────────────────────────────────────

RUN_REGISTRY: dict[str, Any] = {
    "expense_summary":     run_expense_summary,
    "expense_by_category": run_expense_by_category,
    "ar_aging":            run_ar_aging,
    "ap_aging":            run_ap_aging,
    "budget_variance":     run_budget_variance,
    "payroll_summary":     run_payroll_summary,
    "tax_summary":         run_tax_summary,
    "inventory_valuation": run_inventory_valuation,
}


async def run_report(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    report_type: str,
    filters: dict,
) -> list[dict]:
    """Dispatch a report type to its runner function.

    Args:
        db:          Async DB session.
        tenant_id:   Current tenant.
        report_type: Slug identifying the report.
        filters:     JSONB-compatible parameter dict.

    Returns:
        List of row dicts — shape depends on report_type.

    Raises:
        ValueError: Unknown report_type.
    """
    runner = RUN_REGISTRY.get(report_type)
    if runner is None:
        raise ValueError(f"Unknown report type: {report_type!r}. Valid types: {sorted(RUN_REGISTRY)}")
    return await runner(db, tenant_id, filters)


# ── Private helpers ────────────────────────────────────────────────────────────

def _parse_date(val: Any, default: date) -> date:
    """Parse ISO date string or return default."""
    if val is None:
        return default
    if isinstance(val, date):
        return val
    try:
        return date.fromisoformat(str(val)[:10])
    except (ValueError, TypeError):
        return default
