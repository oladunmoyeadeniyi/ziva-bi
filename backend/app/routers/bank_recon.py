"""
ZivaBI — Bank Reconciliation router (M11c).

Prefix:  /api/bank-recon
Tags:    bank-reconciliation

Endpoints:

    Statements
    ----------
    GET    /api/bank-recon/statements                      List statements (filter by bank_account_id)
    POST   /api/bank-recon/statements                      Create a statement header
    GET    /api/bank-recon/statements/{id}                 Detail with all lines + matches
    DELETE /api/bank-recon/statements/{id}                 Delete DRAFT only
    POST   /api/bank-recon/statements/{id}/upload          Parse CSV/XLSX and bulk-insert lines
    POST   /api/bank-recon/statements/{id}/close           Mark RECONCILED (guard: no UNMATCHED lines)
    GET    /api/bank-recon/statements/{id}/report          Reconciliation report

    Matching
    ---------
    GET    /api/bank-recon/statements/{id}/candidates/gl   Unmatched GL lines (Full ERP)
    GET    /api/bank-recon/statements/{id}/candidates/batches  Unmatched posting batches (Connected)
    POST   /api/bank-recon/matches                         Create a match (manual)
    DELETE /api/bank-recon/matches/{match_id}              Remove a match
    POST   /api/bank-recon/statements/{id}/auto-match      Auto-match all UNMATCHED lines
    PUT    /api/bank-recon/lines/{line_id}/exclude         Mark a line EXCLUDED
    PUT    /api/bank-recon/lines/{line_id}/unexclude       Mark EXCLUDED → UNMATCHED

Three-mode behaviour:
    Lite        — CSV upload + manual matches only.  Auto-match returns 0 matches.
    Connected   — Auto-match against posting_batches. Candidates/batches endpoint active.
    Full ERP    — Auto-match against journal_lines. Candidates/gl endpoint active. Report
                  includes GL book balance + outstanding items + is_balanced flag.

Access control:
    All endpoints require a tenant context.
    Read endpoints: any authenticated user.
    Write endpoints (create/upload/match/close/delete): power_admin or higher.
"""

from __future__ import annotations

import csv
import io
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.middleware.auth import CurrentUser, block_if_readonly_impersonation, require_auth, require_module
from app.models.bank_account import BankAccount
from app.models.bank_recon import BankReconMatch, BankStatement, BankStatementLine
from app.models.gl import JournalEntry, JournalLine, PostingBatch
from app.models.master_data import ChartOfAccount
from app.models.setup import TenantOrgConfig
from app.schemas.bank_recon import (
    AutoMatchResult,
    BankReconMatchCreate,
    BankReconMatchResponse,
    BankStatementCreate,
    BankStatementDetail,
    BankStatementLineResponse,
    BankStatementResponse,
    ReconReport,
    UnmatchedJournalLineResponse,
    UnmatchedPostingBatchResponse,
    UploadResult,
)
from app.services.bank_recon_match import (
    auto_match_statement,
    build_recon_report,
    recompute_line_status,
)
from app.services.bank_recon_parser import parse_statement_file

router = APIRouter(
    prefix="/api/bank-recon",
    tags=["bank-reconciliation"],
    dependencies=[Depends(require_module("bank_recon"))],
)

UserTenant = CurrentUser  # alias for type annotations


# ── Guards ─────────────────────────────────────────────────────────────────────

def _require_tenant(user: CurrentUser) -> uuid.UUID:
    tid = getattr(user, "tenant_id", None)
    if not tid:
        raise HTTPException(status_code=400, detail="Tenant context required.")
    return tid


def _require_write(user: CurrentUser) -> None:
    if not user.is_super_admin and user.role_tier not in ("power_admin", "functional_admin"):
        raise HTTPException(status_code=403, detail="Insufficient permissions.")
    block_if_readonly_impersonation(user)


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _get_posting_mode(tenant_id: uuid.UUID, db: AsyncSession) -> str:
    """Return the tenant's posting_mode (default 'full_erp')."""
    res = await db.execute(
        select(TenantOrgConfig.posting_mode).where(TenantOrgConfig.tenant_id == tenant_id)
    )
    return res.scalar_one_or_none() or "full_erp"


