"""Petty Cash router — /api/petty-cash.

What this module does:
  Full lifecycle management of petty cash funds:

  GET  /api/petty-cash/funds                        — list all funds
  POST /api/petty-cash/funds                        — create fund
  GET  /api/petty-cash/funds/{id}                   — fund detail + running balance
  PUT  /api/petty-cash/funds/{id}                   — update fund meta (name, custodian, etc.)
  GET  /api/petty-cash/funds/{id}/transactions      — paginated transaction history
  POST /api/petty-cash/funds/{id}/disburse          — give cash out (reduces balance)
  POST /api/petty-cash/funds/{id}/retire            — employee submits receipts (balance neutral)
  POST /api/petty-cash/funds/{id}/replenish         — top up the fund (increases balance)
  POST /api/petty-cash/funds/{id}/adjust            — manual correction

Balance rule:
  DISBURSEMENT  → balance -= amount
  RETIREMENT    → balance unchanged (this closes out a previous disbursement)
  REPLENISHMENT → balance += amount
  ADJUSTMENT    → balance += amount  (can be negative for correction)

All transactions record balance_after so the history is self-auditing.

Security:
  All queries tenant-scoped. No secrets committed.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, field_validator
from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import CurrentUser, require_auth


router = APIRouter(prefix="/api/petty-cash", tags=["petty-cash"])

# ── Request schemas (inline for simplicity) ───────────────────────────────────

class FundCreate(BaseModel):
    name: str
    description: Optional[str] = None
    custodian_id: Optional[str] = None
    gl_account_id: Optional[str] = None
    expense_gl_account_id: Optional[str] = None
    currency_code: str = "NGN"
    float_amount: Decimal = Decimal("0")
    opening_balance: Decimal = Decimal("0")

class FundUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    custodian_id: Optional[str] = None
    gl_account_id: Optional[str] = None
    expense_gl_account_id: Optional[str] = None
    float_amount: Optional[Decimal] = None
    is_active: Optional[bool] = None

class DisburseBody(BaseModel):
    employee_id: Optional[str] = None
    amount: Decimal
    description: str
    reference: Optional[str] = None
    transaction_date: date
    notes: Optional[str] = None

    @field_validator("amount")
    @classmethod
    def positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("amount must be positive")
        return v

class RetireBody(BaseModel):
    """Employee submits receipts — balance-neutral, links to expense report."""
    employee_id: Optional[str] = None
    amount: Decimal
    description: str
    reference: Optional[str] = None
    transaction_date: date
    expense_report_id: Optional[str] = None
    notes: Optional[str] = None

class ReplenishBody(BaseModel):
    amount: Decimal
    description: str = "Fund replenishment"
    reference: Optional[str] = None
    transaction_date: date
    notes: Optional[str] = None

    @field_validator("amount")
    @classmethod
    def positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("amount must be positive")
        return v

class AdjustBody(BaseModel):
    amount: Decimal       # negative to reduce
    description: str
    transaction_date: date
    notes: Optional[str] = None

# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_fund(fund_id: str, tenant_id: str, db: AsyncSession) -> dict:
    row = (await db.execute(
        text("SELECT * FROM petty_cash_funds WHERE id = :id AND tenant_id = :tid"),
        {"id": fund_id, "tid": tenant_id},
    )).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Petty cash fund not found")
    return dict(row)

async def _record_transaction(
    fund_id: str,
    tenant_id: str,
    txn_type: str,
    amount: Decimal,
    balance_delta: Decimal,
    description: str,
    transaction_date: date,
    db: AsyncSession,
    current_user: CurrentUser,
    *,
    employee_id: Optional[str] = None,
    reference: Optional[str] = None,
    expense_report_id: Optional[str] = None,
    notes: Optional[str] = None,
) -> str:
    fund = await _get_fund(fund_id, tenant_id, db)
    if not fund["is_active"]:
        raise HTTPException(status_code=422, detail="Fund is inactive")
    if txn_type == "DISBURSEMENT" and Decimal(str(fund["current_balance"])) < amount:
        raise HTTPException(status_code=422, detail=f"Insufficient fund balance. Available: {fund['current_balance']}")

    new_balance = Decimal(str(fund["current_balance"])) + balance_delta
    txn_id = str(uuid.uuid4())

    await db.execute(text("""
        INSERT INTO petty_cash_transactions
          (id, tenant_id, fund_id, transaction_type, employee_id, amount, description,
           reference, transaction_date, expense_report_id, balance_after,
           recorded_by, notes, created_at)
        VALUES
          (:id, :tid, :fid, :txn_type, :emp_id, :amt, :desc,
           :ref, :txn_date, :er_id, :bal_after,
           :user_id, :notes, NOW())
    """), {
        "id": txn_id, "tid": tenant_id, "fid": fund_id,
        "txn_type": txn_type, "emp_id": employee_id,
        "amt": float(amount), "desc": description,
        "ref": reference, "txn_date": transaction_date,
        "er_id": expense_report_id, "bal_after": float(new_balance),
        "user_id": current_user.user_id, "notes": notes,
    })
    await db.execute(text("""
        UPDATE petty_cash_funds SET current_balance = :bal, updated_at = NOW()
        WHERE id = :fid AND tenant_id = :tid
    """), {"bal": float(new_balance), "fid": fund_id, "tid": tenant_id})
    await db.commit()
    return txn_id

# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/funds")
async def list_funds(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
):
    rows = (await db.execute(
        text("""
            SELECT pcf.*,
                   CONCAT(e.first_name, ' ', e.last_name) AS custodian_name,
                   coa.account_name AS gl_account_name
            FROM petty_cash_funds pcf
            LEFT JOIN employees e ON e.id = pcf.custodian_id
            LEFT JOIN chart_of_accounts coa ON coa.id = pcf.gl_account_id
            WHERE pcf.tenant_id = :tid
            ORDER BY pcf.name
        """),
        {"tid": current_user.tenant_id},
    )).mappings().all()
    return [dict(r) for r in rows]


@router.post("/funds", status_code=201)
async def create_fund(
    body: FundCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
):
    fund_id = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO petty_cash_funds
          (id, tenant_id, name, description, custodian_id, gl_account_id,
           expense_gl_account_id, currency_code, float_amount, current_balance,
           is_active, created_by)
        VALUES
          (:id, :tid, :name, :desc, :cust_id, :gl_id,
           :exp_gl_id, :currency, :float_amt, :balance,
           true, :user_id)
    """), {
        "id": fund_id, "tid": current_user.tenant_id,
        "name": body.name, "desc": body.description,
        "cust_id": body.custodian_id, "gl_id": body.gl_account_id,
        "exp_gl_id": body.expense_gl_account_id,
        "currency": body.currency_code, "float_amt": float(body.float_amount),
        "balance": float(body.opening_balance), "user_id": current_user.user_id,
    })
    # Record opening balance as a REPLENISHMENT if non-zero
    if body.opening_balance > 0:
        txn_id = str(uuid.uuid4())
        await db.execute(text("""
            INSERT INTO petty_cash_transactions
              (id, tenant_id, fund_id, transaction_type, amount, description,
               transaction_date, balance_after, recorded_by, created_at)
            VALUES
              (:id, :tid, :fid, 'REPLENISHMENT', :amt, 'Opening balance',
               NOW(), :bal, :user_id, NOW())
        """), {
            "id": txn_id, "tid": current_user.tenant_id, "fid": fund_id,
            "amt": float(body.opening_balance), "bal": float(body.opening_balance),
            "user_id": current_user.user_id,
        })
    await db.commit()
    return {"id": fund_id}


