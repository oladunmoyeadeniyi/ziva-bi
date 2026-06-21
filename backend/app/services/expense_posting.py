"""
ZivaBI — Expense GL posting service.

Called by the final-approval step in approvals.py to post a balanced journal
entry for an approved expense retirement report.

post_expense_to_gl:
    1. Collects leaf expense lines (skips is_split_parent=True containers, which
       are amount-rollup placeholders; only their child lines carry real GLs).
    2. Validates all leaf lines have gl_id — raises ExpensePostingError if any
       are uncoded. This surfaces back to the approver as 422.
    3. Resolves the employee_payable control account via resolve_account.
       AccountMappingError propagates — Finance must map the role first.
    4. Builds journal lines: one DEBIT per expense line + one CREDIT to payable.
    5. Pre-flight: verifies Σdebit == report.total_amount before calling
       post_journal, so the error message is clear rather than generic UNBALANCED.
    6. Calls post_journal (validates GL accounts, dimension requirements, period
       openness, balance). The same DB session is shared — no extra commit.
    7. Returns the flushed JournalEntry for the caller to reference in audit logs.

Commit pattern (inherited from gl_posting.py):
    This service and post_journal call db.flush() only. The caller's get_db()
    dependency commits on success and rolls back on any exception. A posting
    failure therefore prevents the entire approval transaction from being committed.
"""

from decimal import Decimal
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.expenses import ExpenseLine, ExpenseReport
from app.models.gl import JournalEntry
from app.schemas.gl import JournalLineInput
from app.services.account_determination import resolve_account  # AccountMappingError propagates
from app.services.gl_posting import PostingError, post_journal


# ── Domain exception ──────────────────────────────────────────────────────────

class ExpensePostingError(PostingError):
    """
    Raised when the expense report cannot be posted due to incomplete GL coding.

    Subclasses PostingError so callers can catch either class. The fixed code
    EXPENSE_CODING_INCOMPLETE is set here; the message is always caller-supplied.
    """

    def __init__(self, message: str) -> None:
        super().__init__("EXPENSE_CODING_INCOMPLETE", message)


# ── Posting function ──────────────────────────────────────────────────────────

async def post_expense_to_gl(
    db: AsyncSession,
    tenant_id: UUID,
    report: ExpenseReport,
    created_by: UUID,
) -> JournalEntry:
    """
    Build and post a balanced GL journal for a fully-approved expense report.

    Journal structure:
        DEBIT  — one line per leaf expense line (gl_id, amount, dimension_values)
        CREDIT — employee_payable control account for report.total_amount

    Parameters:
        db          — async session shared with the calling transaction.
        tenant_id   — tenant UUID (for GL lookup and posting-role resolution).
        report      — ExpenseReport with .lines already loaded (selectinload).
        created_by  — UUID of the approver triggering the final approval.

    Returns:
        The flushed JournalEntry ORM object (not yet committed; caller commits).

    Raises:
        ExpensePostingError — any leaf line lacks gl_id.
        AccountMappingError — employee_payable role not mapped for this tenant.
        PostingError        — any GL-layer failure (bad account, closed period, etc.).
    """

    # 1. Collect leaf lines — skip split parent containers.
    #    A split parent (is_split_parent=True) holds the rolled-up total of its
    #    child lines. The children carry the actual GLs and individual amounts.
    #    Posting parent + children would double-count, so parents are excluded.
    leaf_lines: list[ExpenseLine] = [
        ln for ln in (report.lines or [])
        if not ln.is_split_parent
    ]

    if not leaf_lines:
        raise ExpensePostingError(
            f"Cannot post {report.report_number}: report has no expense lines."
        )

    # 2. Validate full GL coding — every leaf line must have gl_id.
    uncoded_line_numbers = [
        ln.line_number for ln in leaf_lines if ln.gl_id is None
    ]
    if uncoded_line_numbers:
        n = len(uncoded_line_numbers)
        nums = ", ".join(str(num) for num in uncoded_line_numbers)
        raise ExpensePostingError(
            f"Cannot post {report.report_number}: {n} line(s) missing GL coding "
            f"(line number(s): {nums}). All lines must be GL-coded before approval."
        )

    # 3. Resolve employee_payable control account.
    #    AccountMappingError propagates to the router, which wraps it as 422.
    payable_gl_id: UUID = await resolve_account(db, tenant_id, "employee_payable")

    # 4. Build journal lines.
    journal_lines: list[JournalLineInput] = []
    sum_debits = Decimal("0.00")

    for ln in leaf_lines:
        line_amount = Decimal(str(ln.amount))
        sum_debits += line_amount
        journal_lines.append(
            JournalLineInput(
                gl_account_id=ln.gl_id,  # type: ignore[arg-type]  # validated non-None above
                debit=line_amount,
                credit=Decimal("0"),
                description=(
                    f"{report.report_number} / Line {ln.line_number}: {ln.description}"
                ),
                # dimension_values is {str(dim_id): str(value_id)} — same shape as JournalLineInput.dimensions
                dimensions=ln.dimension_values,
            )
        )

    # Credit line: employee payable for the full report amount.
    journal_lines.append(
        JournalLineInput(
            gl_account_id=payable_gl_id,
            debit=Decimal("0"),
            credit=Decimal(str(report.total_amount)),
            description=f"Employee payable — {report.report_number}",
        )
    )

    # 5. Pre-flight balance check — clearer message than post_journal's UNBALANCED.
    report_total = Decimal(str(report.total_amount))
    if sum_debits != report_total:
        raise ExpensePostingError(
            f"Cannot post {report.report_number}: sum of line amounts ({sum_debits}) "
            f"does not equal report total_amount ({report_total}). "
            "Report data may be inconsistent — correct the lines and resubmit."
        )

    # 6. Post — validates GL accounts, dimension requirements, period openness, balance.
    #    post_journal calls db.flush() only; this stays in the caller's transaction.
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

    return entry
