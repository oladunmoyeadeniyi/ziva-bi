"""
PRAD — Bank Reconciliation Match Engine (M11c).

Provides:
    auto_match_statement()  — mode-aware auto-matcher for a whole statement
    recompute_line_status() — updates BankStatementLine.match_status based on
                              current matches (call after any match create/delete)
    build_recon_report()    — Full ERP reconciliation report with outstanding items

Auto-match algorithm:
    For each UNMATCHED or PARTIAL statement line, search for a candidate GL journal
    line (Full ERP) or posting batch (Connected) that satisfies:
        1. Same bank account (Full ERP: bank_account_id on journal_line)
           OR same module and approximate amount (Connected: posting_batches)
        2. Absolute amount difference ≤ tolerance (default: 0 — exact match)
        3. Date within ±date_tolerance_days (default: 5 calendar days)
        4. Not already fully matched to another statement line

    The best candidate (closest date, then closest amount) is selected.
    Lite mode: no auto-match — callers should not call auto_match_statement().

Design notes:
- All DB access is async (SQLAlchemy AsyncSession).
- This module does NOT commit; all flushes are the router's responsibility.
- recompute_line_status() is idempotent — safe to call multiple times.
- build_recon_report() is read-only (SELECT only) — safe to call on a locked statement.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bank_recon import BankStatement, BankStatementLine, BankReconMatch
from app.models.gl import JournalEntry, JournalLine
from app.models.gl import PostingBatch
from app.schemas.bank_recon import (
    AutoMatchResult,
    BankReconMatchResponse,
    OutstandingItem,
    ReconReport,
)


# ── Auto-match ────────────────────────────────────────────────────────────────

@dataclass
class _Candidate:
    """Internal holder for a match candidate found during auto-match search."""
    match_type: str
    journal_line_id: Optional[uuid.UUID]
    posting_batch_id: Optional[uuid.UUID]
    amount: Decimal
    candidate_date: date
    description: str
    date_diff: int  # abs(statement_date - candidate_date)
    amount_diff: Decimal  # abs(statement_amount - candidate_amount)


async def auto_match_statement(
    statement: BankStatement,
    posting_mode: str,
    db: AsyncSession,
    date_tolerance_days: int = 5,
    amount_tolerance: Decimal = Decimal("0"),
    matched_by: Optional[uuid.UUID] = None,
) -> AutoMatchResult:
    """
    Attempt to auto-match all UNMATCHED statement lines for the given statement.

    Args:
        statement:           The BankStatement ORM object (with .lines loaded).
        posting_mode:        'lite' | 'connected' | 'full_erp' — determines search space.
        db:                  AsyncSession (caller owns the transaction).
        date_tolerance_days: Max calendar days between statement line and GL/batch date.
        amount_tolerance:    Max absolute amount difference (default 0 = exact match).
        matched_by:          User UUID to record on created matches.

    Returns:
        AutoMatchResult summary.

    Note:
        Does nothing for 'lite' mode — returns all-zero summary immediately.
    """
    if posting_mode == "lite":
        return AutoMatchResult(
            matched_count=0,
            skipped_count=len(statement.lines),
            unmatched_count=0,
        )

    matched_count = 0
    skipped_count = 0
    unmatched_count = 0
    created_matches: list[BankReconMatch] = []

    for line in statement.lines:
        if line.match_status in ("MATCHED", "EXCLUDED"):
            skipped_count += 1
            continue

        line_amount = line.credit if line.credit > 0 else line.debit
        line_date = line.transaction_date

        candidate: Optional[_Candidate] = None

        if posting_mode == "full_erp":
            candidate = await _find_journal_line_candidate(
                bank_account_id=statement.bank_account_id,
                tenant_id=statement.tenant_id,
                statement_line=line,
                line_amount=line_amount,
                line_date=line_date,
                date_tolerance_days=date_tolerance_days,
                amount_tolerance=amount_tolerance,
                db=db,
            )
        elif posting_mode == "connected":
            candidate = await _find_posting_batch_candidate(
                tenant_id=statement.tenant_id,
                line_amount=line_amount,
                line_date=line_date,
                date_tolerance_days=date_tolerance_days,
                amount_tolerance=amount_tolerance,
                db=db,
            )

        if candidate:
            match = BankReconMatch(
                id=uuid.uuid4(),
                tenant_id=statement.tenant_id,
                statement_line_id=line.id,
                match_type=candidate.match_type,
                matched_journal_line_id=candidate.journal_line_id,
                matched_posting_batch_id=candidate.posting_batch_id,
                matched_amount=candidate.amount,
                notes="Auto-matched",
                matched_by=matched_by,
            )
            db.add(match)
            created_matches.append(match)
            await recompute_line_status(line, db, flush=False)
            matched_count += 1
        else:
            unmatched_count += 1

    await db.flush()

    # Build response after flush (IDs are now populated)
    matches_resp = [
        BankReconMatchResponse(
            id=m.id,
            statement_line_id=m.statement_line_id,
            match_type=m.match_type,
            matched_journal_line_id=m.matched_journal_line_id,
            matched_posting_batch_id=m.matched_posting_batch_id,
            matched_amount=m.matched_amount,
            notes=m.notes,
            matched_by=m.matched_by,
            matched_at=m.matched_at,
        )
        for m in created_matches
    ]

    return AutoMatchResult(
        matched_count=matched_count,
        skipped_count=skipped_count,
        unmatched_count=unmatched_count,
        matches_created=matches_resp,
    )


async def _find_journal_line_candidate(
    bank_account_id: uuid.UUID,
    tenant_id: uuid.UUID,
    statement_line: BankStatementLine,
    line_amount: Decimal,
    line_date: date,
    date_tolerance_days: int,
    amount_tolerance: Decimal,
    db: AsyncSession,
) -> Optional[_Candidate]:
    """
    Find the best unmatched journal line for this statement line (Full ERP mode).

    Bank perspective inversion:
        statement credit (money into account) ↔ GL debit on the bank GL account
        statement debit  (money out of account) ↔ GL credit on the bank GL account
    So we search the OPPOSITE side on the GL line.
    """
    is_credit_line = statement_line.credit > 0  # inflow → GL debit
    lo = line_date - timedelta(days=date_tolerance_days)
    hi = line_date + timedelta(days=date_tolerance_days)

    # Already-matched journal_line IDs for this statement (to avoid re-using them)
    matched_ids_res = await db.execute(
        select(BankReconMatch.matched_journal_line_id).where(
            BankReconMatch.tenant_id == tenant_id,
            BankReconMatch.matched_journal_line_id.is_not(None),
        )
    )
    matched_ids = {r for (r,) in matched_ids_res.all()}

    # Search journal lines on this bank account, within date window, correct side
    q = (
        select(JournalLine, JournalEntry.entry_date, JournalEntry.reference_number, JournalEntry.description)
        .join(JournalEntry, JournalLine.journal_entry_id == JournalEntry.id)
        .where(
            JournalLine.tenant_id == tenant_id,
            JournalLine.bank_account_id == bank_account_id,
            JournalEntry.entry_date >= lo,
            JournalEntry.entry_date <= hi,
            JournalEntry.status == "POSTED",
        )
    )
    rows = (await db.execute(q)).all()

    best: Optional[_Candidate] = None
    for jl, entry_date, ref_num, entry_desc in rows:
        if jl.id in matched_ids:
            continue
        # Bank credit ↔ GL debit; bank debit ↔ GL credit
        gl_amount = jl.debit if is_credit_line else jl.credit
        if gl_amount == 0:
            continue
        amount_diff = abs(line_amount - gl_amount)
        if amount_diff > amount_tolerance:
            continue
        date_diff = abs((line_date - entry_date).days)
        if best is None or (date_diff, amount_diff) < (best.date_diff, best.amount_diff):
            best = _Candidate(
                match_type="journal_line",
                journal_line_id=jl.id,
                posting_batch_id=None,
                amount=gl_amount,
                candidate_date=entry_date,
                description=entry_desc,
                date_diff=date_diff,
                amount_diff=amount_diff,
            )
    return best


async def _find_posting_batch_candidate(
    tenant_id: uuid.UUID,
    line_amount: Decimal,
    line_date: date,
    date_tolerance_days: int,
    amount_tolerance: Decimal,
    db: AsyncSession,
) -> Optional[_Candidate]:
    """
    Find the best unmatched posting batch for this statement line (Connected mode).

    Matching heuristic: total absolute amount of JSONB transactions ≈ line_amount,
    created_at date within tolerance. This is approximate — Connected-mode tenants
    should confirm auto-matches before closing the statement.
    """
    lo = line_date - timedelta(days=date_tolerance_days)
    hi = line_date + timedelta(days=date_tolerance_days)

    matched_batch_ids_res = await db.execute(
        select(BankReconMatch.matched_posting_batch_id).where(
            BankReconMatch.tenant_id == tenant_id,
            BankReconMatch.matched_posting_batch_id.is_not(None),
        )
    )
    matched_batch_ids = {r for (r,) in matched_batch_ids_res.all()}

    q = select(PostingBatch).where(
        PostingBatch.tenant_id == tenant_id,
        PostingBatch.status.in_(["pending", "exported"]),
        func.date(PostingBatch.created_at) >= lo,
        func.date(PostingBatch.created_at) <= hi,
    )
    batches = (await db.execute(q)).scalars().all()

    best: Optional[_Candidate] = None
    for batch in batches:
        if batch.id in matched_batch_ids:
            continue
        # Sum debits only — batch is balanced (Σdebits == Σcredits), so summing both
        # sides would double-count. Structure: [{lines: [{debit, credit, ...}]}]
        total = Decimal("0")
        if batch.transactions:
            for txn in batch.transactions:
                for line in txn.get("lines", []):
                    try:
                        total += Decimal(str(line.get("debit", 0)))
                    except Exception:
                        pass
        amount_diff = abs(line_amount - total)
        if amount_diff > amount_tolerance:
            continue
        batch_date = batch.created_at.date()
        date_diff = abs((line_date - batch_date).days)
        if best is None or (date_diff, amount_diff) < (best.date_diff, best.amount_diff):
            best = _Candidate(
                match_type="posting_batch",
                journal_line_id=None,
                posting_batch_id=batch.id,
                amount=total,
                candidate_date=batch_date,
                description=batch.batch_ref,
                date_diff=date_diff,
                amount_diff=amount_diff,
            )
    return best


# ── Line status recomputation ─────────────────────────────────────────────────

async def recompute_line_status(
    line: BankStatementLine,
    db: AsyncSession,
    flush: bool = True,
) -> None:
    """
    Recompute and persist BankStatementLine.match_status based on current matches.

    Status rules:
        EXCLUDED  — explicitly excluded (not changed by this function)
        MATCHED   — sum of matched_amount across all matches == line amount
        PARTIAL   — sum > 0 but < line amount
        UNMATCHED — no matches at all

    Args:
        line:  The BankStatementLine ORM object.
        db:    AsyncSession.
        flush: Whether to flush after updating. Set False when calling in a batch.
    """
    if line.match_status == "EXCLUDED":
        return  # EXCLUDED is set explicitly by the user; don't override it

    res = await db.execute(
        select(func.coalesce(func.sum(BankReconMatch.matched_amount), Decimal("0")))
        .where(BankReconMatch.statement_line_id == line.id)
    )
    total_matched: Decimal = res.scalar_one()

    line_amount = line.credit if line.credit > 0 else line.debit

    if total_matched == 0:
        line.match_status = "UNMATCHED"
    elif total_matched >= line_amount:
        line.match_status = "MATCHED"
    else:
        line.match_status = "PARTIAL"

    if flush:
        await db.flush()


# ── Reconciliation Report (Full ERP) ─────────────────────────────────────────

async def build_recon_report(
    statement: BankStatement,
    posting_mode: str,
    db: AsyncSession,
) -> ReconReport:
    """
    Build a reconciliation report for the given statement.

    Full ERP:
        GL book balance  = Σ debits − Σ credits on journal_lines for this bank_account
                           (cumulative, all time — same as the ledger balance)
        Outstanding deposits  = GL debits not yet appearing on any statement
        Outstanding payments  = GL credits not yet appearing on any statement
        Adjusted GL balance   = GL book balance
                                + Σ outstanding deposits
                                − Σ outstanding payments
                                == statement closing_balance  if balanced

    Lite / Connected:
        Only summary line counts are returned; GL balance fields are None.
    """
    # Line summary (all modes)
    lines_all = statement.lines
    total = len(lines_all)
    matched = sum(1 for l in lines_all if l.match_status == "MATCHED")
    excluded = sum(1 for l in lines_all if l.match_status == "EXCLUDED")
    unmatched = sum(1 for l in lines_all if l.match_status in ("UNMATCHED", "PARTIAL"))

    base = ReconReport(
        statement_id=statement.id,
        statement_ref=statement.statement_ref,
        bank_account_id=statement.bank_account_id,
        statement_date=statement.statement_date,
        opening_balance=statement.opening_balance,
        closing_balance=statement.closing_balance,
        total_lines=total,
        matched_lines=matched,
        excluded_lines=excluded,
        unmatched_lines=unmatched,
    )

    if posting_mode != "full_erp":
        return base

    # ── Full ERP: GL book balance ─────────────────────────────────────────────
    # Total debits and credits on GL lines tagged to this bank account
    bal_res = await db.execute(
        select(
            func.coalesce(func.sum(JournalLine.debit), Decimal("0")),
            func.coalesce(func.sum(JournalLine.credit), Decimal("0")),
        )
        .join(JournalEntry, JournalLine.journal_entry_id == JournalEntry.id)
        .where(
            JournalLine.tenant_id == statement.tenant_id,
            JournalLine.bank_account_id == statement.bank_account_id,
            JournalEntry.status == "POSTED",
        )
    )
    gl_debits, gl_credits = bal_res.one()
    gl_book_balance: Decimal = gl_debits - gl_credits

    # ── Outstanding items: GL lines not matched to any statement ─────────────
    matched_jl_ids_res = await db.execute(
        select(BankReconMatch.matched_journal_line_id).where(
            BankReconMatch.tenant_id == statement.tenant_id,
            BankReconMatch.matched_journal_line_id.is_not(None),
        )
    )
    matched_jl_ids = {r for (r,) in matched_jl_ids_res.all()}

    # Unmatched GL lines for this bank account
    unmatched_gl_res = await db.execute(
        select(JournalLine, JournalEntry.entry_date, JournalEntry.reference_number, JournalEntry.description)
        .join(JournalEntry, JournalLine.journal_entry_id == JournalEntry.id)
        .where(
            JournalLine.tenant_id == statement.tenant_id,
            JournalLine.bank_account_id == statement.bank_account_id,
            JournalEntry.status == "POSTED",
        )
        .order_by(JournalEntry.entry_date)
    )
    outstanding_deposits: list[OutstandingItem] = []
    outstanding_payments: list[OutstandingItem] = []

    for jl, e_date, ref_num, e_desc in unmatched_gl_res.all():
        if jl.id in matched_jl_ids:
            continue
        # Debit GL line = outstanding deposit (bank should show a credit eventually)
        if jl.debit > 0:
            outstanding_deposits.append(OutstandingItem(
                journal_entry_id=jl.journal_entry_id,
                entry_date=e_date,
                reference_number=ref_num,
                description=e_desc or "",
                amount=jl.debit,
            ))
        elif jl.credit > 0:
            outstanding_payments.append(OutstandingItem(
                journal_entry_id=jl.journal_entry_id,
                entry_date=e_date,
                reference_number=ref_num,
                description=e_desc or "",
                amount=jl.credit,
            ))

    total_deposits = sum(i.amount for i in outstanding_deposits)
    total_payments = sum(i.amount for i in outstanding_payments)
    adjusted_gl = gl_book_balance + total_deposits - total_payments

    # Reconciliation equation: adjusted GL balance == statement closing balance
    tolerance = Decimal("0.01")
    is_balanced = abs(adjusted_gl - statement.closing_balance) <= tolerance

    base.gl_book_balance = gl_book_balance
    base.outstanding_deposits = outstanding_deposits
    base.outstanding_payments = outstanding_payments
    base.total_outstanding_deposits = total_deposits
    base.total_outstanding_payments = total_payments
    base.adjusted_gl_balance = adjusted_gl
    base.is_balanced = is_balanced

    return base
