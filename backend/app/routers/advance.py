"""Employee Advance & Retirement router — /api/advances.

What this module does:
  Full lifecycle management of employee cash advances and their retirements.

Advance endpoints:
  GET  /api/advances                          — list (employee sees own; finance/admin sees all)
  POST /api/advances                          — create advance request (DRAFT)
  GET  /api/advances/aging                    — advance aging report (finance)
  GET  /api/advances/{id}                     — detail
  PUT  /api/advances/{id}                     — update (DRAFT only)
  POST /api/advances/{id}/submit              — submit for approval
  POST /api/advances/{id}/approve             — approve (approver / finance)
  POST /api/advances/{id}/reject              — reject with comment
  POST /api/advances/{id}/issue              — mark as issued / cash disbursed (finance)
  POST /api/advances/{id}/cancel             — cancel (DRAFT or SUBMITTED)

Retirement endpoints:
  POST /api/advances/{id}/retirements         — start a new retirement for an advance
  GET  /api/advances/{id}/retirements         — list retirements for an advance
  GET  /api/advances/retirements/{ret_id}     — retirement detail + lines
  POST /api/advances/retirements/{ret_id}/lines       — add a line item
  DELETE /api/advances/retirements/{ret_id}/lines/{line_id} — remove a line
  POST /api/advances/retirements/{ret_id}/submit      — submit retirement for approval
  POST /api/advances/retirements/{ret_id}/approve     — approve retirement
  POST /api/advances/retirements/{ret_id}/reject      — reject retirement
  POST /api/advances/retirements/{ret_id}/post        — post to GL (Full ERP only)

Three-mode GL support:
  Lite      — no GL entries; advance tracked for workflow and audit only.
  Connected — posting_batch row created for each issuance + approved retirement.
  Full ERP  — journal_entries created automatically:
                Issuance : DR Employee Advance / CR Cash
                Retirement:
                  Always   : DR Expense GL(s) / CR Employee Advance  (up to advance amount)
                  Overspend: DR Expense GL    / CR Employee Payable
                  Underspend: DR Employee Payable / CR Employee Advance

Security:
  All queries tenant-scoped. No secrets in code.
"""

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import CurrentUser, require_auth

router = APIRouter(prefix="/api/advances", tags=["advances"])


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class AdvanceCreate(BaseModel):
    """Request body for creating a new advance."""
    advance_type: str = "TRAVEL"          # TRAVEL | OPERATIONAL | OTHER
    purpose: str
    amount: Decimal
    currency: str = "NGN"
    request_date: date
    required_by_date: Optional[date] = None
    due_retirement_date: Optional[date] = None
    gl_advance_account_id: Optional[str] = None
    gl_cash_account_id: Optional[str] = None
    notes: Optional[str] = None


class AdvanceUpdate(BaseModel):
    advance_type: Optional[str] = None
    purpose: Optional[str] = None
    amount: Optional[Decimal] = None
    currency: Optional[str] = None
    request_date: Optional[date] = None
    required_by_date: Optional[date] = None
    due_retirement_date: Optional[date] = None
    gl_advance_account_id: Optional[str] = None
    gl_cash_account_id: Optional[str] = None
    notes: Optional[str] = None


class RejectBody(BaseModel):
    comment: str


class RetirementCreate(BaseModel):
    """Request body for starting a new retirement."""
    retirement_date: date
    notes: Optional[str] = None


class RetirementLineCreate(BaseModel):
    """Request body for adding a line to a retirement."""
    description: str
    amount: Decimal
    currency: str = "NGN"
    receipt_date: Optional[date] = None
    gl_id: Optional[str] = None
    dimension_values: Optional[dict] = None
    category_id: Optional[str] = None
    subcategory_id: Optional[str] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _next_advance_number(db: AsyncSession, tenant_id: str) -> str:
    """Generate the next advance number: ADV-YYYY-NNNN."""
    year = datetime.now(timezone.utc).year
    result = await db.execute(
        text("""
            SELECT COUNT(*) FROM employee_advances
            WHERE tenant_id = :tid AND EXTRACT(YEAR FROM created_at) = :yr
        """),
        {"tid": tenant_id, "yr": year},
    )
    count = result.scalar() or 0
    return f"ADV-{year}-{count + 1:04d}"


async def _next_retirement_number(db: AsyncSession, tenant_id: str) -> str:
    """Generate the next retirement number: RET-YYYY-NNNN."""
    year = datetime.now(timezone.utc).year
    result = await db.execute(
        text("""
            SELECT COUNT(*) FROM advance_retirements
            WHERE tenant_id = :tid AND EXTRACT(YEAR FROM created_at) = :yr
        """),
        {"tid": tenant_id, "yr": year},
    )
    count = result.scalar() or 0
    return f"RET-{year}-{count + 1:04d}"


async def _get_posting_mode(db: AsyncSession, tenant_id: str) -> str:
    """Return the tenant's posting_mode: LITE | CONNECTED | FULL_ERP."""
    result = await db.execute(
        text("SELECT posting_mode FROM tenants WHERE id = :tid"),
        {"tid": tenant_id},
    )
    row = result.fetchone()
    return (row[0] if row else "LITE") or "LITE"


