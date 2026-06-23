"""
ZivaBI — Central GL posting service (GL Engine #1).

ONE function that every module calls to post a balanced journal entry:
    post_journal(db, tenant_id, *, entry_date, description, source, lines, ...) -> JournalEntry

Validation order (raises PostingError on first failure):
    1. At least 2 lines.
    2. Each line: exactly one of debit/credit > 0, the other 0; no negatives.
    3. Σ debits == Σ credits (to 2 dp).
    4. Every gl_account_id exists, is_active, belongs to this tenant.
    5. Dimension values exist + belong to tenant; GLDimensionRequirement honoured:
         required → dimension MUST be present on line
         na       → dimension MUST NOT be present on line
         optional → either is fine
    6. (POSTED only) entry_date passes is_date_postable(tenant_id, entry_date, db, module=module).
    7. Persist: JournalEntry + JournalLines; set status + posted_at; return entry.

Commit pattern:
    This service calls db.flush() only — never db.commit(). The calling router's
    get_db() dependency commits on success (see database.py). This means:
    - All inserts land in the current transaction.
    - If any subsequent code raises before the router returns, the whole transaction
      rolls back cleanly with no partial writes.

DRAFT vs POSTED:
    - DRAFT: steps 1–5 run; step 6 (date-postable) is SKIPPED. DRAFT entries are
      staging areas that may be promoted to POSTED later.
    - POSTED: all 6 steps must pass.

reference_number generation:
    "JE-{YYYY}-{NNNNNN}" — YYYY from entry_date, NNNNNN = COUNT(existing entries
    for this tenant) + 1, zero-padded to 6 digits. A UNIQUE constraint on
    (tenant_id, reference_number) catches any race-condition collision at the DB
    layer (extremely unlikely in practice; callers may retry on UniqueViolation if needed).
"""

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bank_account import BankAccount
from app.models.gl import JournalEntry, JournalLine
from app.models.master_data import ChartOfAccount, DimensionValue, GLDimensionRequirement
from app.schemas.gl import JournalLineInput
from app.services.periods import is_date_postable


# ── Domain exception ──────────────────────────────────────────────────────────

class PostingError(Exception):
    """
    Raised by post_journal on any validation failure.

    Attributes:
        code    — machine-readable error code (see constants below).
        message — human-readable description safe to surface in API responses.

    Error codes:
        INSUFFICIENT_LINES          — fewer than 2 lines supplied
        INVALID_LINE_AMOUNTS        — both debit and credit are 0, or both > 0
        NEGATIVE_AMOUNT             — debit or credit is negative
        UNBALANCED                  — Σ debits ≠ Σ credits
        INVALID_GL_ACCOUNT          — gl_account_id not found for this tenant
        INACTIVE_GL_ACCOUNT         — gl account exists but is_active=False
        WRONG_TENANT_GL_ACCOUNT     — gl account belongs to a different tenant
        INVALID_DIMENSION_VALUE     — dimension_value_id not found
        WRONG_TENANT_DIMENSION      — dimension value belongs to a different tenant
        MISSING_REQUIRED_DIMENSION  — a 'required' GL dimension was not provided
        NA_DIMENSION_PROVIDED       — a 'na' GL dimension was provided on the line
        DATE_NOT_POSTABLE           — is_date_postable returned False
        INVALID_BANK_ACCOUNT        — bank_account_id not found
        WRONG_TENANT_BANK_ACCOUNT   — bank account belongs to a different tenant
        INACTIVE_BANK_ACCOUNT       — bank account exists but is_active=False
    """

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message

    def __repr__(self) -> str:
        return f"PostingError(code={self.code!r}, message={self.message!r})"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _to2dp(v: Decimal) -> Decimal:
    """Round a Decimal to exactly 2 decimal places (banker's rounding)."""
    return v.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


async def _generate_reference_number(tenant_id: UUID, entry_date: date, db: AsyncSession) -> str:
    """Generate a unique JE-{YYYY}-{000001} reference number for this tenant.

    Uses pg_advisory_xact_lock to serialize concurrent generation for the same tenant,
    preventing duplicate reference numbers under concurrent final-approvals.
    The (tenant_id, reference_number) UNIQUE constraint remains as a last-resort guard,
    but the advisory lock prevents collisions before they reach the DB layer.
    """
    from sqlalchemy import text
    # Transaction-scoped lock per tenant; released on commit/rollback.
    await db.execute(
        text("SELECT pg_advisory_xact_lock(abs(hashtext(:key)))"),
        {"key": f"je-ref:{tenant_id}"},
    )
    count_result = await db.execute(
        select(func.count()).select_from(JournalEntry).where(
            JournalEntry.tenant_id == tenant_id
        )
    )
    seq = (count_result.scalar_one() or 0) + 1
    return f"JE-{entry_date.year}-{seq:06d}"


