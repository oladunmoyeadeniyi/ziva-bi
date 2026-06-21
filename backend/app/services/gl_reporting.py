"""
ZivaBI — GL reporting service (GL Engine #2).

Pure read / compute functions. POSTED entries only (DRAFT and REVERSED excluded).
All money values are Decimal(18,2) — never float.

Functions:
    trial_balance(db, tenant_id, *, date_from, date_to, include_zero)
        → TrialBalanceResponse

    account_ledger(db, tenant_id, gl_account_id, *, date_from, date_to, dimension_filter)
        → AccountLedgerResponse | None  (None when account not found for this tenant)

REVERSED entries:
    Excluded — only status='POSTED' entries are counted. When reversals are built
    (future brief), a REVERSED entry and its reversing POSTED entry will naturally
    net to zero, giving correct balances. Excluding REVERSED at source is cleaner.

include_zero (trial_balance):
    False (default) — only accounts with at least one posted line in the date range.
    True            — all active accounts; zero-activity accounts show 0.00 / 0.00.

dimension_filter (account_ledger):
    Optional dict {str(dimension_id): str(dimension_value_id)}.
    Applied as a JSONB containment check: dimensions @> filter_dict.
    Uses PostgreSQL's @> operator which returns rows whose JSONB column contains
    all key-value pairs of the right-hand operand.
"""

import json
from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import cast, func, select
from sqlalchemy.dialects.postgresql import JSONB as PG_JSONB
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.gl import JournalEntry, JournalLine
from app.models.master_data import ChartOfAccount
from app.schemas.gl import (
    AccountLedgerResponse,
    LedgerLine,
    TrialBalanceResponse,
    TrialBalanceRow,
)

# Sentinel Decimal zero used throughout
_ZERO = Decimal("0")


def _d(v: object) -> Decimal:
    """Safely coerce a DB numeric result to Decimal(18,2)."""
    if v is None:
        return _ZERO
    return Decimal(str(v)).quantize(Decimal("0.01"))


# ── Trial balance ─────────────────────────────────────────────────────────────

async def trial_balance(
    db: AsyncSession,
    tenant_id: UUID,
    *,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    include_zero: bool = False,
) -> TrialBalanceResponse:
    """
    Compute per-account trial balance totals from POSTED journal lines.

    Parameters:
        db          — async session (read-only; no flush/commit needed).
        tenant_id   — the tenant to scope all queries to.
        date_from   — inclusive lower bound on entry_date (None = beginning of time).
        date_to     — inclusive upper bound on entry_date (None = end of time).
        include_zero — if True, include active accounts with zero activity.

    Returns:
        TrialBalanceResponse with per-account rows + grand totals + is_balanced flag.
    """

    # ── Build activity-row query ──────────────────────────────────────────────
    activity_q = (
        select(
            ChartOfAccount.gl_number,
            ChartOfAccount.gl_name,
            ChartOfAccount.account_type,
            func.sum(JournalLine.debit).label("total_debit"),
            func.sum(JournalLine.credit).label("total_credit"),
        )
        .select_from(JournalLine)
        .join(JournalEntry, JournalLine.journal_entry_id == JournalEntry.id)
        .join(ChartOfAccount, JournalLine.gl_account_id == ChartOfAccount.id)
        .where(
            JournalLine.tenant_id == tenant_id,
            JournalEntry.status == "POSTED",
        )
        .group_by(
            ChartOfAccount.gl_number,
            ChartOfAccount.gl_name,
            ChartOfAccount.account_type,
        )
        .order_by(ChartOfAccount.gl_number)
    )

    if date_from is not None:
        activity_q = activity_q.where(JournalEntry.entry_date >= date_from)
    if date_to is not None:
        activity_q = activity_q.where(JournalEntry.entry_date <= date_to)

    result = await db.execute(activity_q)
    activity_rows = result.all()

    # Build a set of account numbers already covered by activity
    active_gl_numbers: set[str] = {r.gl_number for r in activity_rows}

    rows: list[TrialBalanceRow] = [
        TrialBalanceRow(
            gl_number=r.gl_number,
            gl_name=r.gl_name,
            account_type=r.account_type,
            total_debit=_d(r.total_debit),
            total_credit=_d(r.total_credit),
            balance=_d(r.total_debit) - _d(r.total_credit),
        )
        for r in activity_rows
    ]

    # ── include_zero: add active accounts with no activity ────────────────────
    if include_zero:
        zero_q = (
            select(
                ChartOfAccount.gl_number,
                ChartOfAccount.gl_name,
                ChartOfAccount.account_type,
            )
            .where(
                ChartOfAccount.tenant_id == tenant_id,
                ChartOfAccount.is_active == True,  # noqa: E712
                ChartOfAccount.gl_number.not_in(active_gl_numbers)
                if active_gl_numbers
                else True,
            )
            .order_by(ChartOfAccount.gl_number)
        )
        zero_result = await db.execute(zero_q)
        for r in zero_result.all():
            rows.append(
                TrialBalanceRow(
                    gl_number=r.gl_number,
                    gl_name=r.gl_name,
                    account_type=r.account_type,
                    total_debit=_ZERO,
                    total_credit=_ZERO,
                    balance=_ZERO,
                )
            )
        # Re-sort by gl_number
        rows.sort(key=lambda x: x.gl_number)

    # ── Grand totals ──────────────────────────────────────────────────────────
    sum_debit  = sum((r.total_debit  for r in rows), _ZERO)
    sum_credit = sum((r.total_credit for r in rows), _ZERO)
    is_balanced = sum_debit == sum_credit

    return TrialBalanceResponse(
        rows=rows,
        sum_debit=sum_debit,
        sum_credit=sum_credit,
        is_balanced=is_balanced,
        date_from=date_from,
        date_to=date_to,
    )


