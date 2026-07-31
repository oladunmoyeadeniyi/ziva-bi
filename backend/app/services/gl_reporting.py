"""
PRAD — GL reporting service (GL Engine #2).

Financial Statements (Q1a):
    profit_and_loss(db, tenant_id, *, date_from, date_to)
        → PLResponse
        Groups PL accounts by fs_head → fs_note, ordered by gl_number.
        net = total_credit − total_debit (positive = income, negative = expense).

    balance_sheet(db, tenant_id, *, as_at_date)
        → BSResponse
        Cumulative BS account balances up to as_at_date.
        Same sign convention: net = total_credit − total_debit.

Cash Flow Statement — Indirect Method (Q1b):
    cash_flow(db, tenant_id, *, date_from, date_to)
        → CFResponse
        Indirect method: starts with net income from P&L, then adjusts for:
          - Non-cash PL items tagged cf_category='operating' (e.g. depreciation)
          - Working capital movements: BS accounts tagged cf_category='operating'
          - Investing movements: BS/PL accounts tagged cf_category='investing'
          - Financing movements: BS/PL accounts tagged cf_category='financing'
        Opening/closing cash derived from BS accounts tagged cf_category='cash'.



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
from collections import defaultdict
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
    BSResponse,
    CFGroup,
    CFLineItem,
    CFResponse,
    CFSection,
    FSGroup,
    FSLineItem,
    FSSection,
    LedgerLine,
    PLResponse,
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


# ── Financial statements helpers ──────────────────────────────────────────────

def _build_fs_response(rows: list, *, has_unmapped_check: bool = True) -> tuple[list[FSSection], bool]:
    """
    Build a list of FSSection objects from a flat list of DB rows.

    Each row must have: fs_head, fs_note, gl_number, gl_name, total_debit, total_credit.
    Rows must already be ordered by gl_number (ascending) — the first gl_number seen
    in each fs_head determines section order; the first within each (fs_head, fs_note)
    pair determines group order within the section.

    Returns (sections, has_unmapped) where has_unmapped is True if any row has
    fs_head IS NULL.
    """
    # Track insertion order via first-seen gl_number
    section_first: dict[str, str] = {}           # fs_head → first gl_number
    group_first: dict[tuple[str, str], str] = {} # (fs_head, fs_note) → first gl_number
    group_items: dict[tuple[str, str], list[FSLineItem]] = defaultdict(list)
    has_unmapped = False

    for row in rows:
        head = row.fs_head if row.fs_head else "Unclassified"
        note = row.fs_note if row.fs_note else "Unclassified"
        if row.fs_head is None:
            has_unmapped = True

        if head not in section_first:
            section_first[head] = row.gl_number
        gk = (head, note)
        if gk not in group_first:
            group_first[gk] = row.gl_number

        dr = _d(row.total_debit)
        cr = _d(row.total_credit)
        group_items[gk].append(FSLineItem(
            gl_number=row.gl_number,
            gl_name=row.gl_name,
            total_debit=dr,
            total_credit=cr,
            amount=cr - dr,
        ))

    # Sort sections and groups by first gl_number seen
    sorted_heads = sorted(section_first, key=lambda h: section_first[h])
    sections: list[FSSection] = []
    for head in sorted_heads:
        # All groups under this head, sorted by first gl_number
        head_groups = sorted(
            ((gk, gv) for gk, gv in group_first.items() if gk[0] == head),
            key=lambda kv: kv[1],
        )
        groups: list[FSGroup] = []
        for (_, note), _ in head_groups:
            items = group_items[(head, note)]
            subtotal = sum((i.amount for i in items), _ZERO)
            groups.append(FSGroup(label=note, items=items, subtotal=subtotal))

        section_total = sum((g.subtotal for g in groups), _ZERO)
        sections.append(FSSection(label=head, groups=groups, total=section_total))

    return sections, has_unmapped


# ── Profit & Loss ─────────────────────────────────────────────────────────────

async def profit_and_loss(
    db: AsyncSession,
    tenant_id: UUID,
    *,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> PLResponse:
    """
    Compute the Profit & Loss statement from POSTED journal lines.

    Parameters:
        db         — async session (read-only).
        tenant_id  — tenant scope.
        date_from  — inclusive lower bound on entry_date (None = beginning of time).
        date_to    — inclusive upper bound on entry_date (None = end of time).

    Returns:
        PLResponse with P&L sections ordered by first GL number in each section.
        net_income = sum of all section totals (positive = profit, negative = loss).
        has_unmapped = True if any PL account with activity has fs_head IS NULL.

    Sign convention:
        amount = total_credit − total_debit.
        Revenue / income accounts: credit normal → amount is positive.
        Expense / cost accounts: debit normal → amount is negative.
        Net income = Σ(revenue amounts) + Σ(expense amounts) = revenue − expenses.
    """
    q = (
        select(
            ChartOfAccount.fs_head,
            ChartOfAccount.fs_note,
            ChartOfAccount.gl_number,
            ChartOfAccount.gl_name,
            func.sum(JournalLine.debit).label("total_debit"),
            func.sum(JournalLine.credit).label("total_credit"),
        )
        .select_from(JournalLine)
        .join(JournalEntry, JournalLine.journal_entry_id == JournalEntry.id)
        .join(ChartOfAccount, JournalLine.gl_account_id == ChartOfAccount.id)
        .where(
            JournalLine.tenant_id == tenant_id,
            JournalEntry.status == "POSTED",
            ChartOfAccount.account_type == "PL",
        )
        .group_by(
            ChartOfAccount.fs_head,
            ChartOfAccount.fs_note,
            ChartOfAccount.gl_number,
            ChartOfAccount.gl_name,
        )
        .order_by(ChartOfAccount.gl_number)
    )
    if date_from is not None:
        q = q.where(JournalEntry.entry_date >= date_from)
    if date_to is not None:
        q = q.where(JournalEntry.entry_date <= date_to)

    rows = (await db.execute(q)).all()
    sections, has_unmapped = _build_fs_response(rows)
    net_income = sum((s.total for s in sections), _ZERO)

    return PLResponse(
        sections=sections,
        net_income=net_income,
        has_unmapped=has_unmapped,
        date_from=date_from,
        date_to=date_to,
    )


# ── Balance Sheet ─────────────────────────────────────────────────────────────

async def balance_sheet(
    db: AsyncSession,
    tenant_id: UUID,
    *,
    as_at_date: Optional[date] = None,
) -> BSResponse:
    """
    Compute the Balance Sheet from POSTED journal lines (cumulative).

    Parameters:
        db          — async session (read-only).
        tenant_id   — tenant scope.
        as_at_date  — upper bound on entry_date (None = all posted history).

    Returns:
        BSResponse with BS sections ordered by first GL number in each section.
        has_unmapped = True if any BS account with posted activity has fs_head IS NULL.

    Sign convention:
        amount = total_credit − total_debit.
        Asset accounts: debit normal → amount is negative (e.g. cash: −500,000).
        Liability / Equity accounts: credit normal → amount is positive (e.g. payables: +200,000).
        The frontend flips asset amounts for display (show absolute value as a positive asset figure).

    Note on balance check:
        Sum of all BS amounts ≈ 0 only after the year-end closing entry transfers
        net profit into retained earnings. During the year the BS will appear out of
        balance by the current-year P&L net income. This is expected accounting behaviour.
    """
    q = (
        select(
            ChartOfAccount.fs_head,
            ChartOfAccount.fs_note,
            ChartOfAccount.gl_number,
            ChartOfAccount.gl_name,
            func.sum(JournalLine.debit).label("total_debit"),
            func.sum(JournalLine.credit).label("total_credit"),
        )
        .select_from(JournalLine)
        .join(JournalEntry, JournalLine.journal_entry_id == JournalEntry.id)
        .join(ChartOfAccount, JournalLine.gl_account_id == ChartOfAccount.id)
        .where(
            JournalLine.tenant_id == tenant_id,
            JournalEntry.status == "POSTED",
            ChartOfAccount.account_type == "BS",
        )
        .group_by(
            ChartOfAccount.fs_head,
            ChartOfAccount.fs_note,
            ChartOfAccount.gl_number,
            ChartOfAccount.gl_name,
        )
        .order_by(ChartOfAccount.gl_number)
    )
    if as_at_date is not None:
        q = q.where(JournalEntry.entry_date <= as_at_date)

    rows = (await db.execute(q)).all()
    sections, has_unmapped = _build_fs_response(rows)

    return BSResponse(
        sections=sections,
        has_unmapped=has_unmapped,
        as_at_date=as_at_date,
    )


# ── Cash Flow Statement — Indirect Method (Q1b) ───────────────────────────────

async def _bs_balance_at(
    db: AsyncSession,
    tenant_id: UUID,
    gl_account_id: UUID,
    as_at: Optional[date],
) -> Decimal:
    """
    Return the cumulative (credit − debit) balance for a BS GL account up to as_at.

    If as_at is None, returns the all-time cumulative balance.
    Only POSTED journal entries are included.
    """
    q = (
        select(
            func.coalesce(func.sum(JournalLine.credit), _ZERO).label("sum_credit"),
            func.coalesce(func.sum(JournalLine.debit),  _ZERO).label("sum_debit"),
        )
        .join(JournalEntry, JournalLine.journal_entry_id == JournalEntry.id)
        .where(
            JournalLine.tenant_id == tenant_id,
            JournalLine.gl_account_id == gl_account_id,
            JournalEntry.status == "POSTED",
        )
    )
    if as_at is not None:
        q = q.where(JournalEntry.entry_date <= as_at)
    row = (await db.execute(q)).one()
    return _d(row.sum_credit) - _d(row.sum_debit)


async def _pl_period_amount(
    db: AsyncSession,
    tenant_id: UUID,
    gl_account_id: UUID,
    date_from: Optional[date],
    date_to: Optional[date],
) -> Decimal:
    """
    Return the period (credit − debit) for a PL GL account within [date_from, date_to].

    Only POSTED journal entries are included.
    """
    q = (
        select(
            func.coalesce(func.sum(JournalLine.credit), _ZERO).label("sum_credit"),
            func.coalesce(func.sum(JournalLine.debit),  _ZERO).label("sum_debit"),
        )
        .join(JournalEntry, JournalLine.journal_entry_id == JournalEntry.id)
        .where(
            JournalLine.tenant_id == tenant_id,
            JournalLine.gl_account_id == gl_account_id,
            JournalEntry.status == "POSTED",
        )
    )
    if date_from is not None:
        q = q.where(JournalEntry.entry_date >= date_from)
    if date_to is not None:
        q = q.where(JournalEntry.entry_date <= date_to)
    row = (await db.execute(q)).one()
    return _d(row.sum_credit) - _d(row.sum_debit)


def _build_cf_section(
    label: str,
    items: list[tuple[str, str, str]],  # (gl_number, gl_name, cf_sub_category)
    amounts: dict[str, Decimal],         # gl_number → CF amount
    net_income: Optional[Decimal] = None,
) -> CFSection:
    """
    Build a CFSection from a list of accounts and their computed CF amounts.

    Items are grouped by cf_sub_category ('Other' when None).
    Groups are ordered by first-seen gl_number.
    Section total = net_income (if present) + sum of all group subtotals.
    """
    from collections import defaultdict as _dd

    group_items: dict[str, list[CFLineItem]] = _dd(list)
    group_order: list[str] = []

    for gl_number, gl_name, sub_cat in items:
        label_key = sub_cat if sub_cat else "Other"
        if label_key not in group_order:
            group_order.append(label_key)
        amount = amounts.get(gl_number, _ZERO)
        group_items[label_key].append(
            CFLineItem(gl_number=gl_number, gl_name=gl_name, amount=amount)
        )

    groups: list[CFGroup] = []
    for gk in group_order:
        it = group_items[gk]
        subtotal = sum((i.amount for i in it), _ZERO)
        groups.append(CFGroup(label=gk, items=it, subtotal=subtotal))

    groups_total = sum((g.subtotal for g in groups), _ZERO)
    section_total = (net_income or _ZERO) + groups_total

    return CFSection(
        label=label,
        net_income=net_income,
        groups=groups,
        total=section_total,
    )


async def cash_flow(
    db: AsyncSession,
    tenant_id: UUID,
    *,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> CFResponse:
    """
    Compute the indirect method Cash Flow Statement from POSTED journal lines.

    Parameters:
        db         — async session (read-only).
        tenant_id  — tenant scope.
        date_from  — inclusive period start (None = beginning of all history).
        date_to    — inclusive period end (None = all posted entries to date).

    Returns:
        CFResponse with three sections (Operating, Investing, Financing) plus
        opening/closing cash balances and reconciliation flags.

    Algorithm (indirect method):
        A. OPERATING
           1. Start with net_income from profit_and_loss(date_from, date_to).
           2. Non-cash PL adjustments: PL accounts with cf_category='operating'.
              CF amount = −period_amount  (depreciation debit → add back positive).
           3. Working capital changes: BS accounts with cf_category='operating'.
              CF amount = closing_balance − opening_balance
              (asset grows: more negative → outflow; liability grows: more positive → inflow).

        B. INVESTING
           BS accounts with cf_category='investing': delta = closing − opening.
           PL accounts with cf_category='investing': −period_amount.

        C. FINANCING
           BS accounts with cf_category='financing': delta = closing − opening.
           PL accounts with cf_category='financing': −period_amount.

        D. CASH RECONCILIATION
           Opening cash = −Σ(balance of cf_category='cash' accounts up to date_from − 1 day).
           Closing cash from GL = −Σ(balance of cf_category='cash' accounts up to date_to).
           Net change = A.total + B.total + C.total.
           Closing cash (computed) = opening_cash + net_change.

    Sign conventions:
        CF amounts: positive = inflow, negative = outflow.
        Cash balances: always positive (negated from GL credit−debit convention).

    has_untagged_bs:
        True when at least one BS account has posted POSTED activity in the period AND
        cf_category IS NULL.  Signals to the user that the statement may be incomplete.
    """
    from datetime import timedelta

    # ── 1. Fetch net income for the period ────────────────────────────────────
    pl_result = await profit_and_loss(db, tenant_id, date_from=date_from, date_to=date_to)
    net_income = pl_result.net_income

    # ── 2. Load all cf_category-tagged GL accounts for this tenant ────────────
    tagged_q = (
        select(
            ChartOfAccount.id,
            ChartOfAccount.gl_number,
            ChartOfAccount.gl_name,
            ChartOfAccount.account_type,
            ChartOfAccount.cf_category,
            ChartOfAccount.cf_sub_category,
        )
        .where(
            ChartOfAccount.tenant_id == tenant_id,
            ChartOfAccount.is_active == True,  # noqa: E712
            ChartOfAccount.cf_category.in_(["operating", "investing", "financing", "cash"]),
        )
        .order_by(ChartOfAccount.gl_number)
    )
    tagged_rows = (await db.execute(tagged_q)).all()

    # ── 3. Determine opening date for delta computations ──────────────────────
    # opening = cumulative balance one day before date_from.
    # If date_from is None, opening balance is always zero (start of history).
    opening_date: Optional[date] = None
    if date_from is not None:
        opening_date = date_from - timedelta(days=1)

    # ── 4. Compute amounts for each tagged account ────────────────────────────
    # Buckets keyed by cf_category
    operating_items: list[tuple[str, str, str]] = []  # (gl_number, gl_name, cf_sub_category)
    investing_items: list[tuple[str, str, str]] = []
    financing_items: list[tuple[str, str, str]] = []
    amounts: dict[str, Decimal] = {}  # gl_number → CF amount

    opening_cash_raw = _ZERO
    closing_cash_raw = _ZERO

    for row in tagged_rows:
        gl_no   = row.gl_number
        gl_name = row.gl_name
        sub_cat = row.cf_sub_category or ""
        cat     = row.cf_category
        acct_id = row.id

        if cat == "cash":
            # Cash accounts feed the opening/closing cash reconciliation only — they do not
            # appear as line items in the statement body.  When date_from is None (all-time
            # from inception) the opening cash balance is zero by definition.
            if opening_date is not None:
                opening_cash_raw += await _bs_balance_at(db, tenant_id, acct_id, opening_date)
            closing_cash_raw += await _bs_balance_at(db, tenant_id, acct_id, date_to)
            continue

        if row.account_type in ("PL", "SOCI"):
            # Non-cash PL adjustment: CF amount = −period_amount
            period_amt = await _pl_period_amount(db, tenant_id, acct_id, date_from, date_to)
            cf_amt = -period_amt
        else:
            # BS account: CF amount = closing_balance − opening_balance.
            # When date_from is None, opening balance is zero (start of history).
            closing_bal = await _bs_balance_at(db, tenant_id, acct_id, date_to)
            opening_bal = (
                await _bs_balance_at(db, tenant_id, acct_id, opening_date)
                if opening_date is not None
                else _ZERO
            )
            cf_amt = closing_bal - opening_bal

        amounts[gl_no] = cf_amt.quantize(Decimal("0.01"))

        if cat == "operating":
            operating_items.append((gl_no, gl_name, sub_cat))
        elif cat == "investing":
            investing_items.append((gl_no, gl_name, sub_cat))
        elif cat == "financing":
            financing_items.append((gl_no, gl_name, sub_cat))

    # Cash accounts are debit-normal: their credit−debit amount is negative when cash exists.
    # Negate to display as positive cash balance figures.
    opening_cash = (-opening_cash_raw).quantize(Decimal("0.01"))
    gl_closing_cash = (-closing_cash_raw).quantize(Decimal("0.01"))

    # ── 5. Build sections ─────────────────────────────────────────────────────
    operating_section = _build_cf_section(
        "Operating Activities",
        operating_items,
        amounts,
        net_income=net_income,
    )
    investing_section = _build_cf_section("Investing Activities", investing_items, amounts)
    financing_section = _build_cf_section("Financing Activities", financing_items, amounts)

    sections = [operating_section, investing_section, financing_section]

    # ── 6. Net change and closing cash ────────────────────────────────────────
    net_change = sum((s.total for s in sections), _ZERO).quantize(Decimal("0.01"))
    closing_cash = (opening_cash + net_change).quantize(Decimal("0.01"))

    # ── 7. has_untagged_bs: any BS account with activity and no cf_category ───
    untagged_q = (
        select(func.count(ChartOfAccount.id.distinct()))
        .join(JournalLine, JournalLine.gl_account_id == ChartOfAccount.id)
        .join(JournalEntry, JournalLine.journal_entry_id == JournalEntry.id)
        .where(
            ChartOfAccount.tenant_id == tenant_id,
            ChartOfAccount.account_type.in_(["BS", "SOFP"]),
            ChartOfAccount.cf_category.is_(None),
            JournalEntry.status == "POSTED",
        )
    )
    if date_from is not None:
        untagged_q = untagged_q.where(JournalEntry.entry_date >= date_from)
    if date_to is not None:
        untagged_q = untagged_q.where(JournalEntry.entry_date <= date_to)
    untagged_count = (await db.execute(untagged_q)).scalar_one() or 0
    has_untagged_bs = int(untagged_count) > 0

    return CFResponse(
        sections=sections,
        net_income=net_income,
        net_change_in_cash=net_change,
        opening_cash=opening_cash,
        closing_cash=closing_cash,
        gl_closing_cash=gl_closing_cash,
        has_unmapped=False,  # reserved for future partial-result scenarios
        has_untagged_bs=has_untagged_bs,
        date_from=date_from,
        date_to=date_to,
    )