# ── Central posting function ──────────────────────────────────────────────────

async def post_journal(
    db: AsyncSession,
    tenant_id: UUID,
    *,
    entry_date: date,
    description: str,
    source: str,
    source_reference: Optional[str] = None,
    lines: list[JournalLineInput],
    created_by: Optional[UUID] = None,
    module: str = "manual",
    status: str = "POSTED",
) -> JournalEntry:
    """
    Validate and persist a balanced journal entry.

    Parameters:
        db              — async DB session (caller owns the transaction / commit).
        tenant_id       — the tenant this journal belongs to.
        entry_date      — accounting date of the entry.
        description     — free-text narration for the journal header.
        source          — which module is posting (e.g. "expense", "manual", "ap").
        source_reference — optional link back to the source document (e.g. report number).
        lines           — list of JournalLineInput; must balance.
        created_by      — optional User.id for audit trail.
        module          — passed to is_date_postable (defaults to "manual").
        status          — "DRAFT" or "POSTED". DRAFT skips the date-postable check.

    Returns:
        The flushed JournalEntry ORM object (not yet committed — caller's router commits).

    Raises:
        PostingError on any validation failure.
    """

    # ── 1. Minimum lines ─────────────────────────────────────────────────────
    if len(lines) < 2:
        raise PostingError(
            "INSUFFICIENT_LINES",
            f"A journal entry requires at least 2 lines; {len(lines)} supplied.",
        )

    # ── 2. Per-line amount invariants ─────────────────────────────────────────
    for i, line in enumerate(lines, start=1):
        d = _to2dp(line.debit)
        c = _to2dp(line.credit)

        if d < Decimal("0") or c < Decimal("0"):
            raise PostingError(
                "NEGATIVE_AMOUNT",
                f"Line {i}: debit and credit must be non-negative "
                f"(got debit={d}, credit={c}).",
            )
        if d == Decimal("0") and c == Decimal("0"):
            raise PostingError(
                "INVALID_LINE_AMOUNTS",
                f"Line {i}: both debit and credit are zero — at least one must be > 0.",
            )
        if d > Decimal("0") and c > Decimal("0"):
            raise PostingError(
                "INVALID_LINE_AMOUNTS",
                f"Line {i}: both debit ({d}) and credit ({c}) are > 0 — "
                "only one side may be non-zero per line.",
            )

    # ── 3. Balance check ─────────────────────────────────────────────────────
    total_debit  = sum(_to2dp(ln.debit)  for ln in lines)
    total_credit = sum(_to2dp(ln.credit) for ln in lines)
    if total_debit != total_credit:
        raise PostingError(
            "UNBALANCED",
            f"Journal does not balance: Σ debits={total_debit}, Σ credits={total_credit}.",
        )

    # ── 4. GL account validation ──────────────────────────────────────────────
    gl_ids = [line.gl_account_id for line in lines]
    gl_result = await db.execute(
        select(ChartOfAccount).where(ChartOfAccount.id.in_(gl_ids))
    )
    found_gls: dict[UUID, ChartOfAccount] = {
        gl.id: gl for gl in gl_result.scalars().all()
    }

    for i, line in enumerate(lines, start=1):
        gl = found_gls.get(line.gl_account_id)
        if gl is None:
            raise PostingError(
                "INVALID_GL_ACCOUNT",
                f"Line {i}: GL account {line.gl_account_id} does not exist.",
            )
        if gl.tenant_id != tenant_id:
            raise PostingError(
                "WRONG_TENANT_GL_ACCOUNT",
                f"Line {i}: GL account {line.gl_account_id} belongs to a different tenant.",
            )
        if not gl.is_active:
            raise PostingError(
                "INACTIVE_GL_ACCOUNT",
                f"Line {i}: GL account {gl.gl_number} ({gl.gl_name}) is inactive.",
            )

    # ── 5. Dimension validation (per line) ────────────────────────────────────
    for i, line in enumerate(lines, start=1):
        line_dims: dict[str, str] = line.dimensions or {}

        # 5a. All provided dimension values must exist and belong to this tenant.
        if line_dims:
            dim_value_ids = [UUID(vid) for vid in line_dims.values()]
            dv_result = await db.execute(
                select(DimensionValue).where(DimensionValue.id.in_(dim_value_ids))
            )
            found_dvs: dict[UUID, DimensionValue] = {
                dv.id: dv for dv in dv_result.scalars().all()
            }
            for dim_id_str, val_id_str in line_dims.items():
                val_id = UUID(val_id_str)
                dv = found_dvs.get(val_id)
                if dv is None:
                    raise PostingError(
                        "INVALID_DIMENSION_VALUE",
                        f"Line {i}: dimension value {val_id} does not exist.",
                    )
                if dv.tenant_id != tenant_id:
                    raise PostingError(
                        "WRONG_TENANT_DIMENSION",
                        f"Line {i}: dimension value {val_id} belongs to a different tenant.",
                    )

        # 5b. Check GLDimensionRequirements for this GL account.
        req_result = await db.execute(
            select(GLDimensionRequirement).where(
                GLDimensionRequirement.gl_id == line.gl_account_id,
                GLDimensionRequirement.tenant_id == tenant_id,
            )
        )
        requirements: list[GLDimensionRequirement] = req_result.scalars().all()

        for req in requirements:
            dim_id_str = str(req.dimension_id)
            has_dim = dim_id_str in line_dims

            if req.requirement == "required" and not has_dim:
                raise PostingError(
                    "MISSING_REQUIRED_DIMENSION",
                    f"Line {i}: GL account {found_gls[line.gl_account_id].gl_number} "
                    f"requires dimension {req.dimension_id} but it was not provided.",
                )
            if req.requirement == "na" and has_dim:
                raise PostingError(
                    "NA_DIMENSION_PROVIDED",
                    f"Line {i}: GL account {found_gls[line.gl_account_id].gl_number} "
                    f"marks dimension {req.dimension_id} as N/A but it was provided.",
                )
            # "optional" — either way is fine; no check needed.

    # ── 5b. Bank account validation (optional per line) ──────────────────────
    # bank_account_id is purely a tag for future reconciliation — it does NOT
    # change posting behaviour. Lines without it are completely unaffected.
    bank_acct_cache: dict[UUID, BankAccount] = {}
    for i, line in enumerate(lines, start=1):
        if not line.bank_account_id:
            continue
        if line.bank_account_id in bank_acct_cache:
            continue
        ba_res = await db.execute(
            select(BankAccount).where(BankAccount.id == line.bank_account_id)
        )
        ba = ba_res.scalar_one_or_none()
        if ba is None:
            raise PostingError(
                "INVALID_BANK_ACCOUNT",
                f"Line {i}: bank_account_id {line.bank_account_id} does not exist.",
            )
        if ba.tenant_id != tenant_id:
            raise PostingError(
                "WRONG_TENANT_BANK_ACCOUNT",
                f"Line {i}: bank_account_id {line.bank_account_id} belongs to a different tenant.",
            )
        if not ba.is_active:
            raise PostingError(
                "INACTIVE_BANK_ACCOUNT",
                f"Line {i}: bank account '{ba.account_name}' is inactive.",
            )
        bank_acct_cache[line.bank_account_id] = ba

    # ── 6. Date postability (POSTED only; DRAFT skips this check) ────────────
    if status == "POSTED":
        postable, reason = await is_date_postable(
            tenant_id,
            entry_date,
            db,
            module=module,
        )
        if not postable:
            raise PostingError(
                "DATE_NOT_POSTABLE",
                f"Entry date {entry_date} is not open for posting: {reason}",
            )

    # ── 7. Persist entry + lines ──────────────────────────────────────────────
    now = datetime.now(timezone.utc)

    reference_number = await _generate_reference_number(tenant_id, entry_date, db)

    entry = JournalEntry(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        entry_date=entry_date,
        description=description,
        source=source,
        source_reference=source_reference,
        reference_number=reference_number,
        status=status,
        created_by=created_by,
        created_at=now,
        posted_at=now if status == "POSTED" else None,
    )
    db.add(entry)
    await db.flush()  # get entry.id before inserting lines

    for line_no, line in enumerate(lines, start=1):
        jl = JournalLine(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            journal_entry_id=entry.id,
            gl_account_id=line.gl_account_id,
            debit=_to2dp(line.debit),
            credit=_to2dp(line.credit),
            description=line.description,
            line_number=line_no,
            dimensions=line.dimensions or None,
            bank_account_id=line.bank_account_id or None,
        )
        db.add(jl)

    await db.flush()  # flush lines; caller's get_db() commits
    return entry
