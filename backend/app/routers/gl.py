"""
ZivaBI — GL endpoints (GL Engine #2).

Prefix:  /api/gl
Tags:    gl

Endpoints:
    GET  /api/gl/trial-balance
        ?date_from=YYYY-MM-DD  &date_to=YYYY-MM-DD  &include_zero=false
        Returns per-account debit/credit/balance totals for POSTED entries,
        plus grand totals and an is_balanced integrity flag.

    GET  /api/gl/accounts/{gl_account_id}/ledger
        ?date_from=YYYY-MM-DD  &date_to=YYYY-MM-DD
        &dimension_id=UUID  &dimension_value_id=UUID
        Returns opening balance, ordered ledger lines with running balance,
        and closing balance. Supports optional JSONB dimension filter.

    GET  /api/gl/journal-entries                           (Q2)
        ?date_from=YYYY-MM-DD  &date_to=YYYY-MM-DD  &status=POSTED|DRAFT
        Lists journal entries for the tenant, most recent first, up to 200 rows.
        Any authenticated tenant user may read.

    POST /api/gl/journal-entries                           (Q2)
        Body: ManualJournalCreate — entry_date, description, lines, status.
        Creates a manual journal entry by wrapping post_journal().
        Tenant admin / power admin only.
        Lite mode: blocked (400) — manual journals require a GL.
        Connected mode: allowed (pre-export adjustments).
        Full ERP mode: primary use case.

    GET  /api/gl/financial-statements/pl                  (Q1a)
        ?date_from=YYYY-MM-DD  &date_to=YYYY-MM-DD
        Profit & Loss statement grouped by fs_head → fs_note.
        amount = total_credit − total_debit per account.
        Returns PLResponse: sections, net_income, has_unmapped.

    GET  /api/gl/financial-statements/bs                  (Q1a)
        ?as_at_date=YYYY-MM-DD
        Balance Sheet grouped by fs_head → fs_note (cumulative up to date).
        Returns BSResponse: sections, has_unmapped.

Guard:
    require_auth + must-have-tenant check (_require_gl_user).
    Fine-grained "finance roles only" RBAC is future. For now any authenticated
    business user in the tenant can read GL data. Super admin impersonating also works
    (their tenant_id is the impersonated tenant's ID).
"""

import uuid
from datetime import date
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import CurrentUser, require_auth
from app.models.gl import JournalEntry, JournalLine
from app.models.master_data import ChartOfAccount
from app.models.setup import TenantOrgConfig
from app.schemas.gl import (
    AccountLedgerResponse,
    BSResponse,
    JournalEntryListItem,
    JournalEntryOut,
    JournalLineInput,
    CFResponse,
    JournalLineOut,
    ManualJournalCreate,
    PLResponse,
    TrialBalanceResponse,
)
from app.services.gl_posting import PostingError, post_journal
from app.services.gl_reporting import account_ledger, balance_sheet, cash_flow, profit_and_loss, trial_balance

router = APIRouter(prefix="/api/gl", tags=["gl"])


# ── Guard ─────────────────────────────────────────────────────────────────────

def _require_gl_user(current_user: CurrentUser) -> uuid.UUID:
    """
    Return the caller's tenant_id, or raise 403 if not in a tenant context.

    Any authenticated business user may read GL data. RBAC-gating to finance
    roles is a future enhancement.
    """
    if not current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="GL reports require a business account with a tenant context.",
        )
    return current_user.tenant_id


# ── Trial balance ─────────────────────────────────────────────────────────────