# ── Account ledger ────────────────────────────────────────────────────────────

async def account_ledger(
    db: AsyncSession,
    tenant_id: UUID,
    gl_account_id: UUID,
    *,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    dimension_filter: Optional[dict[str, str]] = None,
) -> Optional[AccountLedgerResponse]:
    """
    Compute a per-account ledger from POSTED journal lines.

    Parameters:
        db               — async session (read-only).
        tenant_id        — tenant scope.
        gl_account_id    — the GL account to report on.
        date_from        — start of the period (inclusive); opening balance is computed
                           as the sum of all POSTED lines *before* this date.
        date_to          — end of the period (inclusive).
        dimension_filter — optional {str(dim_id): str(val_id)} JSONB containment filter.

    Returns:
        AccountLedgerResponse, or None if the account is not found for this tenant.

    JSONB dimension filter:
        Uses PostgreSQL @> operator: `dimensions @> '{"dim_id": "val_id"}'::jsonb`.
        This matches lines whose dimensions JSONB contains the specified key-value pair.
        Lines with dimensions=NULL are excluded when a filter is applied.
    """

    # ── Validate account belongs to this tenant ───────────────────────────────
    acct_result = await db.execute(
        select(ChartOfAccount).where(
            ChartOfAccount.id == gl_account_id,
            ChartOfAccount.tenant_id == tenant_id,
        )
    )
    acct = acct_result.scalar_one_or_none()
    if acct is None:
        return None

    # ── Opening balance: POSTED lines for this GL with entry_date < date_from ─
    opening_balance = _ZERO
    if date_from is not None:
        ob_q = (
            select(
                func.coalesce(func.sum(JournalLine.debit),  _ZERO).label("sum_debit"),
                func.coalesce(func.sum(JournalLine.credit), _ZERO).label("sum_credit"),
            )
            .join(JournalEntry, JournalLine.journal_entry_id == JournalEntry.id)
            .where(
                JournalLine.tenant_id == tenant_id,
                JournalLine.gl_account_id == gl_account_id,
                JournalEntry.status == "POSTED",
                JournalEntry.entry_date < date_from,
            )
        )
        ob_row = (await db.execute(ob_q)).one()
        opening_balance = _d(ob_row.sum_debit) - _d(ob_row.sum_credit)

    # ── Lines query ───────────────────────────────────────────────────────────
    lines_q = (
        select(
            JournalEntry.entry_date,
            JournalEntry.reference_number,
            JournalEntry.description.label("entry_description"),
            JournalLine.description.label("line_description"),
            JournalLine.debit,
            JournalLine.credit,
            JournalLine.dimensions,
        )
        .join(JournalEntry, JournalLine.journal_entry_id == JournalEntry.id)
        .where(
            JournalLine.tenant_id == tenant_id,
            JournalLine.gl_account_id == gl_account_id,
            JournalEntry.status == "POSTED",
        )
        .order_by(JournalEntry.entry_date, JournalEntry.reference_number)
    )

    if date_from is not None:
        lines_q = lines_q.where(JournalEntry.entry_date >= date_from)
    if date_to is not None:
        lines_q = lines_q.where(JournalEntry.entry_date <= date_to)

    # JSONB containment filter: dimensions @> '{"dim_id": "val_id"}'::jsonb
    if dimension_filter:
        dim_json = json.dumps(dimension_filter)
        lines_q = lines_q.where(
            JournalLine.dimensions.op("@>")(cast(dim_json, PG_JSONB))
        )

    raw_lines = (await db.execute(lines_q)).all()

    # ── Compute running balance ───────────────────────────────────────────────
    running = opening_balance
    ledger_lines: list[LedgerLine] = []
    for row in raw_lines:
        d = _d(row.debit)
        c = _d(row.credit)
        running = (running + d - c).quantize(Decimal("0.01"))
        ledger_lines.append(
            LedgerLine(
                entry_date=row.entry_date,
                reference_number=row.reference_number,
                entry_description=row.entry_description,
                line_description=row.line_description,
                debit=d,
                credit=c,
                running_balance=running,
                dimensions=row.dimensions,
            )
        )

    closing_balance = running

    return AccountLedgerResponse(
        gl_number=acct.gl_number,
        gl_name=acct.gl_name,
        account_type=acct.account_type,
        opening_balance=opening_balance,
        lines=ledger_lines,
        closing_balance=closing_balance,
        date_from=date_from,
        date_to=date_to,
    )
