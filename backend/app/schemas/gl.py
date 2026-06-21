"""
ZivaBI — GL engine Pydantic schemas.

Posting (Brief 1):
    JournalLineInput   — input for each line passed to post_journal().

Read / reporting (Brief 2):
    TrialBalanceRow    — one account row in the trial balance.
    TrialBalanceResponse — full TB response with grand totals + integrity flag.
    LedgerLine         — one posted line in an account ledger.
    AccountLedgerResponse — full ledger: opening balance, lines, closing balance.
"""

from datetime import date
from decimal import Decimal
from typing import Optional
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