@router.get("/trial-balance", response_model=TrialBalanceResponse)
async def get_trial_balance(
    date_from: Optional[date] = Query(None, description="Inclusive start date (YYYY-MM-DD)."),
    date_to: Optional[date] = Query(None, description="Inclusive end date (YYYY-MM-DD)."),
    include_zero: bool = Query(
        False,
        description="Include active accounts with zero activity in the date range.",
    ),
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> TrialBalanceResponse:
    """
    Compute the trial balance from POSTED journal lines.

    Returns per-account debit/credit totals and a net balance (debit − credit).
    Grand totals include an `is_balanced` flag — should always be True if the
    posting service enforced balance, but surfaced here as an integrity check.

    DRAFT and REVERSED entries are excluded.
    """
    tenant_id = _require_gl_user(current_user)
    return await trial_balance(
        db,
        tenant_id,
        date_from=date_from,
        date_to=date_to,
        include_zero=include_zero,
    )


# ── Account ledger ────────────────────────────────────────────────────────────

@router.get("/accounts/{gl_account_id}/ledger", response_model=AccountLedgerResponse)
async def get_account_ledger(
    gl_account_id: uuid.UUID,
    date_from: Optional[date] = Query(None, description="Start of period (inclusive)."),
    date_to: Optional[date] = Query(None, description="End of period (inclusive)."),
    dimension_id: Optional[uuid.UUID] = Query(
        None,
        description="Filter lines by this dimension (paired with dimension_value_id).",
    ),
    dimension_value_id: Optional[uuid.UUID] = Query(
        None,
        description="Filter lines to those with this dimension value.",
    ),
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> AccountLedgerResponse:
    """
    Retrieve a per-account ledger for the given GL account.

    Returns:
      - Account header (gl_number, gl_name, account_type).
      - Opening balance: sum of debit−credit for POSTED lines before date_from
        (0 if no date_from supplied).
      - Lines in [date_from, date_to], ordered by entry_date then reference_number,
        each with a running_balance.
      - Closing balance = opening + Σ(debit−credit) for all returned lines.

    To filter by dimension: supply both `dimension_id` and `dimension_value_id`.
    Uses PostgreSQL JSONB @> containment — only lines whose dimensions column
    contains the specified pair are returned.

    Returns 404 if the account does not exist or belongs to a different tenant.
    """
    tenant_id = _require_gl_user(current_user)

    dim_filter: Optional[dict[str, str]] = None
    if dimension_id is not None and dimension_value_id is not None:
        dim_filter = {str(dimension_id): str(dimension_value_id)}
    elif (dimension_id is None) != (dimension_value_id is None):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide both dimension_id and dimension_value_id, or neither.",
        )

    result = await account_ledger(
        db,
        tenant_id,
        gl_account_id,
        date_from=date_from,
        date_to=date_to,
        dimension_filter=dim_filter,
    )
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"GL account {gl_account_id} not found or does not belong to this tenant.",
        )
    return result


# ── Financial Statements (Q1a) ────────────────────────────────────────────────

