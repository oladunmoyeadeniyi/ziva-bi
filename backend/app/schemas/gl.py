"""
ZivaBI — GL engine Pydantic schemas.

Posting (Brief 1):
    JournalLineInput   — input for each line passed to post_journal().

Manual journal entry API (Q2):
    ManualJournalLineCreate — request line for POST /api/gl/journal-entries.
    ManualJournalCreate     — request body for POST /api/gl/journal-entries.
    JournalLineOut          — response line (includes gl_number/gl_name from JOIN).
    JournalEntryOut         — full entry response with lines.
    JournalEntryListItem    — lightweight entry for list views.

Read / reporting (Brief 2):
    TrialBalanceRow    — one account row in the trial balance.
    TrialBalanceResponse — full TB response with grand totals + integrity flag.
    LedgerLine         — one posted line in an account ledger.
    AccountLedgerResponse — full ledger: opening balance, lines, closing balance.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, field_validator


class JournalLineInput(BaseModel):
    """
    One line of a journal entry passed to post_journal().

    Invariants (enforced by the service, not here):
      - Exactly one of debit / credit must be > 0.
      - Both must be non-negative.
      - Across all lines in the journal: Σ debit == Σ credit.

    dimensions: maps each dimension UUID (as str) to a dimension_value UUID (as str).
    Example: {"<cost-center-dim-id>": "<ng-finance-value-id>"}
    """

    gl_account_id: UUID
    debit: Decimal = Decimal("0")
    credit: Decimal = Decimal("0")
    description: Optional[str] = None
    # {str(TenantDimension.id): str(DimensionValue.id)}
    dimensions: Optional[dict[str, str]] = None
    # Optional bank account tag — for reconciliation/reporting only.
    # Posting behaviour is UNAFFECTED when this is None (existing callers unchanged).
    bank_account_id: Optional[UUID] = None

    @field_validator("debit", "credit", mode="before")
    @classmethod
    def coerce_decimal(cls, v: object) -> Decimal:
        """Accept int/float inputs and coerce to Decimal."""
        return Decimal(str(v))


# ── Manual journal entry schemas (Q2) ────────────────────────────────────────

class ManualJournalLineCreate(BaseModel):
    """
    One line of a manually-created journal entry.

    Exactly one of debit / credit must be > 0 (enforced by post_journal()).
    dimensions: {str(TenantDimension.id): str(DimensionValue.id)}.
    """

    gl_account_id: UUID
    debit: Decimal = Decimal("0")
    credit: Decimal = Decimal("0")
    description: Optional[str] = None
    dimensions: Optional[dict[str, str]] = None

    @field_validator("debit", "credit", mode="before")
    @classmethod
    def coerce_decimal(cls, v: object) -> Decimal:
        """Accept int/float inputs and coerce to Decimal."""
        return Decimal(str(v))


class ManualJournalCreate(BaseModel):
    """
    Request body for POST /api/gl/journal-entries.

    status defaults to POSTED. Pass 'DRAFT' to save without period-date validation.
    Minimum 2 lines; must balance (Σ debit == Σ credit) — enforced by post_journal().
    """

    entry_date: date
    description: str
    lines: list[ManualJournalLineCreate]
    status: Literal["DRAFT", "POSTED"] = "POSTED"


class JournalLineOut(BaseModel):
    """One line in a journal entry response, enriched with GL account details."""

    line_number: int
    gl_account_id: UUID
    gl_number: str
    gl_name: str
    debit: Decimal
    credit: Decimal
    description: Optional[str] = None
    dimensions: Optional[dict[str, str]] = None


class JournalEntryOut(BaseModel):
    """
    Full journal entry response (header + lines).

    total_debit is the sum of all debit lines — equals total_credit when balanced.
    """

    id: UUID
    reference_number: str
    entry_date: date
    description: str
    source: str
    status: str
    created_at: datetime
    total_debit: Decimal
    lines: list[JournalLineOut]


class JournalEntryListItem(BaseModel):
    """Lightweight journal entry for list/table views (no line detail)."""

    id: UUID
    reference_number: str
    entry_date: date
    description: str
    source: str
    status: str
    total_debit: Decimal
    created_at: datetime


# ── Financial Statements schemas (Q1a) ───────────────────────────────────────

class FSLineItem(BaseModel):
    """
    A single GL account line in a financial statement.

    amount = total_credit − total_debit (positive = net income / liability / equity;
    negative = net expense / asset).  Callers flip sign for display where needed.
    """

    gl_number: str
    gl_name: str
    total_debit: Decimal
    total_credit: Decimal
    amount: Decimal  # total_credit − total_debit


class FSGroup(BaseModel):
    """
    A fs_note sub-section within a financial statement section.

    label     — fs_note value (or "Unclassified" when fs_note IS NULL on the CoA row).
    items     — GL accounts belonging to this sub-section, ordered by gl_number.
    subtotal  — sum of item amounts (same sign convention as FSLineItem.amount).
    """

    label: str
    items: list[FSLineItem]
    subtotal: Decimal


class FSSection(BaseModel):
    """
    A fs_head top-level section in a financial statement.

    label  — fs_head value (or "Unclassified" when fs_head IS NULL).
    groups — fs_note sub-sections within this section, ordered by first gl_number.
    total  — sum of group subtotals.
    """

    label: str
    groups: list[FSGroup]
    total: Decimal


class PLResponse(BaseModel):
    """
    Profit & Loss (Income Statement) response.

    sections   — P&L sections ordered by first GL number (Revenue first, Tax last
                 when using the standard CoA numbering scheme).
    net_income — sum of all section totals. Positive = profit; negative = loss.
    has_unmapped — True if any active PL accounts have fs_head IS NULL (unmapped).
    date_from / date_to — the period boundaries passed in the request.
    """

    sections: list[FSSection]
    net_income: Decimal
    has_unmapped: bool
    date_from: Optional[date] = None
    date_to: Optional[date] = None


class BSResponse(BaseModel):
    """
    Balance Sheet (Statement of Financial Position) response.

    sections   — BS sections ordered by first GL number (assets first, equity last
                 when using the standard CoA numbering scheme).
    has_unmapped — True if any BS accounts with posted transactions have fs_head IS NULL.
    as_at_date — upper date bound for the cumulative balance query (None = all time).

    Note on balance check:
        Retained earnings do not include current-year profit until a closing entry is
        posted. During the year, total BS debits ≠ total BS credits unless a closing
        entry exists. The raw totals are supplied; the caller may compute a check.
    """

    sections: list[FSSection]
    has_unmapped: bool
    as_at_date: Optional[date] = None


# ── GL read / reporting schemas (Brief 2) ────────────────────────────────────

class TrialBalanceRow(BaseModel):
    """One account row in the trial balance."""

    gl_number: str
    gl_name: str
    account_type: str       # 'PL' | 'BS'
    total_debit: Decimal
    total_credit: Decimal
    balance: Decimal        # total_debit − total_credit (positive = net debit)


class TrialBalanceResponse(BaseModel):
    """
    Full trial balance response.

    rows      — per-account debit/credit/balance (filtered by date range).
    sum_debit — grand total of all debits across rows.
    sum_credit — grand total of all credits across rows.
    is_balanced — True when sum_debit == sum_credit to 2dp (integrity check).
    """

    rows: list[TrialBalanceRow]
    sum_debit: Decimal
    sum_credit: Decimal
    is_balanced: bool
    date_from: Optional[date] = None
    date_to: Optional[date] = None


class LedgerLine(BaseModel):
    """One posted journal line in an account ledger, in chronological order."""

    entry_date: date
    reference_number: str
    entry_description: str
    line_description: Optional[str] = None
    debit: Decimal
    credit: Decimal
    running_balance: Decimal    # opening + Σ(debit−credit) through this line
    dimensions: Optional[dict[str, str]] = None  # {str(dim_id): str(val_id)}


class AccountLedgerResponse(BaseModel):
    """
    Full account ledger response.

    opening_balance — sum of debit−credit for POSTED lines before date_from (0 if no date_from).
    lines           — POSTED lines in [date_from, date_to], ordered entry_date then ref_number.
    closing_balance — opening_balance + Σ(debit−credit) for all lines.
    """

    gl_number: str
    gl_name: str
    account_type: str
    opening_balance: Decimal
    lines: list[LedgerLine]
    closing_balance: Decimal
    date_from: Optional[date] = None
    date_to: Optional[date] = None