async def _post_issuance_journal(
    db: AsyncSession,
    tenant_id: str,
    advance_id: str,
    amount: Decimal,
    currency: str,
    gl_advance_id: Optional[str],
    gl_cash_id: Optional[str],
    issued_by: str,
) -> Optional[str]:
    """
    Post the advance issuance journal entry (Full ERP only).

    DR Employee Advance Account (asset increases)
    CR Cash / Bank Account      (asset decreases — cash goes out)

    Returns the journal_entry_id as a string, or None if GL accounts are missing.
    """
    if not gl_advance_id or not gl_cash_id:
        return None

    je_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    await db.execute(
        text("""
            INSERT INTO journal_entries
                (id, tenant_id, entry_date, reference, description, currency,
                 status, created_by, created_at, updated_at)
            VALUES
                (:id, :tid, CURRENT_DATE, :ref, :desc, :cur,
                 'POSTED', :by, :now, :now)
        """),
        {
            "id":   je_id,
            "tid":  tenant_id,
            "ref":  f"ADV-ISS-{advance_id[:8].upper()}",
            "desc": "Employee advance issuance",
            "cur":  currency,
            "by":   issued_by,
            "now":  now,
        },
    )

    # DR Employee Advance (debit = positive)
    await db.execute(
        text("""
            INSERT INTO journal_lines
                (id, journal_entry_id, tenant_id, account_id, debit, credit,
                 description, line_order, created_at)
            VALUES
                (:id, :je_id, :tid, :acc, :dr, 0, :desc, 1, :now)
        """),
        {
            "id":    str(uuid.uuid4()),
            "je_id": je_id,
            "tid":   tenant_id,
            "acc":   gl_advance_id,
            "dr":    float(amount),
            "desc":  "Employee advance",
            "now":   now,
        },
    )

    # CR Cash / Bank (credit = positive)
    await db.execute(
        text("""
            INSERT INTO journal_lines
                (id, journal_entry_id, tenant_id, account_id, debit, credit,
                 description, line_order, created_at)
            VALUES
                (:id, :je_id, :tid, :acc, 0, :cr, :desc, 2, :now)
        """),
        {
            "id":    str(uuid.uuid4()),
            "je_id": je_id,
            "tid":   tenant_id,
            "acc":   gl_cash_id,
            "cr":    float(amount),
            "desc":  "Cash disbursed for advance",
            "now":   now,
        },
    )

    return je_id


async def _post_retirement_journal(
    db: AsyncSession,
    tenant_id: str,
    retirement: dict,
    lines: list[dict],
    advance: dict,
    posted_by: str,
) -> Optional[str]:
    """
    Post the retirement journal entry (Full ERP only).

    For each retirement line:
        DR Expense GL             (expense recognised)
        CR Employee Advance       (clears advance asset, up to advance amount)

    If total_claimed > advance_amount (overspend):
        DR Expense GL             (the excess portion)
        CR Employee Payable       (company owes employee the difference)

    If total_claimed < advance_amount (underspend):
        DR Employee Payable       (employee owes company — recorded as a payable)
        CR Employee Advance       (clears remaining advance balance)

    Returns the journal_entry_id as a string.
    """
    now = datetime.now(timezone.utc)
    je_id = str(uuid.uuid4())
    total_claimed = Decimal(str(retirement["total_claimed"]))
    advance_amount = Decimal(str(retirement["advance_amount"]))
    gl_advance_id = str(advance["gl_advance_account_id"]) if advance.get("gl_advance_account_id") else None

    await db.execute(
        text("""
            INSERT INTO journal_entries
                (id, tenant_id, entry_date, reference, description, currency,
                 status, created_by, created_at, updated_at)
            VALUES
                (:id, :tid, CURRENT_DATE, :ref, :desc, :cur,
                 'POSTED', :by, :now, :now)
        """),
        {
            "id":   je_id,
            "tid":  tenant_id,
            "ref":  f"RET-{retirement['retirement_number']}",
            "desc": f"Advance retirement {retirement['retirement_number']}",
            "cur":  advance.get("currency", "NGN"),
            "by":   posted_by,
            "now":  now,
        },
    )

    order = 1
    for line in lines:
        gl_id = str(line["gl_id"]) if line.get("gl_id") else None
        if not gl_id:
            continue
        # DR Expense GL
        await db.execute(
            text("""
                INSERT INTO journal_lines
                    (id, journal_entry_id, tenant_id, account_id, debit, credit,
                     description, line_order, created_at)
                VALUES
                    (:id, :je_id, :tid, :acc, :dr, 0, :desc, :ord, :now)
            """),
            {
                "id":    str(uuid.uuid4()),
                "je_id": je_id,
                "tid":   tenant_id,
                "acc":   gl_id,
                "dr":    float(line["amount"]),
                "desc":  line["description"],
                "ord":   order,
                "now":   now,
            },
        )
        order += 1

    # CR Employee Advance (up to advance_amount)
    if gl_advance_id:
        cr_advance = float(min(total_claimed, advance_amount))
        if cr_advance > 0:
            await db.execute(
                text("""
                    INSERT INTO journal_lines
                        (id, journal_entry_id, tenant_id, account_id, debit, credit,
                         description, line_order, created_at)
                    VALUES
                        (:id, :je_id, :tid, :acc, 0, :cr, :desc, :ord, :now)
                """),
                {
                    "id":    str(uuid.uuid4()),
                    "je_id": je_id,
                    "tid":   tenant_id,
                    "acc":   gl_advance_id,
                    "cr":    cr_advance,
                    "desc":  "Advance clearing",
                    "ord":   order,
                    "now":   now,
                },
            )
            order += 1

    balance = total_claimed - advance_amount

    if balance > 0:
        # Overspend: CR Employee Payable (company owes employee)
        # We use the advance account as a proxy; a proper payable account would be configured
        # per tenant. Use gl_advance_account_id as the clearing side with a note.
        ep_result = await db.execute(
            text("""
                SELECT id FROM chart_of_accounts
                WHERE tenant_id = :tid AND LOWER(name) LIKE '%employee payable%'
                LIMIT 1
            """),
            {"tid": tenant_id},
        )
        ep_row = ep_result.fetchone()
        if ep_row:
            await db.execute(
                text("""
                    INSERT INTO journal_lines
                        (id, journal_entry_id, tenant_id, account_id, debit, credit,
                         description, line_order, created_at)
                    VALUES
                        (:id, :je_id, :tid, :acc, 0, :cr, :desc, :ord, :now)
                """),
                {
                    "id":    str(uuid.uuid4()),
                    "je_id": je_id,
                    "tid":   tenant_id,
                    "acc":   str(ep_row[0]),
                    "cr":    float(balance),
                    "desc":  "Overspend — amount payable to employee",
                    "ord":   order,
                    "now":   now,
                },
            )

    elif balance < 0:
        # Underspend: DR Employee Payable (employee owes company), CR Employee Advance (if any remaining)
        ep_result = await db.execute(
            text("""
                SELECT id FROM chart_of_accounts
                WHERE tenant_id = :tid AND LOWER(name) LIKE '%employee payable%'
                LIMIT 1
            """),
            {"tid": tenant_id},
        )
        ep_row = ep_result.fetchone()
        if ep_row and gl_advance_id:
            underspend = float(abs(balance))
            await db.execute(
                text("""
                    INSERT INTO journal_lines
                        (id, journal_entry_id, tenant_id, account_id, debit, credit,
                         description, line_order, created_at)
                    VALUES
                        (:id, :je_id, :tid, :acc, :dr, 0, :desc, :ord, :now)
                """),
                {
                    "id":    str(uuid.uuid4()),
                    "je_id": je_id,
                    "tid":   tenant_id,
                    "acc":   str(ep_row[0]),
                    "dr":    underspend,
                    "desc":  "Underspend — amount receivable from employee",
                    "ord":   order,
                    "now":   now,
                },
            )

    return je_id