@router.get("/funds/{fund_id}")
async def get_fund(
    fund_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
):
    row = (await db.execute(text("""
        SELECT pcf.*,
               CONCAT(e.first_name, ' ', e.last_name) AS custodian_name,
               coa.account_name AS gl_account_name
        FROM petty_cash_funds pcf
        LEFT JOIN employees e ON e.id = pcf.custodian_id
        LEFT JOIN chart_of_accounts coa ON coa.id = pcf.gl_account_id
        WHERE pcf.id = :id AND pcf.tenant_id = :tid
    """), {"id": fund_id, "tid": current_user.tenant_id})).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Fund not found")
    return dict(row)


@router.put("/funds/{fund_id}")
async def update_fund(
    fund_id: str,
    body: FundUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
):
    await _get_fund(fund_id, current_user.tenant_id, db)
    sets = []
    params: dict = {"id": fund_id, "tid": current_user.tenant_id}
    if body.name is not None: sets.append("name = :name"); params["name"] = body.name
    if body.description is not None: sets.append("description = :desc"); params["desc"] = body.description
    if body.custodian_id is not None: sets.append("custodian_id = :cust_id"); params["cust_id"] = body.custodian_id
    if body.gl_account_id is not None: sets.append("gl_account_id = :gl_id"); params["gl_id"] = body.gl_account_id
    if body.expense_gl_account_id is not None: sets.append("expense_gl_account_id = :exp_gl_id"); params["exp_gl_id"] = body.expense_gl_account_id
    if body.float_amount is not None: sets.append("float_amount = :float_amt"); params["float_amt"] = float(body.float_amount)
    if body.is_active is not None: sets.append("is_active = :is_active"); params["is_active"] = body.is_active
    if sets:
        sets.append("updated_at = NOW()")
        await db.execute(text(f"UPDATE petty_cash_funds SET {', '.join(sets)} WHERE id = :id AND tenant_id = :tid"), params)
        await db.commit()
    return {"ok": True}


