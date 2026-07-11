"""
ZivaBI — Expense GL posting service.

Three-mode routing (docs/BRIEF_three_mode_architecture.md):

    full_erp  (default) — existing path unchanged.
        Builds balanced DR/CR journal lines and calls post_journal().
        The journal write is in the SAME DB transaction as the approval — a GL failure
        rolls back the entire approval. This invariant is preserved.

    connected — new path.
        Serialises approved journal lines to a PostingBatch row (JSONB) instead of
        journal_entries. The approval succeeds regardless (no GL write to fail).
        The finance team downloads/syncs the batch to their external ERP.

    lite — skip.
        No GL coding required. Approval succeeds immediately with no posting.

Return value — PostingResult dataclass:
    mode            — 'full_erp' | 'connected' | 'lite'
    journal_entry   — JournalEntry ORM object (full_erp only; else None)
    posting_batch   — PostingBatch ORM object (connected only; else None)
    reference       — human-readable reference for audit logs
"""

from dataclasses import dataclass
from datetime import date as date_type
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.expenses import ExpenseLine, ExpenseReport
from app.models.gl import JournalEntry, PostingBatch
from app.models.setup import TenantOrgConfig
from app.schemas.gl import JournalLineInput
from app.services.account_determination import resolve_account
from app.services.gl_posting import PostingError, post_journal


class ExpensePostingError(PostingError):
    """Raised when expense report cannot be posted due to incomplete GL coding."""

    def __init__(self, message: str) -> None:
        super().__init__("EXPENSE_CODING_INCOMPLETE", message)


@dataclass
class PostingResult:
    """Unified return type from post_expense_to_gl across all three posting modes."""

    mode: str
    reference: str
    journal_entry: Optional[JournalEntry] = None
    posting_batch: Optional[PostingBatch] = None


async def _next_batch_ref(db: AsyncSession, tenant_id: UUID, report_date: date_type) -> str:
    """Generate BATCH-{YYYY}-{MM}-{NNN} reference for a new posting batch."""
    from sqlalchemy import func as sqlfunc, extract

    year = report_date.year
    month = report_date.month

    result = await db.execute(
        select(sqlfunc.count(PostingBatch.id)).where(
            PostingBatch.tenant_id == tenant_id,
            extract("year", PostingBatch.created_at) == year,
            extract("month", PostingBatch.created_at) == month,
        )
    )
    count: int = result.scalar_one()
    return f"BATCH-{year}-{month:02d}-{count + 1:03d}"


async def post_expense_to_gl(
    db: AsyncSession,
    tenant_id: UUID,
    report: ExpenseReport,
    created_by: UUID,
) -> PostingResult:
    """
    Route expense report posting based on tenant posting_mode.

    Reads posting_mode from tenant_org_config and routes:
        lite      -> no posting, return immediately
        connected -> write to posting_batches
        full_erp  -> write to journal_entries (original path)

    Parameters:
        db          — async session shared with the calling approval transaction.
        tenant_id   — tenant UUID.
        report      — ExpenseReport with .lines already loaded.
        created_by  — UUID of the approver.

    Returns:
        PostingResult with mode, reference, and either journal_entry or posting_batch.

    Raises:
        ExpensePostingError — any leaf line lacks gl_id (full_erp + connected only).
        AccountMappingError — employee_payable role not mapped (full_erp + connected).
        PostingError        — GL-layer failure (full_erp only).
    """
    org_result = await db.execute(
        select(TenantOrgConfig.posting_mode).where(
            TenantOrgConfig.tenant_id == tenant_id
        )
    )
    posting_mode: str = org_result.scalar_one_or_none() or "full_erp"

    # LITE — no posting
    if posting_mode == "lite":
        return PostingResult(mode="lite", reference=f"LITE-{report.report_number}")

    # Shared validation for connected + full_erp
    leaf_lines: list[ExpenseLine] = [
        ln for ln in (report.lines or []) if not ln.is_split_parent
    ]

    if not leaf_lines:
        raise ExpensePostingError(
            f"Cannot post {report.report_number}: report has no expense lines."
        )

    uncoded_line_numbers = [ln.line_number for ln in leaf_lines if ln.gl_id is None]
    if uncoded_line_numbers:
        n = len(uncoded_line_numbers)
        nums = ", ".join(str(num) for num in uncoded_line_numbers)
        raise ExpensePostingError(
            f"Cannot post {report.report_number}: {n} line(s) missing GL coding "
            f"(line number(s): {nums}). All lines must be GL-coded before approval."
        )

    if posting_mode == "connected":
        return await _post_to_batch(db, tenant_id, report, leaf_lines, created_by)

    return await _post_to_gl(db, tenant_id, report, leaf_lines, created_by)