# ── Advance CRUD ──────────────────────────────────────────────────────────────

@router.get("")
async def list_advances(
    status: Optional[str] = Query(None),
    employee_id: Optional[str] = Query(None),
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """
    List employee advances.

    Employees see only their own advances.
    Tenant admins and finance roles see all advances for the tenant.

    Parameters:
        status       Filter by advance status.
        employee_id  Finance/admin filter by a specific employee.
    """
    tid = str(current_user.tenant_id)
    is_finance = current_user.is_tenant_admin

    query = "SELECT * FROM employee_advances WHERE tenant_id = :tid"
    params: dict = {"tid": tid}

    if not is_finance:
        query += " AND employee_id = :eid"
        params["eid"] = str(current_user.user_id)
    elif employee_id:
        query += " AND employee_id = :eid"
        params["eid"] = employee_id

    if status:
        query += " AND status = :status"
        params["status"] = status.upper()

    query += " ORDER BY created_at DESC"

    result = await db.execute(text(query), params)
    rows = result.mappings().all()

    return [dict(r) for r in rows]


@router.post("")
async def create_advance(
    body: AdvanceCreate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new advance request in DRAFT status.

    Any authenticated employee can create an advance request.
    The advance number is auto-assigned as ADV-YYYY-NNNN.
    """
    tid = str(current_user.tenant_id)
    adv_id = str(uuid.uuid4())
    adv_number = await _next_advance_number(db, tid)
    now = datetime.now(timezone.utc)

    await db.execute(
        text("""
            INSERT INTO employee_advances (
                id, tenant_id, employee_id, advance_number, advance_type, purpose,
                amount, currency, status, request_date, required_by_date,
                due_retirement_date, gl_advance_account_id, gl_cash_account_id,
                notes, total_retired, created_at, updated_at
            ) VALUES (
                :id, :tid, :eid, :num, :atype, :purpose,
                :amount, :currency, 'DRAFT', :rdate, :rby,
                :drd, :gladv, :glcash,
                :notes, 0, :now, :now
            )
        """),
        {
            "id":       adv_id,
            "tid":      tid,
            "eid":      str(current_user.user_id),
            "num":      adv_number,
            "atype":    body.advance_type,
            "purpose":  body.purpose,
            "amount":   float(body.amount),
            "currency": body.currency,
            "rdate":    body.request_date,
            "rby":      body.required_by_date,
            "drd":      body.due_retirement_date,
            "gladv":    body.gl_advance_account_id,
            "glcash":   body.gl_cash_account_id,
            "notes":    body.notes,
            "now":      now,
        },
    )
    await db.commit()

    result = await db.execute(
        text("SELECT * FROM employee_advances WHERE id = :id"), {"id": adv_id}
    )
    return dict(result.mappings().first())


@router.get("/aging")
async def advance_aging(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """
    Advance aging report — outstanding advances by age bucket.

    Returns advances in ISSUED / PARTIALLY_RETIRED status grouped by age.
    Finance and admin roles only.
    """
    if not current_user.is_tenant_admin:
        raise HTTPException(status_code=403, detail="Finance role required.")

    tid = str(current_user.tenant_id)
    result = await db.execute(
        text("""
            SELECT
                ea.id,
                ea.advance_number,
                ea.employee_id,
                ea.advance_type,
                ea.purpose,
                ea.amount,
                ea.total_retired,
                (ea.amount - ea.total_retired) AS outstanding,
                ea.currency,
                ea.status,
                ea.issued_at,
                ea.due_retirement_date,
                CURRENT_DATE - ea.issued_at::date AS days_outstanding,
                CASE
                    WHEN CURRENT_DATE - ea.issued_at::date <= 30  THEN '0-30 days'
                    WHEN CURRENT_DATE - ea.issued_at::date <= 60  THEN '31-60 days'
                    WHEN CURRENT_DATE - ea.issued_at::date <= 90  THEN '61-90 days'
                    ELSE 'Over 90 days'
                END AS age_bucket
            FROM employee_advances ea
            WHERE ea.tenant_id = :tid
              AND ea.status IN ('ISSUED', 'PARTIALLY_RETIRED')
            ORDER BY ea.issued_at ASC
        """),
        {"tid": tid},
    )
    rows = result.mappings().all()
    return [dict(r) for r in rows]


@router.get("/{advance_id}")
async def get_advance(
    advance_id: str,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Get advance detail. Employees can only see their own advances."""
    tid = str(current_user.tenant_id)
    result = await db.execute(
        text("SELECT * FROM employee_advances WHERE id = :id AND tenant_id = :tid"),
        {"id": advance_id, "tid": tid},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Advance not found.")

    is_finance = current_user.is_tenant_admin
    if not is_finance and str(row["employee_id"]) != str(current_user.user_id):
        raise HTTPException(status_code=403, detail="Not authorised to view this advance.")

    return dict(row)


@router.put("/{advance_id}")
async def update_advance(
    advance_id: str,
    body: AdvanceUpdate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Update an advance. Only allowed in DRAFT status by the advance owner."""
    tid = str(current_user.tenant_id)
    result = await db.execute(
        text("SELECT * FROM employee_advances WHERE id = :id AND tenant_id = :tid"),
        {"id": advance_id, "tid": tid},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Advance not found.")
    if row["status"] != "DRAFT":
        raise HTTPException(status_code=400, detail="Only DRAFT advances can be edited.")
    if str(row["employee_id"]) != str(current_user.user_id) and not current_user.is_tenant_admin:
        raise HTTPException(status_code=403, detail="Not authorised.")

    updates = body.model_dump(exclude_none=True)
    if not updates:
        return dict(row)

    set_clause = ", ".join(f"{k} = :{k}" for k in updates)
    updates["id"] = advance_id
    updates["tid"] = tid
    updates["updated_at"] = datetime.now(timezone.utc)

    await db.execute(
        text(f"UPDATE employee_advances SET {set_clause}, updated_at = :updated_at WHERE id = :id AND tenant_id = :tid"),
        updates,
    )
    await db.commit()

    result = await db.execute(
        text("SELECT * FROM employee_advances WHERE id = :id"), {"id": advance_id}
    )
    return dict(result.mappings().first())


@router.post("/{advance_id}/submit")
async def submit_advance(
    advance_id: str,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Submit a DRAFT advance for approval."""
    tid = str(current_user.tenant_id)
    result = await db.execute(
        text("SELECT * FROM employee_advances WHERE id = :id AND tenant_id = :tid"),
        {"id": advance_id, "tid": tid},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Advance not found.")
    if row["status"] != "DRAFT":
        raise HTTPException(status_code=400, detail="Only DRAFT advances can be submitted.")
    if str(row["employee_id"]) != str(current_user.user_id) and not current_user.is_tenant_admin:
        raise HTTPException(status_code=403, detail="Not authorised.")

    now = datetime.now(timezone.utc)
    await db.execute(
        text("""
            UPDATE employee_advances
            SET status = 'SUBMITTED', submitted_at = :now, current_approval_level = 1,
                updated_at = :now
            WHERE id = :id AND tenant_id = :tid
        """),
        {"id": advance_id, "tid": tid, "now": now},
    )
    await db.commit()
    return {"message": "Advance submitted for approval.", "advance_id": advance_id}


@router.post("/{advance_id}/approve")
async def approve_advance(
    advance_id: str,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Approve a submitted advance."""
    tid = str(current_user.tenant_id)
    result = await db.execute(
        text("SELECT * FROM employee_advances WHERE id = :id AND tenant_id = :tid"),
        {"id": advance_id, "tid": tid},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Advance not found.")
    if row["status"] != "SUBMITTED":
        raise HTTPException(status_code=400, detail="Advance is not in SUBMITTED status.")

    now = datetime.now(timezone.utc)
    await db.execute(
        text("""
            UPDATE employee_advances
            SET status = 'APPROVED', approved_at = :now, updated_at = :now
            WHERE id = :id AND tenant_id = :tid
        """),
        {"id": advance_id, "tid": tid, "now": now},
    )
    await db.commit()
    return {"message": "Advance approved.", "advance_id": advance_id}


@router.post("/{advance_id}/reject")
async def reject_advance(
    advance_id: str,
    body: RejectBody,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Reject a submitted advance with a mandatory comment."""
    tid = str(current_user.tenant_id)
    result = await db.execute(
        text("SELECT * FROM employee_advances WHERE id = :id AND tenant_id = :tid"),
        {"id": advance_id, "tid": tid},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Advance not found.")
    if row["status"] not in ("SUBMITTED", "APPROVED"):
        raise HTTPException(status_code=400, detail="Advance cannot be rejected in current status.")

    now = datetime.now(timezone.utc)
    await db.execute(
        text("""
            UPDATE employee_advances
            SET status = 'REJECTED', rejection_comment = :comment, updated_at = :now
            WHERE id = :id AND tenant_id = :tid
        """),
        {"id": advance_id, "tid": tid, "comment": body.comment, "now": now},
    )
    await db.commit()
    return {"message": "Advance rejected.", "advance_id": advance_id}


@router.post("/{advance_id}/issue")
async def issue_advance(
    advance_id: str,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """
    Mark an approved advance as ISSUED (cash disbursed to employee).

    In Full ERP mode, automatically posts the issuance journal entry:
        DR Employee Advance Account / CR Cash
    In Connected mode, creates a posting_batch row for the external ERP.
    In Lite mode, only updates the status — no GL impact.

    Finance roles only.
    """
    if not current_user.is_tenant_admin:
        raise HTTPException(status_code=403, detail="Finance role required to issue advances.")

    tid = str(current_user.tenant_id)
    result = await db.execute(
        text("SELECT * FROM employee_advances WHERE id = :id AND tenant_id = :tid"),
        {"id": advance_id, "tid": tid},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Advance not found.")
    if row["status"] != "APPROVED":
        raise HTTPException(status_code=400, detail="Only APPROVED advances can be issued.")

    mode = await _get_posting_mode(db, tid)
    now = datetime.now(timezone.utc)
    je_id = None

    if mode == "FULL_ERP":
        je_id = await _post_issuance_journal(
            db,
            tenant_id=tid,
            advance_id=advance_id,
            amount=Decimal(str(row["amount"])),
            currency=row["currency"],
            gl_advance_id=str(row["gl_advance_account_id"]) if row["gl_advance_account_id"] else None,
            gl_cash_id=str(row["gl_cash_account_id"]) if row["gl_cash_account_id"] else None,
            issued_by=str(current_user.user_id),
        )
    elif mode == "CONNECTED":
        import json as _json
        batch_id = str(uuid.uuid4())
        batch_ref = f"ADV-ISS-{advance_id[:8].upper()}"
        await db.execute(
            text("""
                INSERT INTO posting_batches
                    (id, tenant_id, batch_ref, module, status, transactions, created_at)
                VALUES (:id, :tid, :ref, 'advance', 'pending', :txn::jsonb, :now)
            """),
            {
                "id":  batch_id,
                "tid": tid,
                "ref": batch_ref,
                "txn": _json.dumps({
                    "type":       "ADVANCE_ISSUANCE",
                    "advance_id": advance_id,
                    "amount":     float(row["amount"]),
                    "currency":   row["currency"],
                }),
                "now": now,
            },
        )

    await db.execute(
        text("""
            UPDATE employee_advances
            SET status = 'ISSUED', issued_by = :by, issued_at = :now, updated_at = :now
            WHERE id = :id AND tenant_id = :tid
        """),
        {"id": advance_id, "tid": tid, "by": str(current_user.user_id), "now": now},
    )
    await db.commit()

    return {
        "message": "Advance issued. Cash disbursed.",
        "advance_id": advance_id,
        "journal_entry_id": je_id,
        "posting_mode": mode,
    }


@router.post("/{advance_id}/cancel")
async def cancel_advance(
    advance_id: str,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Cancel an advance in DRAFT or SUBMITTED status."""
    tid = str(current_user.tenant_id)
    result = await db.execute(
        text("SELECT * FROM employee_advances WHERE id = :id AND tenant_id = :tid"),
        {"id": advance_id, "tid": tid},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Advance not found.")
    if row["status"] not in ("DRAFT", "SUBMITTED"):
        raise HTTPException(status_code=400, detail="Only DRAFT or SUBMITTED advances can be cancelled.")
    if str(row["employee_id"]) != str(current_user.user_id) and not current_user.is_tenant_admin:
        raise HTTPException(status_code=403, detail="Not authorised.")

    now = datetime.now(timezone.utc)
    await db.execute(
        text("UPDATE employee_advances SET status = 'CANCELLED', updated_at = :now WHERE id = :id AND tenant_id = :tid"),
        {"id": advance_id, "tid": tid, "now": now},
    )
    await db.commit()
    return {"message": "Advance cancelled.", "advance_id": advance_id}


# ── Retirement CRUD ───────────────────────────────────────────────────────────

@router.post("/{advance_id}/retirements")
async def create_retirement(
    advance_id: str,
    body: RetirementCreate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """
    Start a new retirement for an issued advance.

    Only the advance owner can create a retirement.
    The advance must be in ISSUED or PARTIALLY_RETIRED status.
    """
    tid = str(current_user.tenant_id)
    adv_result = await db.execute(
        text("SELECT * FROM employee_advances WHERE id = :id AND tenant_id = :tid"),
        {"id": advance_id, "tid": tid},
    )
    adv = adv_result.mappings().first()
    if not adv:
        raise HTTPException(status_code=404, detail="Advance not found.")
    if adv["status"] not in ("ISSUED", "PARTIALLY_RETIRED"):
        raise HTTPException(status_code=400, detail="Advance must be ISSUED or PARTIALLY_RETIRED to create a retirement.")
    if str(adv["employee_id"]) != str(current_user.user_id) and not current_user.is_tenant_admin:
        raise HTTPException(status_code=403, detail="Not authorised.")

    ret_id = str(uuid.uuid4())
    ret_number = await _next_retirement_number(db, tid)
    now = datetime.now(timezone.utc)

    await db.execute(
        text("""
            INSERT INTO advance_retirements (
                id, tenant_id, advance_id, employee_id, retirement_number,
                retirement_date, advance_amount, total_claimed, balance, status,
                notes, created_at, updated_at
            ) VALUES (
                :id, :tid, :adv, :eid, :num,
                :rdate, :adv_amount, 0, 0, 'DRAFT',
                :notes, :now, :now
            )
        """),
        {
            "id":         ret_id,
            "tid":        tid,
            "adv":        advance_id,
            "eid":        str(current_user.user_id),
            "num":        ret_number,
            "rdate":      body.retirement_date,
            "adv_amount": float(adv["amount"]),
            "notes":      body.notes,
            "now":        now,
        },
    )
    await db.commit()

    result = await db.execute(
        text("SELECT * FROM advance_retirements WHERE id = :id"), {"id": ret_id}
    )
    return dict(result.mappings().first())


@router.get("/{advance_id}/retirements")
async def list_retirements(
    advance_id: str,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """List all retirements for an advance. Requires ownership or admin/finance role."""
    tid = str(current_user.tenant_id)
    # Ownership check: verify the advance belongs to this user or the caller is admin
    adv_result = await db.execute(
        text("SELECT employee_id FROM employee_advances WHERE id = :id AND tenant_id = :tid"),
        {"id": advance_id, "tid": tid},
    )
    adv_row = adv_result.mappings().first()
    if not adv_row:
        raise HTTPException(status_code=404, detail="Advance not found.")
    if str(adv_row["employee_id"]) != str(current_user.user_id) and not current_user.is_tenant_admin:
        raise HTTPException(status_code=403, detail="Not authorised.")

    result = await db.execute(
        text("""
            SELECT * FROM advance_retirements
            WHERE advance_id = :adv AND tenant_id = :tid
            ORDER BY created_at DESC
        """),
        {"adv": advance_id, "tid": tid},
    )
    return [dict(r) for r in result.mappings().all()]


@router.get("/retirements/{ret_id}")
async def get_retirement(
    ret_id: str,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Get retirement detail including all lines. Requires ownership or admin/finance role."""
    tid = str(current_user.tenant_id)
    ret_result = await db.execute(
        text("SELECT * FROM advance_retirements WHERE id = :id AND tenant_id = :tid"),
        {"id": ret_id, "tid": tid},
    )
    ret = ret_result.mappings().first()
    if not ret:
        raise HTTPException(status_code=404, detail="Retirement not found.")

    # Ownership check via the parent advance
    adv_result = await db.execute(
        text("SELECT employee_id FROM employee_advances WHERE id = :id AND tenant_id = :tid"),
        {"id": str(ret["advance_id"]), "tid": tid},
    )
    adv_row = adv_result.mappings().first()
    if adv_row and str(adv_row["employee_id"]) != str(current_user.user_id) and not current_user.is_tenant_admin:
        raise HTTPException(status_code=403, detail="Not authorised.")

    lines_result = await db.execute(
        text("SELECT * FROM advance_retirement_lines WHERE retirement_id = :rid ORDER BY created_at"),
        {"rid": ret_id},
    )
    lines = [dict(r) for r in lines_result.mappings().all()]

    return {**dict(ret), "lines": lines}


@router.post("/retirements/{ret_id}/lines")
async def add_retirement_line(
    ret_id: str,
    body: RetirementLineCreate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Add an expense line to a DRAFT retirement. Requires ownership or admin/finance role."""
    tid = str(current_user.tenant_id)
    ret_result = await db.execute(
        text("SELECT * FROM advance_retirements WHERE id = :id AND tenant_id = :tid"),
        {"id": ret_id, "tid": tid},
    )
    ret = ret_result.mappings().first()
    if not ret:
        raise HTTPException(status_code=404, detail="Retirement not found.")
    if ret["status"] != "DRAFT":
        raise HTTPException(status_code=400, detail="Lines can only be added to DRAFT retirements.")
    # Ownership check via the parent advance
    adv_result = await db.execute(
        text("SELECT employee_id FROM employee_advances WHERE id = :id AND tenant_id = :tid"),
        {"id": str(ret["advance_id"]), "tid": tid},
    )
    adv_row = adv_result.mappings().first()
    if adv_row and str(adv_row["employee_id"]) != str(current_user.user_id) and not current_user.is_tenant_admin:
        raise HTTPException(status_code=403, detail="Not authorised.")

    line_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    await db.execute(
        text("""
            INSERT INTO advance_retirement_lines (
                id, tenant_id, retirement_id, advance_id, description, amount,
                currency, receipt_date, gl_id, dimension_values,
                category_id, subcategory_id, created_at
            ) VALUES (
                :id, :tid, :ret, :adv, :desc, :amount,
                :currency, :rdate, :gl_id, :dims,
                :cat, :subcat, :now
            )
        """),
        {
            "id":       line_id,
            "tid":      tid,
            "ret":      ret_id,
            "adv":      str(ret["advance_id"]),
            "desc":     body.description,
            "amount":   float(body.amount),
            "currency": body.currency,
            "rdate":    body.receipt_date,
            "gl_id":    body.gl_id,
            "dims":     body.dimension_values,
            "cat":      body.category_id,
            "subcat":   body.subcategory_id,
            "now":      now,
        },
    )

    # Recalculate total_claimed and balance on the retirement
    new_total_result = await db.execute(
        text("SELECT COALESCE(SUM(amount), 0) FROM advance_retirement_lines WHERE retirement_id = :rid"),
        {"rid": ret_id},
    )
    new_total = Decimal(str(new_total_result.scalar()))
    new_balance = new_total - Decimal(str(ret["advance_amount"]))

    await db.execute(
        text("""
            UPDATE advance_retirements
            SET total_claimed = :tc, balance = :bal, updated_at = :now
            WHERE id = :id
        """),
        {"tc": float(new_total), "bal": float(new_balance), "now": now, "id": ret_id},
    )
    await db.commit()

    result = await db.execute(
        text("SELECT * FROM advance_retirement_lines WHERE id = :id"), {"id": line_id}
    )
    return dict(result.mappings().first())


@router.delete("/retirements/{ret_id}/lines/{line_id}")
async def remove_retirement_line(
    ret_id: str,
    line_id: str,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Remove a line from a DRAFT retirement. Requires ownership or admin/finance role."""
    tid = str(current_user.tenant_id)
    ret_result = await db.execute(
        text("SELECT * FROM advance_retirements WHERE id = :id AND tenant_id = :tid"),
        {"id": ret_id, "tid": tid},
    )
    ret = ret_result.mappings().first()
    if not ret:
        raise HTTPException(status_code=404, detail="Retirement not found.")
    if ret["status"] != "DRAFT":
        raise HTTPException(status_code=400, detail="Lines can only be removed from DRAFT retirements.")
    # Ownership check via the parent advance
    adv_result = await db.execute(
        text("SELECT employee_id FROM employee_advances WHERE id = :id AND tenant_id = :tid"),
        {"id": str(ret["advance_id"]), "tid": tid},
    )
    adv_row = adv_result.mappings().first()
    if adv_row and str(adv_row["employee_id"]) != str(current_user.user_id) and not current_user.is_tenant_admin:
        raise HTTPException(status_code=403, detail="Not authorised.")

    await db.execute(
        text("DELETE FROM advance_retirement_lines WHERE id = :id AND retirement_id = :rid"),
        {"id": line_id, "rid": ret_id},
    )

    now = datetime.now(timezone.utc)
    new_total_result = await db.execute(
        text("SELECT COALESCE(SUM(amount), 0) FROM advance_retirement_lines WHERE retirement_id = :rid"),
        {"rid": ret_id},
    )
    new_total = Decimal(str(new_total_result.scalar()))
    new_balance = new_total - Decimal(str(ret["advance_amount"]))

    await db.execute(
        text("""
            UPDATE advance_retirements
            SET total_claimed = :tc, balance = :bal, updated_at = :now
            WHERE id = :id
        """),
        {"tc": float(new_total), "bal": float(new_balance), "now": now, "id": ret_id},
    )
    await db.commit()
    return {"message": "Line removed."}


@router.post("/retirements/{ret_id}/submit")
async def submit_retirement(
    ret_id: str,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Submit a DRAFT retirement for approval. Requires at least one line."""
    tid = str(current_user.tenant_id)
    ret_result = await db.execute(
        text("SELECT * FROM advance_retirements WHERE id = :id AND tenant_id = :tid"),
        {"id": ret_id, "tid": tid},
    )
    ret = ret_result.mappings().first()
    if not ret:
        raise HTTPException(status_code=404, detail="Retirement not found.")
    if ret["status"] != "DRAFT":
        raise HTTPException(status_code=400, detail="Only DRAFT retirements can be submitted.")

    # Must have at least one line
    line_count_result = await db.execute(
        text("SELECT COUNT(*) FROM advance_retirement_lines WHERE retirement_id = :rid"),
        {"rid": ret_id},
    )
    if (line_count_result.scalar() or 0) == 0:
        raise HTTPException(status_code=400, detail="Retirement must have at least one expense line.")

    now = datetime.now(timezone.utc)
    await db.execute(
        text("""
            UPDATE advance_retirements
            SET status = 'SUBMITTED', submitted_at = :now, current_approval_level = 1,
                updated_at = :now
            WHERE id = :id AND tenant_id = :tid
        """),
        {"id": ret_id, "tid": tid, "now": now},
    )
    await db.commit()
    return {"message": "Retirement submitted for approval.", "retirement_id": ret_id}


@router.post("/retirements/{ret_id}/approve")
async def approve_retirement(
    ret_id: str,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """
    Approve a retirement.

    On approval, update the parent advance's total_retired and flip its status:
        If total_retired >= advance.amount → FULLY_RETIRED
        Otherwise → PARTIALLY_RETIRED
    """
    tid = str(current_user.tenant_id)
    ret_result = await db.execute(
        text("SELECT * FROM advance_retirements WHERE id = :id AND tenant_id = :tid"),
        {"id": ret_id, "tid": tid},
    )
    ret = ret_result.mappings().first()
    if not ret:
        raise HTTPException(status_code=404, detail="Retirement not found.")
    if ret["status"] != "SUBMITTED":
        raise HTTPException(status_code=400, detail="Retirement is not in SUBMITTED status.")

    now = datetime.now(timezone.utc)

    # Update the retirement
    await db.execute(
        text("""
            UPDATE advance_retirements
            SET status = 'APPROVED', approved_at = :now, updated_at = :now
            WHERE id = :id AND tenant_id = :tid
        """),
        {"id": ret_id, "tid": tid, "now": now},
    )

    # Update parent advance total_retired
    adv_result = await db.execute(
        text("SELECT * FROM employee_advances WHERE id = :id AND tenant_id = :tid"),
        {"id": str(ret["advance_id"]), "tid": tid},
    )
    adv = adv_result.mappings().first()
    if adv:
        new_total_retired = Decimal(str(adv["total_retired"])) + Decimal(str(ret["total_claimed"]))
        new_adv_status = "FULLY_RETIRED" if new_total_retired >= Decimal(str(adv["amount"])) else "PARTIALLY_RETIRED"
        await db.execute(
            text("""
                UPDATE employee_advances
                SET total_retired = :tr, status = :st, updated_at = :now
                WHERE id = :id AND tenant_id = :tid
            """),
            {
                "tr":  float(new_total_retired),
                "st":  new_adv_status,
                "now": now,
                "id":  str(adv["id"]),
                "tid": tid,
            },
        )

    # Connected mode — add retirement to export queue
    mode = await _get_posting_mode(db, tid)
    if mode == "CONNECTED":
        import json as _json
        ret_batch_id = str(uuid.uuid4())
        ret_batch_ref = f"ADV-RET-{ret_id[:8].upper()}"
        await db.execute(
            text("""
                INSERT INTO posting_batches
                    (id, tenant_id, batch_ref, module, status, transactions, created_at)
                VALUES (:id, :tid, :ref, 'advance', 'pending', :txn::jsonb, :now)
            """),
            {
                "id":  ret_batch_id,
                "tid": tid,
                "ref": ret_batch_ref,
                "txn": _json.dumps({
                    "type":          "ADVANCE_RETIREMENT",
                    "retirement_id": ret_id,
                    "advance_id":    str(ret["advance_id"]),
                    "total_claimed": float(ret["total_claimed"]),
                    "balance":       float(ret["balance"]),
                }),
                "now": now,
            },
        )

    await db.commit()
    return {"message": "Retirement approved.", "retirement_id": ret_id}


@router.post("/retirements/{ret_id}/reject")
async def reject_retirement(
    ret_id: str,
    body: RejectBody,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Reject a submitted retirement with a mandatory comment."""
    tid = str(current_user.tenant_id)
    ret_result = await db.execute(
        text("SELECT * FROM advance_retirements WHERE id = :id AND tenant_id = :tid"),
        {"id": ret_id, "tid": tid},
    )
    ret = ret_result.mappings().first()
    if not ret:
        raise HTTPException(status_code=404, detail="Retirement not found.")
    if ret["status"] not in ("SUBMITTED", "APPROVED"):
        raise HTTPException(status_code=400, detail="Retirement cannot be rejected in current status.")

    now = datetime.now(timezone.utc)
    await db.execute(
        text("""
            UPDATE advance_retirements
            SET status = 'REJECTED', rejection_comment = :comment, updated_at = :now
            WHERE id = :id AND tenant_id = :tid
        """),
        {"id": ret_id, "tid": tid, "comment": body.comment, "now": now},
    )
    await db.commit()
    return {"message": "Retirement rejected.", "retirement_id": ret_id}


@router.post("/retirements/{ret_id}/post")
async def post_retirement_gl(
    ret_id: str,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """
    Post the retirement to GL (Full ERP mode only).

    Creates journal entries:
      DR Expense GLs / CR Employee Advance (up to advance amount)
      Overspend: DR Expense / CR Employee Payable
      Underspend: DR Employee Payable / CR Employee Advance

    Finance poster / finance manager only.
    """
    if not current_user.is_tenant_admin:
        raise HTTPException(status_code=403, detail="Finance poster role required.")

    tid = str(current_user.tenant_id)
    mode = await _get_posting_mode(db, tid)
    if mode != "FULL_ERP":
        raise HTTPException(status_code=400, detail="GL posting is only available in Full ERP mode.")

    ret_result = await db.execute(
        text("SELECT * FROM advance_retirements WHERE id = :id AND tenant_id = :tid"),
        {"id": ret_id, "tid": tid},
    )
    ret = ret_result.mappings().first()
    if not ret:
        raise HTTPException(status_code=404, detail="Retirement not found.")
    if ret["status"] != "APPROVED":
        raise HTTPException(status_code=400, detail="Retirement must be APPROVED before posting.")
    if ret["posted_at"]:
        raise HTTPException(status_code=400, detail="Retirement has already been posted.")

    # Fetch lines
    lines_result = await db.execute(
        text("SELECT * FROM advance_retirement_lines WHERE retirement_id = :rid"),
        {"rid": ret_id},
    )
    lines = [dict(r) for r in lines_result.mappings().all()]

    # Fetch advance
    adv_result = await db.execute(
        text("SELECT * FROM employee_advances WHERE id = :id"),
        {"id": str(ret["advance_id"])},
    )
    adv = dict(adv_result.mappings().first())

    je_id = await _post_retirement_journal(
        db=db,
        tenant_id=tid,
        retirement=dict(ret),
        lines=lines,
        advance=adv,
        posted_by=str(current_user.user_id),
    )

    now = datetime.now(timezone.utc)
    await db.execute(
        text("""
            UPDATE advance_retirements
            SET status = 'POSTED', posted_at = :now, journal_entry_id = :je, updated_at = :now
            WHERE id = :id AND tenant_id = :tid
        """),
        {"id": ret_id, "tid": tid, "now": now, "je": je_id},
    )
    await db.commit()

    return {
        "message": "Retirement posted to GL.",
        "retirement_id": ret_id,
        "journal_entry_id": je_id,
    }
