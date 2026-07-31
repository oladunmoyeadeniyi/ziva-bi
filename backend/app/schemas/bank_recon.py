"""
PRAD — Bank Reconciliation Pydantic schemas (M11c).

Covers:
    BankStatement  — CRUD + status transitions
    BankStatementLine — response shape + bulk create (from parsed CSV)
    BankReconMatch — create (manual / auto) + response
    ReconReport    — reconciliation summary report (Full ERP: GL book balance + outstanding)
    AutoMatchResult — result of the auto-match engine run
    StatementLineParsed — internal shape from the CSV/Excel parser (not a route schema)
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, field_validator, model_validator


# ── Statement ─────────────────────────────────────────────────────────────────

class BankStatementCreate(BaseModel):
    """
    Body for POST /api/bank-recon/statements.
    statement_ref is auto-assigned by the router if omitted.
    """
    bank_account_id: uuid.UUID
    statement_date: date
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    file_name: Optional[str] = None
    opening_balance: Decimal
    closing_balance: Decimal
    currency: str
    notes: Optional[str] = None


class BankStatementResponse(BaseModel):
    """Full statement header returned from list/detail endpoints."""
    id: uuid.UUID
    tenant_id: uuid.UUID
    bank_account_id: uuid.UUID
    statement_ref: str
    statement_date: date
    period_start: Optional[date]
    period_end: Optional[date]
    file_name: Optional[str]
    opening_balance: Decimal
    closing_balance: Decimal
    currency: str
    status: str
    notes: Optional[str]
    uploaded_by: Optional[uuid.UUID]
    created_at: datetime
    updated_at: datetime

    # Computed line counts — populated by query annotation, not ORM field
    total_lines: Optional[int] = None
    matched_lines: Optional[int] = None
    unmatched_lines: Optional[int] = None

    model_config = {"from_attributes": True}


class BankStatementDetail(BankStatementResponse):
    """Statement + all lines, returned from GET /api/bank-recon/statements/{id}."""
    lines: list["BankStatementLineResponse"] = []


# ── Statement Lines ───────────────────────────────────────────────────────────

class BankStatementLineCreate(BaseModel):
    """
    One parsed statement line — used internally when the CSV upload creates lines
    in bulk. Not a public route schema; see the upload endpoint body.
    """
    line_number: int
    transaction_date: date
    value_date: Optional[date] = None
    description: str
    reference: Optional[str] = None
    debit: Decimal = Decimal("0")
    credit: Decimal = Decimal("0")
    running_balance: Optional[Decimal] = None

    @model_validator(mode="after")
    def _one_side(self) -> "BankStatementLineCreate":
        """Exactly one of debit/credit must be > 0, or both zero (opening row)."""
        if self.debit < 0 or self.credit < 0:
            raise ValueError("debit and credit must be non-negative.")
        if self.debit > 0 and self.credit > 0:
            raise ValueError("A statement line cannot have both debit and credit > 0.")
        return self


class BankStatementLineResponse(BaseModel):
    """Statement line as returned to the frontend."""
    id: uuid.UUID
    statement_id: uuid.UUID
    line_number: int
    transaction_date: date
    value_date: Optional[date]
    description: str
    reference: Optional[str]
    debit: Decimal
    credit: Decimal
    running_balance: Optional[Decimal]
    match_status: str
    matches: list["BankReconMatchResponse"] = []

    model_config = {"from_attributes": True}


# ── Matches ───────────────────────────────────────────────────────────────────

class BankReconMatchCreate(BaseModel):
    """
    Body for POST /api/bank-recon/matches.

    match_type rules:
        'journal_line'  → matched_journal_line_id required
        'posting_batch' → matched_posting_batch_id required
        'manual'        → neither FK required; notes encouraged
    """
    statement_line_id: uuid.UUID
    match_type: str  # 'journal_line' | 'posting_batch' | 'manual'
    matched_journal_line_id: Optional[uuid.UUID] = None
    matched_posting_batch_id: Optional[uuid.UUID] = None
    matched_amount: Decimal
    notes: Optional[str] = None

    @field_validator("match_type")
    @classmethod
    def _valid_type(cls, v: str) -> str:
        allowed = {"journal_line", "posting_batch", "manual"}
        if v not in allowed:
            raise ValueError(f"match_type must be one of {sorted(allowed)}")
        return v

    @model_validator(mode="after")
    def _validate_fks(self) -> "BankReconMatchCreate":
        if self.match_type == "journal_line" and not self.matched_journal_line_id:
            raise ValueError("matched_journal_line_id is required for match_type='journal_line'.")
        if self.match_type == "posting_batch" and not self.matched_posting_batch_id:
            raise ValueError("matched_posting_batch_id is required for match_type='posting_batch'.")
        if self.matched_amount <= 0:
            raise ValueError("matched_amount must be > 0.")
        return self


class BankReconMatchResponse(BaseModel):
    """A single match record."""
    id: uuid.UUID
    statement_line_id: uuid.UUID
    match_type: str
    matched_journal_line_id: Optional[uuid.UUID]
    matched_posting_batch_id: Optional[uuid.UUID]
    matched_amount: Decimal
    notes: Optional[str]
    matched_by: Optional[uuid.UUID]
    matched_at: datetime

    # Denormalised display fields populated by query joins
    gl_description: Optional[str] = None
    gl_reference: Optional[str] = None
    batch_ref: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Auto-match ────────────────────────────────────────────────────────────────

class AutoMatchResult(BaseModel):
    """
    Summary returned by POST /api/bank-recon/statements/{id}/auto-match.

    matched_count   — number of statement lines newly matched
    skipped_count   — lines already matched or excluded (not re-processed)
    unmatched_count — lines where no suitable GL/batch entry was found
    """
    matched_count: int
    skipped_count: int
    unmatched_count: int
    matches_created: list[BankReconMatchResponse] = []


# ── Unmatched GL / Batch candidates ──────────────────────────────────────────

class UnmatchedJournalLineResponse(BaseModel):
    """
    A GL journal line eligible for matching (Full ERP mode).
    Bank-perspective amount is provided (credit on GL = debit from bank, etc.)
    """
    id: uuid.UUID
    journal_entry_id: uuid.UUID
    entry_date: date
    reference_number: str
    description: str
    gl_account_code: Optional[str] = None
    gl_account_name: Optional[str] = None
    debit: Decimal
    credit: Decimal
    # bank-perspective amount (inverted): what the bank would show for this GL line
    bank_amount: Decimal

    model_config = {"from_attributes": True}


class UnmatchedPostingBatchResponse(BaseModel):
    """A posting batch eligible for matching (Connected mode)."""
    id: uuid.UUID
    batch_ref: str
    module: str
    status: str
    created_at: datetime
    # Total value across all transactions in the batch JSONB
    total_amount: Optional[Decimal] = None

    model_config = {"from_attributes": True}


# ── Reconciliation Report ─────────────────────────────────────────────────────

class OutstandingItem(BaseModel):
    """One reconciling item: a GL entry present in the books but not on the statement."""
    journal_entry_id: uuid.UUID
    entry_date: date
    reference_number: str
    description: str
    amount: Decimal  # positive = outstanding debit in GL (payment not cleared)


class ReconReport(BaseModel):
    """
    Full reconciliation report for a bank statement.

    Full ERP mode only — for Lite/Connected, only the summary fields are populated.

    Reconciliation equation:
        GL book balance
        + outstanding deposits (in GL, not yet on statement)
        - outstanding payments (in GL, not yet on statement)
        = statement closing balance   ← proves the recon

    is_balanced is True when the equation holds (within rounding tolerance).
    """
    statement_id: uuid.UUID
    statement_ref: str
    bank_account_id: uuid.UUID
    statement_date: date
    opening_balance: Decimal
    closing_balance: Decimal  # from statement

    # Full ERP only
    gl_book_balance: Optional[Decimal] = None  # GL debits - credits for bank account
    outstanding_deposits: list[OutstandingItem] = []   # in GL, not on statement
    outstanding_payments: list[OutstandingItem] = []   # in GL, not on statement
    total_outstanding_deposits: Decimal = Decimal("0")
    total_outstanding_payments: Decimal = Decimal("0")
    adjusted_gl_balance: Optional[Decimal] = None  # gl_book_balance + outstanding adjustments

    # Summary (all modes)
    total_lines: int
    matched_lines: int
    excluded_lines: int
    unmatched_lines: int
    is_balanced: Optional[bool] = None  # None = Lite/Connected (not computable without GL)


# ── CSV Upload ────────────────────────────────────────────────────────────────

class UploadResult(BaseModel):
    """
    Response after POST /api/bank-recon/statements/{id}/upload.
    lines_parsed  — total rows found in the file
    lines_created — rows successfully saved (validation errors are skipped with a warning)
    warnings      — list of human-readable parse warnings (row index + issue)
    """
    lines_parsed: int
    lines_created: int
    warnings: list[str] = []


# forward refs
BankStatementDetail.model_rebuild()
BankStatementLineResponse.model_rebuild()