async def _get_statement_or_404(
    stmt_id: uuid.UUID, tenant_id: uuid.UUID, db: AsyncSession, load_lines: bool = False
) -> BankStatement:
    """Fetch a BankStatement by id + tenant_id, raise 404 if not found."""
    q = select(BankStatement).where(
        BankStatement.id == stmt_id,
        BankStatement.tenant_id == tenant_id,
    )
    if load_lines:
        q = q.options(
            selectinload(BankStatement.lines).selectinload(BankStatementLine.matches)
        )
    res = await db.execute(q)
    stmt = res.scalar_one_or_none()
    if not stmt:
        raise HTTPException(status_code=404, detail="Statement not found.")
    return stmt


async def _next_statement_ref(tenant_id: uuid.UUID, db: AsyncSession) -> str:
    """Generate the next STMT-{YYYY}-{NNN} reference for this tenant."""
    year = datetime.utcnow().year
    cnt_res = await db.execute(
        select(func.count(BankStatement.id)).where(
            BankStatement.tenant_id == tenant_id
        )
    )
    count = (cnt_res.scalar_one() or 0) + 1
    return f"STMT-{year}-{count:03d}"


def _stmt_to_response(stmt: BankStatement) -> BankStatementResponse:
    """Convert ORM object to BankStatementResponse with line count annotations."""
    total = len(stmt.lines) if stmt.lines is not None else 0
    matched = sum(1 for l in (stmt.lines or []) if l.match_status == "MATCHED")
    unmatched = sum(1 for l in (stmt.lines or []) if l.match_status in ("UNMATCHED", "PARTIAL"))
    r = BankStatementResponse.model_validate(stmt)
    r.total_lines = total
    r.matched_lines = matched
    r.unmatched_lines = unmatched
    return r


# ── Statement endpoints ────────────────────────────────────────────────────────

@router.get("/statements", response_model=list[BankStatementResponse])
async def list_statements(
    bank_account_id: Optional[uuid.UUID] = Query(None),
    status: Optional[str] = Query(None),
    current_user: Annotated[UserTenant, Depends(require_auth)] = ...,
    db: AsyncSession = Depends(get_db),
) -> list[BankStatementResponse]:
    """
    List bank statements for the current tenant.

    Filter by bank_account_id and/or status (DRAFT | IN_PROGRESS | RECONCILED).
    Returns statements with line count annotations (total / matched / unmatched).
    """
    tenant_id = _require_tenant(current_user)
    q = (
        select(BankStatement)
        .where(BankStatement.tenant_id == tenant_id)
        .options(selectinload(BankStatement.lines))
        .order_by(BankStatement.statement_date.desc())
    )
    if bank_account_id:
        q = q.where(BankStatement.bank_account_id == bank_account_id)
    if status:
        q = q.where(BankStatement.status == status.upper())
    rows = (await db.execute(q)).scalars().all()
    return [_stmt_to_response(s) for s in rows]


@router.post("/statements", response_model=BankStatementResponse, status_code=201)
async def create_statement(
    body: BankStatementCreate,
    current_user: Annotated[UserTenant, Depends(require_auth)] = ...,
    db: AsyncSession = Depends(get_db),
) -> BankStatementResponse:
    """
    Create a bank statement header (no lines yet).

    The statement_date must be the closing date of the period.
    Upload lines separately via POST /api/bank-recon/statements/{id}/upload.
    """
    tenant_id = _require_tenant(current_user)
    _require_write(current_user)

    # Validate bank account belongs to tenant
    acct_res = await db.execute(
        select(BankAccount).where(
            BankAccount.id == body.bank_account_id,
            BankAccount.tenant_id == tenant_id,
        )
    )
    acct = acct_res.scalar_one_or_none()
    if not acct:
        raise HTTPException(status_code=422, detail="Bank account not found in this tenant.")
    if not acct.is_active:
        raise HTTPException(status_code=422, detail="Bank account is inactive.")

    ref = await _next_statement_ref(tenant_id, db)
    stmt = BankStatement(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        bank_account_id=body.bank_account_id,
        statement_ref=ref,
        statement_date=body.statement_date,
        period_start=body.period_start,
        opening_balance=body.opening_balance,
        closing_balance=body.closing_balance,
        currency=body.currency.upper(),
        status="DRAFT",
        notes=body.notes,
        uploaded_by=current_user.user_id,
    )
    db.add(stmt)
    await db.flush()
    stmt.lines = []  # empty list for annotation helper
    return _stmt_to_response(stmt)