@router.get("/financial-statements/pl", response_model=PLResponse)
async def get_profit_and_loss(
    date_from: Optional[date] = Query(None, description="Inclusive period start (YYYY-MM-DD)."),
    date_to: Optional[date] = Query(None, description="Inclusive period end (YYYY-MM-DD)."),
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> PLResponse:
    """
    Profit & Loss statement for the tenant.

    Groups all POSTED PL-account journal lines by fs_head → fs_note → gl_number.
    Sections are ordered by their lowest GL account number (Revenue before Expenses
    in any standard CoA numbering scheme).

    Sign convention — amount = total_credit − total_debit:
        Revenue / income groups: amount is positive (credit normal balance).
        Cost / expense groups: amount is negative (debit normal balance).
        net_income = Σ(all section totals) — positive = profit, negative = loss.

    Full ERP mode is the primary use case. Available in Connected mode for
    adjustments and accruals posted there. Lite mode has no in-app GL, so the
    caller should check posting_mode before calling this endpoint.

    Access: any authenticated tenant user.
    """
    tenant_id = _require_gl_user(current_user)
    return await profit_and_loss(db, tenant_id, date_from=date_from, date_to=date_to)


@router.get("/financial-statements/bs", response_model=BSResponse)
async def get_balance_sheet(
    as_at_date: Optional[date] = Query(
        None,
        description="Cumulative balance as at this date (YYYY-MM-DD). Omit for all-time.",
    ),
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> BSResponse:
    """
    Balance Sheet (Statement of Financial Position) for the tenant.

    Groups all POSTED BS-account journal lines (cumulative up to as_at_date) by
    fs_head → fs_note → gl_number.  Sections are ordered by their lowest GL number.

    Sign convention — amount = total_credit − total_debit:
        Asset sections: amount is negative (debit normal balance).
        Liability / Equity sections: amount is positive (credit normal balance).
        Frontend should display abs(amount) for asset lines, keep positive for L+E.

    Note: the BS will not foot to zero during the year unless a closing entry has
    been posted to transfer net income into retained earnings. This is expected
    accounting behaviour and is documented in the BSResponse schema.

    Access: any authenticated tenant user.
    """
    tenant_id = _require_gl_user(current_user)
    return await balance_sheet(db, tenant_id, as_at_date=as_at_date)


@router.get("/financial-statements/cf", response_model=CFResponse)
async def get_cash_flow(
    date_from: Optional[date] = Query(
        None,
        description="Period start date (YYYY-MM-DD). Omit for all-time from inception.",
    ),
    date_to: Optional[date] = Query(
        None,
        description="Period end date (YYYY-MM-DD). Omit for all posted entries to date.",
    ),
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> CFResponse:
    """
    Indirect method Cash Flow Statement for the tenant (Q1b). Full ERP mode only.

    Computes cash flows via the indirect method:
        A. Operating: net income ± non-cash adjustments ± working capital changes.
        B. Investing: movements in long-term asset / investment accounts.
        C. Financing: movements in debt, equity, and dividend accounts.

    Opening and closing cash balances are derived from GL accounts tagged
    cf_category='cash' (e.g. bank accounts, petty cash).

    Prerequisites (accounts must be tagged on the Chart of Accounts):
        cf_category = 'cash'       → cash & cash equivalents accounts.
        cf_category = 'operating'  → working capital BS accounts + non-cash PL items.
        cf_category = 'investing'  → capex / disposal accounts.
        cf_category = 'financing'  → debt / equity / dividend accounts.

    has_untagged_bs in the response is True if any BS account has posted activity
    but no cf_category — this signals an incomplete statement.

    Access: Full ERP tenants only (Lite and Connected tenants receive 403).
    """
    tenant_id = _require_gl_user(current_user)

    # Mode guard — Full ERP only
    posting_mode = await _get_posting_mode(tenant_id, db)
    if posting_mode != "full_erp":
        from fastapi import HTTPException
        raise HTTPException(
            status_code=403,
            detail="Cash Flow Statement is only available in Full ERP mode.",
        )

    return await cash_flow(db, tenant_id, date_from=date_from, date_to=date_to)


# ── Manual journal entries (Q2) ───────────────────────────────────────────────

async def _get_posting_mode(tenant_id: uuid.UUID, db: AsyncSession) -> str:
    """Return the tenant's posting_mode, defaulting to 'full_erp' if not set."""
    result = await db.execute(
        select(TenantOrgConfig.posting_mode).where(TenantOrgConfig.tenant_id == tenant_id)
    )
    return result.scalar_one_or_none() or "full_erp"


async def _build_entry_out(entry: JournalEntry, db: AsyncSession) -> JournalEntryOut:
    """
    Construct a JournalEntryOut from a flushed JournalEntry ORM object.

    Fetches GL account details (gl_number, gl_name) for each line so the API
    response is self-contained and the frontend does not need a second fetch.
    """
    gl_ids = [ln.gl_account_id for ln in entry.lines]
    gl_result = await db.execute(
        select(ChartOfAccount.id, ChartOfAccount.gl_number, ChartOfAccount.gl_name)
        .where(ChartOfAccount.id.in_(gl_ids))
    )
    gl_lookup: dict[uuid.UUID, tuple[str, str]] = {
        row.id: (row.gl_number, row.gl_name) for row in gl_result.all()
    }

    total_debit = Decimal("0")
    lines_out: list[JournalLineOut] = []
    for ln in sorted(entry.lines, key=lambda l: l.line_number):
        gl_number, gl_name = gl_lookup.get(ln.gl_account_id, ("UNKNOWN", "Unknown"))
        total_debit += ln.debit
        lines_out.append(JournalLineOut(
            line_number=ln.line_number,
            gl_account_id=ln.gl_account_id,
            gl_number=gl_number,
            gl_name=gl_name,
            debit=ln.debit,
            credit=ln.credit,
            description=ln.description,
            dimensions=ln.dimensions,
        ))

    return JournalEntryOut(
        id=entry.id,
        reference_number=entry.reference_number,
        entry_date=entry.entry_date,
        description=entry.description,
        source=entry.source,
        status=entry.status,
        created_at=entry.created_at,
        total_debit=total_debit,
        lines=lines_out,
    )


@router.get("/journal-entries", response_model=list[JournalEntryListItem])
async def list_journal_entries(
    date_from: Optional[date] = Query(None, description="Inclusive start date (YYYY-MM-DD)."),
    date_to: Optional[date] = Query(None, description="Inclusive end date (YYYY-MM-DD)."),
    entry_status: Optional[str] = Query(None, alias="status", description="Filter by status: DRAFT, POSTED, or REVERSED."),
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> list[JournalEntryListItem]:
    """
    List journal entries for the tenant.

    Returns up to 200 entries, most recent first.
    Any authenticated tenant user may read GL journal data.
    Filter by date range and/or status.
    """
    tenant_id = _require_gl_user(current_user)

    q = (
        select(JournalEntry)
        .where(JournalEntry.tenant_id == tenant_id)
        .order_by(JournalEntry.entry_date.desc(), JournalEntry.created_at.desc())
        .limit(200)
    )
    if date_from:
        q = q.where(JournalEntry.entry_date >= date_from)
    if date_to:
        q = q.where(JournalEntry.entry_date <= date_to)
    if entry_status:
        q = q.where(JournalEntry.status == entry_status.upper())

    result = await db.execute(q)
    entries = result.scalars().all()

    # For each entry, compute total_debit from journal_lines
    if not entries:
        return []

    entry_ids = [e.id for e in entries]
    lines_result = await db.execute(
        select(JournalLine.journal_entry_id, JournalLine.debit)
        .where(JournalLine.journal_entry_id.in_(entry_ids))
    )
    debit_totals: dict[uuid.UUID, Decimal] = {}
    for row in lines_result.all():
        debit_totals[row.journal_entry_id] = (
            debit_totals.get(row.journal_entry_id, Decimal("0")) + row.debit
        )

    return [
        JournalEntryListItem(
            id=e.id,
            reference_number=e.reference_number,
            entry_date=e.entry_date,
            description=e.description,
            source=e.source,
            status=e.status,
            total_debit=debit_totals.get(e.id, Decimal("0")),
            created_at=e.created_at,
        )
        for e in entries
    ]


@router.get("/journal-entries/{entry_id}", response_model=JournalEntryOut)
async def get_journal_entry(
    entry_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> JournalEntryOut:
    """
    Fetch a single journal entry by ID (with full line detail).

    Returns 404 if the entry does not exist or belongs to a different tenant.
    """
    tenant_id = _require_gl_user(current_user)

    result = await db.execute(
        select(JournalEntry).where(
            JournalEntry.id == entry_id,
            JournalEntry.tenant_id == tenant_id,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Journal entry {entry_id} not found.",
        )

    # Eagerly load lines
    lines_result = await db.execute(
        select(JournalLine)
        .where(JournalLine.journal_entry_id == entry_id)
        .order_by(JournalLine.line_number)
    )
    entry.lines = list(lines_result.scalars().all())  # type: ignore[assignment]

    return await _build_entry_out(entry, db)


@router.post("/journal-entries", response_model=JournalEntryOut, status_code=status.HTTP_201_CREATED)
async def create_journal_entry(
    data: ManualJournalCreate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> JournalEntryOut:
    """
    Create a manual journal entry.

    Wraps post_journal() — all validation (balance, GL accounts, dimensions,
    period postability) is enforced there. Returns the created entry with
    GL account details on each line.

    Access: tenant admin or power admin only.
    Mode: blocked in Lite mode (no GL engine available).
    """
    tenant_id = _require_gl_user(current_user)

    if not current_user.is_tenant_admin and not current_user.is_super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only tenant administrators may create manual journal entries.",
        )

    posting_mode = await _get_posting_mode(tenant_id, db)
    if posting_mode == "lite":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Manual journal entries are not available in Lite mode. "
                "Lite mode has no in-app GL — switch to Connected or Full ERP mode to use this feature."
            ),
        )

    lines_input = [
        JournalLineInput(
            gl_account_id=ln.gl_account_id,
            debit=ln.debit,
            credit=ln.credit,
            description=ln.description,
            dimensions=ln.dimensions,
        )
        for ln in data.lines
    ]

    try:
        entry = await post_journal(
            db,
            tenant_id,
            entry_date=data.entry_date,
            description=data.description,
            source="manual",
            lines=lines_input,
            created_by=current_user.user_id,
            module="manual",
            status=data.status,
        )
    except PostingError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=exc.message,
        ) from exc

    # post_journal() adds JournalLine rows via db.add() with the FK set directly,
    # never through the ORM relationship on `entry`. After db.flush() the in-memory
    # `entry.lines` collection is still an empty list. Re-fetch the lines explicitly
    # (same pattern used by get_journal_entry) so _build_entry_out returns a correct
    # response body instead of lines:[] / total_debit:0.
    lines_result = await db.execute(
        select(JournalLine)
        .where(JournalLine.journal_entry_id == entry.id)
        .order_by(JournalLine.line_number)
    )
    entry.lines = list(lines_result.scalars().all())  # type: ignore[assignment]

    return await _build_entry_out(entry, db)