@router.get("/funds/{fund_id}/transactions")
async def fund_transactions(
    fund_id: str,
    limit: int = Query(default=50, le=200),
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
):
    await _get_fund(fund_id, current_user.tenant_id, db)
    rows = (await db.execute(text("""
        SELECT pct.*,
               CONCAT(e.first_name, ' ', e.last_name) AS employee_name
        FROM petty_cash_transactions pct
        LEFT JOIN employees e ON e.id = pct.employee_id
        WHERE pct.fund_id = :fid AND pct.tenant_id = :tid
        ORDER BY pct.transaction_date DESC, pct.created_at DESC
        LIMIT :limit OFFSET :offset
    """), {"fid": fund_id, "tid": current_user.tenant_id, "limit": limit, "offset": offset})).mappings().all()
    return [dict(r) for r in rows]


@router.post("/funds/{fund_id}/disburse", status_code=201)
async def disburse(
    fund_id: str,
    body: DisburseBody,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
):
    txn_id = await _record_transaction(
        fund_id, current_user.tenant_id, "DISBURSEMENT", body.amount, -body.amount,
        body.description, body.transaction_date, db, current_user,
        employee_id=body.employee_id, reference=body.reference, notes=body.notes,
    )
    return {"id": txn_id}


@router.post("/funds/{fund_id}/retire", status_code=201)
async def retire(
    fund_id: str,
    body: RetireBody,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
):
    """Record retirement of petty cash — balance neutral (cash already disbursed)."""
    fund = await _get_fund(fund_id, current_user.tenant_id, db)
    txn_id = str(uuid.uuid4())
    balance_snapshot = Decimal(str(fund["current_balance"]))
    await db.execute(text("""
        INSERT INTO petty_cash_transactions
          (id, tenant_id, fund_id, transaction_type, employee_id, amount, description,
           reference, transaction_date, expense_report_id, balance_after,
           recorded_by, notes, created_at)
        VALUES
          (:id, :tid, :fid, 'RETIREMENT', :emp_id, :amt, :desc,
           :ref, :txn_date, :er_id, :bal_after,
           :user_id, :notes, NOW())
    """), {
        "id": txn_id, "tid": current_user.tenant_id, "fid": fund_id,
        "emp_id": body.employee_id, "amt": float(body.amount), "desc": body.description,
        "ref": body.reference, "txn_date": body.transaction_date,
        "er_id": body.expense_report_id, "bal_after": float(balance_snapshot),
        "user_id": current_user.user_id, "notes": body.notes,
    })
    await db.commit()
    return {"id": txn_id}


@router.post("/funds/{fund_id}/replenish", status_code=201)
async def replenish(
    fund_id: str,
    body: ReplenishBody,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
):
    txn_id = await _record_transaction(
        fund_id, current_user.tenant_id, "REPLENISHMENT", body.amount, body.amount,
        body.description, body.transaction_date, db, current_user,
        reference=body.reference, notes=body.notes,
    )
    return {"id": txn_id}


@router.post("/funds/{fund_id}/adjust", status_code=201)
async def adjust(
    fund_id: str,
    body: AdjustBody,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
):
    txn_id = await _record_transaction(
        fund_id, current_user.tenant_id, "ADJUSTMENT", abs(body.amount), body.amount,
        body.description, body.transaction_date, db, current_user, notes=body.notes,
    )
    return {"id": txn_id}