@router.get("/statements/{stmt_id}", response_model=BankStatementDetail)
async def get_statement(
    stmt_id: uuid.UUID,
    current_user: Annotated[UserTenant, Depends(require_auth)] = ...,
    db: AsyncSession = Depends(get_db),
) -> BankStatementDetail:
    """Return statement detail with all lines and their match records."""
    tenant_id = _require_tenant(current_user)
    stmt = await _get_statement_or_404(stmt_id, tenant_id, db, load_lines=True)
    return BankStatementDetail.model_validate(stmt)


@router.delete("/statements/{stmt_id}", status_code=204)
async def delete_statement(
    stmt_id: uuid.UUID,
    current_user: Annotated[UserTenant, Depends(require_auth)] = ...,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a statement. Only DRAFT statements may be deleted."""
    tenant_id = _require_tenant(current_user)
    _require_write(current_user)
    stmt = await _get_statement_or_404(stmt_id, tenant_id, db)
    if stmt.status != "DRAFT":
        raise HTTPException(
            status_code=422,
            detail=f"Only DRAFT statements can be deleted. This statement is {stmt.status}.",
        )
    await db.delete(stmt)


@router.post("/statements/{stmt_id}/upload", response_model=UploadResult)
async def upload_statement_lines(
    stmt_id: uuid.UUID,
    file: UploadFile = File(...),
    current_user: Annotated[UserTenant, Depends(require_auth)] = ...,
    db: AsyncSession = Depends(get_db),
) -> UploadResult:
    """
    Parse a CSV or XLSX bank statement file and bulk-insert lines.

    Replaces all existing lines on the statement (re-upload clears previous lines).
    Only DRAFT or IN_PROGRESS statements can be re-uploaded.
    """
    tenant_id = _require_tenant(current_user)
    _require_write(current_user)
    stmt = await _get_statement_or_404(stmt_id, tenant_id, db, load_lines=True)

    if stmt.status == "RECONCILED":
        raise HTTPException(
            status_code=422,
            detail="Cannot re-upload lines on a RECONCILED statement. Reopen it first.",
        )

    content = await file.read()
    filename = file.filename or "upload.csv"

    try:
        parse_result = parse_statement_file(content, filename)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    # Clear existing lines (cascade deletes matches too)
    for existing_line in stmt.lines:
        await db.delete(existing_line)
    await db.flush()

    # Bulk-insert parsed lines
    for parsed in parse_result.lines:
        db.add(BankStatementLine(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            statement_id=stmt.id,
            line_number=parsed.line_number,
            transaction_date=parsed.transaction_date,
            value_date=parsed.value_date,
            description=parsed.description,
            reference=parsed.reference,
            debit=parsed.debit,
            credit=parsed.credit,
            running_balance=parsed.running_balance,
            match_status="UNMATCHED",
        ))

    stmt.status = "IN_PROGRESS"
    await db.flush()

    return UploadResult(
        lines_parsed=len(parse_result.lines) + len(parse_result.warnings),
        lines_created=len(parse_result.lines),
        warnings=parse_result.warnings,
    )


@router.post("/statements/{stmt_id}/close", response_model=BankStatementResponse)
async def close_statement(
    stmt_id: uuid.UUID,
    current_user: Annotated[UserTenant, Depends(require_auth)] = ...,
    db: AsyncSession = Depends(get_db),
) -> BankStatementResponse:
    """
    Mark a statement as RECONCILED.

    Guard: all lines must be MATCHED or EXCLUDED (no UNMATCHED or PARTIAL).
    """
    tenant_id = _require_tenant(current_user)
    _require_write(current_user)
    stmt = await _get_statement_or_404(stmt_id, tenant_id, db, load_lines=True)

    if stmt.status == "RECONCILED":
        raise HTTPException(status_code=422, detail="Statement is already RECONCILED.")

    unresolved = [l for l in stmt.lines if l.match_status in ("UNMATCHED", "PARTIAL")]
    if unresolved:
        raise HTTPException(
            status_code=422,
            detail=f"{len(unresolved)} line(s) are still UNMATCHED or PARTIAL. "
                   "Match or exclude all lines before closing.",
        )

    stmt.status = "RECONCILED"
    await db.flush()
    return _stmt_to_response(stmt)


@router.get("/statements/{stmt_id}/report", response_model=ReconReport)
async def get_recon_report(
    stmt_id: uuid.UUID,
    current_user: Annotated[UserTenant, Depends(require_auth)] = ...,
    db: AsyncSession = Depends(get_db),
) -> ReconReport:
    """
    Return the reconciliation report for a statement.

    Full ERP mode: includes GL book balance, outstanding items, is_balanced flag.
    Lite/Connected: returns summary line counts only.
    """
    tenant_id = _require_tenant(current_user)
    stmt = await _get_statement_or_404(stmt_id, tenant_id, db, load_lines=True)
    posting_mode = await _get_posting_mode(tenant_id, db)
    return await build_recon_report(stmt, posting_mode, db)


# ── Match candidate endpoints ─────────────────────────────────────────────────

@router.get(
    "/statements/{stmt_id}/candidates/gl",
    response_model=list[UnmatchedJournalLineResponse],
)
async def list_unmatched_gl_lines(
    stmt_id: uuid.UUID,
    current_user: Annotated[UserTenant, Depends(require_auth)] = ...,
    db: AsyncSession = Depends(get_db),
) -> list[UnmatchedJournalLineResponse]:
    """
    List GL journal lines tagged to the statement's bank account that are not yet
    matched to any statement line. Full ERP mode only.
    """
    tenant_id = _require_tenant(current_user)
    stmt = await _get_statement_or_404(stmt_id, tenant_id, db)

    # Already-matched journal_line IDs (across all statements for this tenant)
    matched_ids_res = await db.execute(
        select(BankReconMatch.matched_journal_line_id).where(
            BankReconMatch.tenant_id == tenant_id,
            BankReconMatch.matched_journal_line_id.is_not(None),
        )
    )
    matched_ids = {r for (r,) in matched_ids_res.all()}

    q = (
        select(JournalLine, JournalEntry, ChartOfAccount)
        .join(JournalEntry, JournalLine.journal_entry_id == JournalEntry.id)
        .outerjoin(ChartOfAccount, JournalLine.gl_account_id == ChartOfAccount.id)
        .where(
            JournalLine.tenant_id == tenant_id,
            JournalLine.bank_account_id == stmt.bank_account_id,
            JournalEntry.status == "POSTED",
        )
        .order_by(JournalEntry.entry_date.desc())
    )
    rows = (await db.execute(q)).all()

    result = []
    for jl, je, coa in rows:
        if jl.id in matched_ids:
            continue
        gl_amount = jl.debit if jl.debit > 0 else jl.credit
        # bank_amount is bank-perspective: GL debit = bank credit (inflow); GL credit = bank debit (outflow)
        bank_amount = jl.credit if jl.debit > 0 else jl.debit
        result.append(UnmatchedJournalLineResponse(
            id=jl.id,
            journal_entry_id=jl.journal_entry_id,
            entry_date=je.entry_date,
            reference_number=je.reference_number,
            description=je.description or "",
            gl_account_code=coa.account_code if coa else None,
            gl_account_name=coa.account_name if coa else None,
            debit=jl.debit,
            credit=jl.credit,
            bank_amount=gl_amount,
        ))
    return result


@router.get(
    "/statements/{stmt_id}/candidates/batches",
    response_model=list[UnmatchedPostingBatchResponse],
)
async def list_unmatched_batches(
    stmt_id: uuid.UUID,
    current_user: Annotated[UserTenant, Depends(require_auth)] = ...,
    db: AsyncSession = Depends(get_db),
) -> list[UnmatchedPostingBatchResponse]:
    """
    List posting batches not yet matched to any statement line. Connected mode only.
    """
    tenant_id = _require_tenant(current_user)
    await _get_statement_or_404(stmt_id, tenant_id, db)  # guard

    matched_batch_ids_res = await db.execute(
        select(BankReconMatch.matched_posting_batch_id).where(
            BankReconMatch.tenant_id == tenant_id,
            BankReconMatch.matched_posting_batch_id.is_not(None),
        )
    )
    matched_batch_ids = {r for (r,) in matched_batch_ids_res.all()}

    batches = (
        await db.execute(
            select(PostingBatch)
            .where(
                PostingBatch.tenant_id == tenant_id,
                PostingBatch.status.in_(["pending", "exported"]),
            )
            .order_by(PostingBatch.created_at.desc())
        )
    ).scalars().all()

    result = []
    for b in batches:
        if b.id in matched_batch_ids:
            continue
        # Sum debits only — batch is balanced (Σdebits == Σcredits), so summing both
        # sides would double-count. Structure: [{lines: [{debit, credit, ...}]}]
        total = Decimal("0")
        if b.transactions:
            for txn in b.transactions:
                for line in txn.get("lines", []):
                    try:
                        total += Decimal(str(line.get("debit", 0)))
                    except Exception:
                        pass
        result.append(UnmatchedPostingBatchResponse(
            id=b.id,
            batch_ref=b.batch_ref,
            module=b.module,
            status=b.status,
            created_at=b.created_at,
            total_amount=total,
        ))
    return result


# ── Match CRUD ────────────────────────────────────────────────────────────────

@router.post("/matches", response_model=BankReconMatchResponse, status_code=201)
async def create_match(
    body: BankReconMatchCreate,
    current_user: Annotated[UserTenant, Depends(require_auth)] = ...,
    db: AsyncSession = Depends(get_db),
) -> BankReconMatchResponse:
    """
    Manually create a match between a statement line and a GL line, posting batch,
    or a free-text manual note.

    After creating the match, the statement line's match_status is recomputed.
    """
    tenant_id = _require_tenant(current_user)
    _require_write(current_user)

    # Validate statement line belongs to tenant
    line_res = await db.execute(
        select(BankStatementLine)
        .join(BankStatement, BankStatementLine.statement_id == BankStatement.id)
        .where(
            BankStatementLine.id == body.statement_line_id,
            BankStatement.tenant_id == tenant_id,
        )
        .options(selectinload(BankStatementLine.matches))
    )
    line = line_res.scalar_one_or_none()
    if not line:
        raise HTTPException(status_code=404, detail="Statement line not found.")
    if line.match_status == "EXCLUDED":
        raise HTTPException(
            status_code=422,
            detail="Line is EXCLUDED. Unexclude it before adding a match.",
        )

    # Validate FK targets belong to tenant
    if body.match_type == "journal_line" and body.matched_journal_line_id:
        jl_res = await db.execute(
            select(JournalLine).where(
                JournalLine.id == body.matched_journal_line_id,
                JournalLine.tenant_id == tenant_id,
            )
        )
        if not jl_res.scalar_one_or_none():
            raise HTTPException(status_code=422, detail="Journal line not found.")

    if body.match_type == "posting_batch" and body.matched_posting_batch_id:
        pb_res = await db.execute(
            select(PostingBatch).where(
                PostingBatch.id == body.matched_posting_batch_id,
                PostingBatch.tenant_id == tenant_id,
            )
        )
        if not pb_res.scalar_one_or_none():
            raise HTTPException(status_code=422, detail="Posting batch not found.")

    match = BankReconMatch(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        statement_line_id=body.statement_line_id,
        match_type=body.match_type,
        matched_journal_line_id=body.matched_journal_line_id,
        matched_posting_batch_id=body.matched_posting_batch_id,
        matched_amount=body.matched_amount,
        notes=body.notes,
        matched_by=current_user.user_id,
    )
    db.add(match)
    await db.flush()

    await recompute_line_status(line, db)

    return BankReconMatchResponse.model_validate(match)


@router.delete("/matches/{match_id}", status_code=204)
async def delete_match(
    match_id: uuid.UUID,
    current_user: Annotated[UserTenant, Depends(require_auth)] = ...,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Remove a match. The statement line's match_status is recomputed afterward."""
    tenant_id = _require_tenant(current_user)
    _require_write(current_user)

    match_res = await db.execute(
        select(BankReconMatch).where(
            BankReconMatch.id == match_id,
            BankReconMatch.tenant_id == tenant_id,
        )
    )
    match = match_res.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found.")

    line_id = match.statement_line_id
    await db.delete(match)
    await db.flush()

    # Reload line and recompute status
    line_res = await db.execute(
        select(BankStatementLine)
        .where(BankStatementLine.id == line_id)
        .options(selectinload(BankStatementLine.matches))
    )
    line = line_res.scalar_one_or_none()
    if line:
        await recompute_line_status(line, db)


@router.post("/statements/{stmt_id}/auto-match", response_model=AutoMatchResult)
async def auto_match(
    stmt_id: uuid.UUID,
    date_tolerance_days: int = Query(5, ge=0, le=30),
    current_user: Annotated[UserTenant, Depends(require_auth)] = ...,
    db: AsyncSession = Depends(get_db),
) -> AutoMatchResult:
    """
    Auto-match all UNMATCHED lines in the statement.

    Full ERP: matches against journal_lines tagged to the statement's bank_account.
    Connected: matches against posting_batches by approximate amount + date.
    Lite: returns zero matches (manual matching only).

    date_tolerance_days controls how wide the date search window is (default 5).
    """
    tenant_id = _require_tenant(current_user)
    _require_write(current_user)
    stmt = await _get_statement_or_404(stmt_id, tenant_id, db, load_lines=True)

    if stmt.status == "RECONCILED":
        raise HTTPException(status_code=422, detail="Cannot auto-match a RECONCILED statement.")

    posting_mode = await _get_posting_mode(tenant_id, db)

    return await auto_match_statement(
        statement=stmt,
        posting_mode=posting_mode,
        db=db,
        date_tolerance_days=date_tolerance_days,
        matched_by=current_user.user_id,
    )


# ── Line exclusion ────────────────────────────────────────────────────────────

@router.put("/lines/{line_id}/exclude", response_model=BankStatementLineResponse)
async def exclude_line(
    line_id: uuid.UUID,
    current_user: Annotated[UserTenant, Depends(require_auth)] = ...,
    db: AsyncSession = Depends(get_db),
) -> BankStatementLineResponse:
    """
    Mark a statement line as EXCLUDED.

    Use for lines that are already accounted for elsewhere (e.g. bank charge already
    posted as a GL journal entry outside this reconciliation workflow, or a duplicate
    bank memo row that should be ignored).
    """
    tenant_id = _require_tenant(current_user)
    _require_write(current_user)
    line = await _get_line_or_404(line_id, tenant_id, db)
    line.match_status = "EXCLUDED"
    await db.flush()
    return BankStatementLineResponse.model_validate(line)


@router.put("/lines/{line_id}/unexclude", response_model=BankStatementLineResponse)
async def unexclude_line(
    line_id: uuid.UUID,
    current_user: Annotated[UserTenant, Depends(require_auth)] = ...,
    db: AsyncSession = Depends(get_db),
) -> BankStatementLineResponse:
    """
    Remove the EXCLUDED status from a line and recompute its actual match_status.
    """
    tenant_id = _require_tenant(current_user)
    _require_write(current_user)
    line = await _get_line_or_404(line_id, tenant_id, db)
    if line.match_status != "EXCLUDED":
        raise HTTPException(status_code=422, detail="Line is not EXCLUDED.")
    # Temporarily set to UNMATCHED so recompute_line_status can run
    line.match_status = "UNMATCHED"
    await recompute_line_status(line, db)
    return BankStatementLineResponse.model_validate(line)


async def _get_line_or_404(
    line_id: uuid.UUID, tenant_id: uuid.UUID, db: AsyncSession
) -> BankStatementLine:
    """Fetch a BankStatementLine scoped to tenant, raise 404 if not found."""
    res = await db.execute(
        select(BankStatementLine)
        .join(BankStatement, BankStatementLine.statement_id == BankStatement.id)
        .where(
            BankStatementLine.id == line_id,
            BankStatement.tenant_id == tenant_id,
        )
        .options(selectinload(BankStatementLine.matches))
    )
    line = res.scalar_one_or_none()
    if not line:
        raise HTTPException(status_code=404, detail="Statement line not found.")
    return line