async def _post_to_batch(
    db: AsyncSession,
    tenant_id: UUID,
    report: ExpenseReport,
    leaf_lines: list[ExpenseLine],
    created_by: UUID,
) -> PostingResult:
    """
    Serialise journal lines to a PostingBatch row for Connected Mode.

    TIER 3: This path does NOT write to journal_entries. Approval is not gated
    on a GL failure — intentional for Connected Mode (period controls live in
    the external ERP). Employee payable is resolved so the export batch contains
    a complete balanced entry ready to import into the external ERP.
    """
    from app.models.master_data import ChartOfAccount

    payable_gl_id: UUID = await resolve_account(db, tenant_id, "employee_payable")

    all_gl_ids = list({ln.gl_id for ln in leaf_lines}) + [payable_gl_id]
    gl_result = await db.execute(
        select(ChartOfAccount.id, ChartOfAccount.gl_number, ChartOfAccount.gl_name)
        .where(ChartOfAccount.id.in_(all_gl_ids))
    )
    gl_lookup: dict[UUID, tuple[str, str]] = {
        row.id: (row.gl_number, row.gl_name) for row in gl_result.all()
    }

    transaction_lines = []
    for ln in leaf_lines:
        gl_code, gl_name = gl_lookup.get(ln.gl_id, ("UNKNOWN", "Unknown GL Account"))  # type: ignore[arg-type]
        line_amount = Decimal(str(ln.amount))
        transaction_lines.append({
            "gl_code": gl_code,
            "gl_name": gl_name,
            "debit": float(line_amount),
            "credit": 0.0,
            "description": f"{report.report_number} / Line {ln.line_number}: {ln.description}",
            "dimensions": ln.dimension_values or {},
        })

    payable_code, payable_name = gl_lookup.get(payable_gl_id, ("UNKNOWN", "Staff Payable"))
    transaction_lines.append({
        "gl_code": payable_code,
        "gl_name": payable_name,
        "debit": 0.0,
        "credit": float(Decimal(str(report.total_amount))),
        "description": f"Employee payable — {report.report_number}",
        "dimensions": {},
    })

    batch_ref = await _next_batch_ref(db, tenant_id, report.report_date)

    batch = PostingBatch(
        tenant_id=tenant_id,
        batch_ref=batch_ref,
        module="expense",
        status="pending",
        transactions=[{
            "entry_date": str(report.report_date),
            "description": f"Expense retirement — {report.report_number}",
            "source_module": "expense",
            "source_id": str(report.id),
            "lines": transaction_lines,
        }],
    )
    db.add(batch)
    await db.flush()

    return PostingResult(mode="connected", reference=batch_ref, posting_batch=batch)


async def _post_to_gl(
    db: AsyncSession,
    tenant_id: UUID,
    report: ExpenseReport,
    leaf_lines: list[ExpenseLine],
    created_by: UUID,
) -> PostingResult:
    """
    Build and post a balanced GL journal for Full ERP mode.

    TIER 3: approval transaction = GL transaction invariant fully preserved.
    A GL failure (closed period, bad account, unbalanced) rolls back the entire
    approval commit. This is the original post_expense_to_gl logic, unchanged.
    """
    payable_gl_id: UUID = await resolve_account(db, tenant_id, "employee_payable")

    journal_lines: list[JournalLineInput] = []
    sum_debits = Decimal("0.00")

    for ln in leaf_lines:
        line_amount = Decimal(str(ln.amount))
        sum_debits += line_amount
        journal_lines.append(
            JournalLineInput(
                gl_account_id=ln.gl_id,  # type: ignore[arg-type]
                debit=line_amount,
                credit=Decimal("0"),
                description=f"{report.report_number} / Line {ln.line_number}: {ln.description}",
                dimensions=ln.dimension_values,
            )
        )

    journal_lines.append(
        JournalLineInput(
            gl_account_id=payable_gl_id,
            debit=Decimal("0"),
            credit=Decimal(str(report.total_amount)),
            description=f"Employee payable — {report.report_number}",
        )
    )

    report_total = Decimal(str(report.total_amount))
    if sum_debits != report_total:
        raise ExpensePostingError(
            f"Cannot post {report.report_number}: sum of line amounts ({sum_debits}) "
            f"does not equal report total_amount ({report_total}). "
            "Report data may be inconsistent — correct the lines and resubmit."
        )

    entry: JournalEntry = await post_journal(
        db,
        tenant_id,
        entry_date=report.report_date,
        description=f"Expense retirement — {report.report_number}",
        source="expense",
        source_reference=report.report_number,
        lines=journal_lines,
        created_by=created_by,
        module="expense",
        status="POSTED",
    )

    return PostingResult(mode="full_erp", reference=entry.reference_number, journal_entry=entry)
