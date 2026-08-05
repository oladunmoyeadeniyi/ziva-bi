"""Expense Payment router — /api/payments.

What this module does:
  Manages the payment queue for approved expense reports and (optionally)
  executes transfers via the Paystack API.

  GET  /api/payments/queue                        — list QUEUED payments for the tenant
  GET  /api/payments/history                      — list all payments (PAID + FAILED + CANCELLED)
  POST /api/payments/queue                         — add an approved report to the queue (body: {expense_report_id})
  POST /api/payments/{id}/initiate                — initiate payment (MANUAL: mark paid; PAYSTACK: API call)
  POST /api/payments/{id}/cancel                  — cancel a queued payment
  GET  /api/payments/config                       — get payment config for tenant
  POST /api/payments/config                       — upsert payment config
  GET  /api/payments/bank-accounts                — list employee bank accounts
  POST /api/payments/bank-accounts                — register bank account for employee
  DELETE /api/payments/bank-accounts/{id}         — remove bank account
  GET  /api/payments/banks                        — proxy Paystack bank list (PAYSTACK mode only)
  POST /api/payments/webhook                      — Paystack webhook endpoint (public, sig-verified)

Security:
  - Paystack brand name NEVER appears in user-facing error messages
  - API keys encrypted at rest; decrypted just-in-time
  - Webhook endpoint verifies X-Paystack-Signature before acting
  - All other endpoints: tenant-scoped + JWT auth
"""

import json
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Header
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.middleware.auth import CurrentUser, require_auth

from app.services.paystack_service import PaystackService

router = APIRouter(prefix="/api/payments", tags=["payments"])

# ── Request schemas ───────────────────────────────────────────────────────────

class QueueBody(BaseModel):
    expense_report_id: str
    employee_id: Optional[str] = None
    bank_account_id: Optional[str] = None
    amount: Decimal
    currency: str = "NGN"

class InitiateManualBody(BaseModel):
    payment_date: date
    payment_reference: Optional[str] = None
    payment_notes: Optional[str] = None

class ConfigUpsertBody(BaseModel):
    payment_mode: str  # MANUAL | PAYSTACK
    paystack_secret_key: Optional[str] = None   # plaintext — encrypted before storing
    paystack_public_key: Optional[str] = None

class BankAccountCreate(BaseModel):
    employee_id: str
    bank_name: str
    bank_code: Optional[str] = None
    account_number: str
    account_name: str
    currency: str = "NGN"
    is_primary: bool = True

# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_payment(payment_id: str, tenant_id: str, db: AsyncSession) -> dict:
    row = (await db.execute(
        text("SELECT * FROM expense_payments WHERE id = :id AND tenant_id = :tid"),
        {"id": payment_id, "tid": tenant_id},
    )).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Payment not found")
    return dict(row)

async def _get_tenant_config(tenant_id: str, db: AsyncSession) -> Optional[dict]:
    row = (await db.execute(
        text("SELECT * FROM expense_payment_configs WHERE tenant_id = :tid"),
        {"tid": tenant_id},
    )).mappings().first()
    return dict(row) if row else None

def _decrypt_key(encrypted: Optional[str]) -> Optional[str]:
    if not encrypted:
        return None
    if not settings.payment_encryption_key:
        return encrypted  # dev mode: stored as-is
    try:
        return PaystackService.decrypt(encrypted, settings.payment_encryption_key)
    except Exception:
        raise HTTPException(status_code=503, detail="Payment service is temporarily unavailable. Please try again later.")

def _encrypt_key(plaintext: Optional[str]) -> Optional[str]:
    if not plaintext:
        return None
    if not settings.payment_encryption_key:
        return plaintext  # dev mode
    return PaystackService.encrypt(plaintext, settings.payment_encryption_key)

# ── Payment queue ─────────────────────────────────────────────────────────────

@router.get("/queue")
async def list_queue(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
):
    rows = (await db.execute(text("""
        SELECT ep.*,
               CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
               eba.account_number, eba.bank_name
        FROM expense_payments ep
        LEFT JOIN employees e ON e.id = ep.employee_id
        LEFT JOIN employee_bank_accounts eba ON eba.id = ep.bank_account_id
        WHERE ep.tenant_id = :tid AND ep.status IN ('QUEUED', 'PROCESSING')
        ORDER BY ep.created_at
    """), {"tid": current_user.tenant_id})).mappings().all()
    return [dict(r) for r in rows]


@router.get("/history")
async def payment_history(
    status: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
):
    cond = "ep.tenant_id = :tid"
    params: dict = {"tid": current_user.tenant_id, "limit": limit, "offset": offset}
    if status:
        cond += " AND ep.status = :status"
        params["status"] = status.upper()
    rows = (await db.execute(text(f"""
        SELECT ep.*,
               CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
               eba.account_number, eba.bank_name
        FROM expense_payments ep
        LEFT JOIN employees e ON e.id = ep.employee_id
        LEFT JOIN employee_bank_accounts eba ON eba.id = ep.bank_account_id
        WHERE {cond}
        ORDER BY ep.updated_at DESC
        LIMIT :limit OFFSET :offset
    """), params)).mappings().all()
    return [dict(r) for r in rows]


@router.get("/queueable")
async def list_queueable(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
):
    """List APPROVED expense reports not yet in the payment queue.

    Finance managers use this to manually add a report that was approved
    before payment was configured, or when auto-queuing silently failed.
    """
    rows = (await db.execute(text("""
        SELECT er.id, er.report_number, er.report_date, er.total_amount, er.currency,
               CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
               er.employee_id,
               eba.id AS bank_account_id, eba.bank_name, eba.account_number
        FROM expense_reports er
        LEFT JOIN employees e ON e.id = er.employee_id
        LEFT JOIN employee_bank_accounts eba
               ON eba.employee_id = er.employee_id
              AND eba.tenant_id = :tid
              AND eba.is_primary = true
        WHERE er.tenant_id = :tid
          AND er.status = 'APPROVED'
          AND NOT EXISTS (
              SELECT 1 FROM expense_payments ep
              WHERE ep.expense_report_id = er.id
                AND ep.tenant_id = :tid
                AND ep.status NOT IN ('CANCELLED', 'FAILED')
          )
        ORDER BY er.report_date DESC
        LIMIT 100
    """), {"tid": current_user.tenant_id})).mappings().all()
    return [dict(r) for r in rows]


@router.post("/queue", status_code=201)
async def queue_payment(
    body: QueueBody,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
):
    """Add an approved expense report to the payment queue."""
    # Validate the report exists and is APPROVED
    rpt = (await db.execute(text(
        "SELECT status FROM expense_reports WHERE id = :rid AND tenant_id = :tid"
    ), {"rid": body.expense_report_id, "tid": current_user.tenant_id})).first()
    if not rpt:
        raise HTTPException(status_code=404, detail="Expense report not found")
    if rpt.status != "APPROVED":
        raise HTTPException(status_code=422, detail="Only APPROVED expense reports can be queued for payment")

    # Prevent duplicate queuing
    existing = (await db.execute(text("""
        SELECT id FROM expense_payments
        WHERE expense_report_id = :rid AND tenant_id = :tid AND status NOT IN ('CANCELLED', 'FAILED')
    """), {"rid": body.expense_report_id, "tid": current_user.tenant_id})).first()
    if existing:
        raise HTTPException(status_code=409, detail="This expense report is already in the payment queue")

    pid = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO expense_payments
          (id, tenant_id, expense_report_id, employee_id, bank_account_id,
           amount, currency, status, initiated_by)
        VALUES
          (:id, :tid, :rid, :emp_id, :ba_id, :amt, :currency, 'QUEUED', :user_id)
    """), {
        "id": pid, "tid": current_user.tenant_id,
        "rid": body.expense_report_id, "emp_id": body.employee_id,
        "ba_id": body.bank_account_id, "amt": float(body.amount),
        "currency": body.currency, "user_id": current_user.user_id,
    })
    await db.commit()
    return {"id": pid}


@router.post("/{payment_id}/initiate")
async def initiate_payment(
    payment_id: str,
    body: InitiateManualBody,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
):
    """Initiate payment. MANUAL: mark paid. PAYSTACK: call Transfers API."""
    payment = await _get_payment(payment_id, current_user.tenant_id, db)
    if payment["status"] not in ("QUEUED",):
        raise HTTPException(status_code=422, detail=f"Cannot initiate a payment in {payment['status']} status")

    config = await _get_tenant_config(current_user.tenant_id, db)
    mode = config["payment_mode"] if config else "MANUAL"

    if mode == "MANUAL":
        await db.execute(text("""
            UPDATE expense_payments SET
              status = 'PAID',
              payment_date = :pdate,
              payment_reference = :pref,
              payment_notes = :pnotes,
              approved_by = :user_id,
              updated_at = NOW()
            WHERE id = :id AND tenant_id = :tid
        """), {
            "pdate": body.payment_date, "pref": body.payment_reference,
            "pnotes": body.payment_notes, "user_id": current_user.user_id,
            "id": payment_id, "tid": current_user.tenant_id,
        })
        await db.commit()
        return {"status": "PAID"}

    elif mode == "PAYSTACK":
        # Load and decrypt secret key
        if not config or not config["paystack_secret_key_encrypted"]:
            raise HTTPException(status_code=503, detail="Payment service is temporarily unavailable. Please try again later.")
        secret_key = _decrypt_key(config["paystack_secret_key_encrypted"])
        if not secret_key:
            raise HTTPException(status_code=503, detail="Payment service is temporarily unavailable. Please try again later.")

        # We need a recipient code — fetch from bank_account
        bank_account = None
        if payment["bank_account_id"]:
            ba_row = (await db.execute(
                text("SELECT * FROM employee_bank_accounts WHERE id = :id AND tenant_id = :tid"),
                {"id": payment["bank_account_id"], "tid": current_user.tenant_id},
            )).mappings().first()
            if ba_row:
                bank_account = dict(ba_row)

        if not bank_account:
            raise HTTPException(status_code=422, detail="Bank account required for automated transfer. Please register the employee's bank account first.")

        ps = PaystackService(secret_key)

        # Create or reuse recipient
        recipient_code = bank_account.get("paystack_recipient_code")
        if not recipient_code:
            if not bank_account.get("bank_code"):
                raise HTTPException(status_code=422, detail="Bank code required. Please update the employee's bank account with the bank code.")
            recipient_code = await ps.create_recipient(
                account_name=bank_account["account_name"],
                account_number=bank_account["account_number"],
                bank_code=bank_account["bank_code"],
                currency=bank_account.get("currency", "NGN"),
            )
            await db.execute(text("""
                UPDATE employee_bank_accounts SET paystack_recipient_code = :rc WHERE id = :id
            """), {"rc": recipient_code, "id": bank_account["id"]})

        # Generate unique reference
        ref = f"PRAD-{payment_id[:8].upper()}-{uuid.uuid4().hex[:6].upper()}"
        amount_kobo = int(Decimal(str(payment["amount"])) * 100)

        # Mark as PROCESSING before API call (idempotent if webhook arrives fast)
        await db.execute(text("""
            UPDATE expense_payments SET status = 'PROCESSING', paystack_reference = :ref, updated_at = NOW()
            WHERE id = :id AND tenant_id = :tid
        """), {"ref": ref, "id": payment_id, "tid": current_user.tenant_id})
        await db.commit()

        # Initiate transfer
        result = await ps.initiate_transfer(
            amount_kobo=amount_kobo,
            recipient_code=recipient_code,
            reference=ref,
            reason="Expense reimbursement",
        )

        # Update with transfer_code from API response
        await db.execute(text("""
            UPDATE expense_payments SET
              paystack_transfer_code = :tc,
              updated_at = NOW()
            WHERE id = :id AND tenant_id = :tid
        """), {"tc": result["transfer_code"], "id": payment_id, "tid": current_user.tenant_id})
        await db.commit()
        return {"status": "PROCESSING", "transfer_code": result["transfer_code"]}

    raise HTTPException(status_code=400, detail="Unknown payment mode")


@router.post("/{payment_id}/cancel")
async def cancel_payment(
    payment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
):
    payment = await _get_payment(payment_id, current_user.tenant_id, db)
    if payment["status"] not in ("QUEUED",):
        raise HTTPException(status_code=422, detail=f"Cannot cancel a payment in {payment['status']} status")
    await db.execute(text("""
        UPDATE expense_payments SET status = 'CANCELLED', updated_at = NOW()
        WHERE id = :id AND tenant_id = :tid
    """), {"id": payment_id, "tid": current_user.tenant_id})
    await db.commit()
    return {"status": "CANCELLED"}


# ── Config ─────────────────────────────────────────────────────────────────────

@router.get("/config")
async def get_config(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
):
    config = await _get_tenant_config(current_user.tenant_id, db)
    if not config:
        return {"payment_mode": "MANUAL", "is_active": True, "has_paystack_key": False}
    # Never return raw/encrypted keys
    return {
        "id": config["id"],
        "payment_mode": config["payment_mode"],
        "is_active": config["is_active"],
        "has_paystack_key": bool(config.get("paystack_secret_key_encrypted")),
        "paystack_subaccount": config.get("paystack_subaccount"),
    }


@router.post("/config")
async def upsert_config(
    body: ConfigUpsertBody,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
):
    if body.payment_mode not in ("MANUAL", "PAYSTACK"):
        raise HTTPException(status_code=422, detail="payment_mode must be MANUAL or PAYSTACK")
    if body.payment_mode == "PAYSTACK" and not body.paystack_secret_key:
        raise HTTPException(status_code=422, detail="Paystack secret key required when enabling Paystack mode")

    existing = await _get_tenant_config(current_user.tenant_id, db)
    enc_secret = _encrypt_key(body.paystack_secret_key) if body.paystack_secret_key else (existing or {}).get("paystack_secret_key_encrypted")
    enc_public = _encrypt_key(body.paystack_public_key) if body.paystack_public_key else (existing or {}).get("paystack_public_key_encrypted")

    if existing:
        await db.execute(text("""
            UPDATE expense_payment_configs SET
              payment_mode = :mode,
              paystack_secret_key_encrypted = :enc_s,
              paystack_public_key_encrypted = :enc_p,
              updated_at = NOW()
            WHERE tenant_id = :tid
        """), {"mode": body.payment_mode, "enc_s": enc_secret, "enc_p": enc_public, "tid": current_user.tenant_id})
    else:
        await db.execute(text("""
            INSERT INTO expense_payment_configs
              (id, tenant_id, payment_mode, paystack_secret_key_encrypted, paystack_public_key_encrypted, created_by)
            VALUES
              (:id, :tid, :mode, :enc_s, :enc_p, :user_id)
        """), {
            "id": str(uuid.uuid4()), "tid": current_user.tenant_id,
            "mode": body.payment_mode, "enc_s": enc_secret, "enc_p": enc_public,
            "user_id": current_user.user_id,
        })
    await db.commit()
    return {"ok": True}


# ── Bank accounts ─────────────────────────────────────────────────────────────

@router.get("/bank-accounts")
async def list_bank_accounts(
    employee_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
):
    cond = "eba.tenant_id = :tid"
    params: dict = {"tid": current_user.tenant_id}
    if employee_id:
        cond += " AND eba.employee_id = :emp_id"
        params["emp_id"] = employee_id
    rows = (await db.execute(text(f"""
        SELECT eba.*,
               CONCAT(e.first_name, ' ', e.last_name) AS employee_name
        FROM employee_bank_accounts eba
        LEFT JOIN employees e ON e.id = eba.employee_id
        WHERE {cond}
        ORDER BY eba.is_primary DESC, eba.created_at
    """), params)).mappings().all()
    return [dict(r) for r in rows]


@router.post("/bank-accounts", status_code=201)
async def create_bank_account(
    body: BankAccountCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
):
    # If is_primary, demote existing primary for this employee
    if body.is_primary:
        await db.execute(text("""
            UPDATE employee_bank_accounts SET is_primary = false
            WHERE employee_id = :emp_id AND tenant_id = :tid
        """), {"emp_id": body.employee_id, "tid": current_user.tenant_id})

    ba_id = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO employee_bank_accounts
          (id, tenant_id, employee_id, bank_name, bank_code, account_number,
           account_name, currency, is_primary, created_by)
        VALUES
          (:id, :tid, :emp_id, :bank_name, :bank_code, :acc_no,
           :acc_name, :currency, :is_primary, :user_id)
    """), {
        "id": ba_id, "tid": current_user.tenant_id, "emp_id": body.employee_id,
        "bank_name": body.bank_name, "bank_code": body.bank_code,
        "acc_no": body.account_number, "acc_name": body.account_name,
        "currency": body.currency, "is_primary": body.is_primary,
        "user_id": current_user.user_id,
    })
    await db.commit()
    return {"id": ba_id}


@router.delete("/bank-accounts/{ba_id}", status_code=204)
async def delete_bank_account(
    ba_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
):
    """Remove a bank account. Blocked when an active (QUEUED/PROCESSING) payment references it."""
    active = (await db.execute(text("""
        SELECT id FROM expense_payments
        WHERE bank_account_id = :ba_id AND tenant_id = :tid
        AND status IN ('QUEUED', 'PROCESSING')
        LIMIT 1
    """), {"ba_id": ba_id, "tid": current_user.tenant_id})).first()
    if active:
        raise HTTPException(
            status_code=409,
            detail="This bank account has pending payments and cannot be removed. Cancel the payments first.",
        )
    await db.execute(text("""
        DELETE FROM employee_bank_accounts WHERE id = :id AND tenant_id = :tid
    """), {"id": ba_id, "tid": current_user.tenant_id})
    await db.commit()


# ── Paystack bank list (proxy) ────────────────────────────────────────────────

@router.get("/banks")
async def list_banks(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
):
    config = await _get_tenant_config(current_user.tenant_id, db)
    if not config or config["payment_mode"] != "PAYSTACK":
        return []
    secret_key = _decrypt_key(config.get("paystack_secret_key_encrypted"))
    if not secret_key:
        return []
    ps = PaystackService(secret_key)
    return await ps.list_banks()


# ── Paystack webhook (public — no JWT) ────────────────────────────────────────

@router.post("/webhook", include_in_schema=False)
async def paystack_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_paystack_signature: Optional[str] = Header(default=None),
):
    """Receives Paystack transfer.success / transfer.failed events.

    Security: signature verified against EACH tenant's secret key. If no
    matching tenant is found or signature fails, we return 200 silently
    (to prevent enumeration) but do not process the event.
    """
    raw_body = await request.body()
    try:
        payload = json.loads(raw_body)
    except Exception:
        return {"ok": True}  # silent ignore

    event = payload.get("event", "")
    transfer_data = payload.get("data", {})
    reference = transfer_data.get("reference")
    transfer_code = transfer_data.get("transfer_code")

    if not reference or event not in ("transfer.success", "transfer.failed", "transfer.reversed"):
        return {"ok": True}

    # Find the payment by reference (unique)
    row = (await db.execute(text("""
        SELECT ep.id, ep.tenant_id FROM expense_payments ep WHERE ep.paystack_reference = :ref
    """), {"ref": reference})).first()
    if not row:
        return {"ok": True}

    payment_id, tenant_id = row

    # Verify signature against this tenant's Paystack key.
    # Security rule: if the tenant has PAYSTACK configured, the signature header
    # is MANDATORY — an absent header is treated identically to a failed signature.
    # There is no code path that skips verification when PAYSTACK is configured.
    config = await _get_tenant_config(tenant_id, db)
    if config and config.get("paystack_secret_key_encrypted"):
        # Tenant is Paystack-configured — signature is non-negotiable.
        if not x_paystack_signature:
            return {"ok": True}  # missing header — reject silently
        secret_key = _decrypt_key(config["paystack_secret_key_encrypted"])
        if not secret_key or not PaystackService.verify_webhook(raw_body, x_paystack_signature, secret_key):
            return {"ok": True}  # invalid sig — reject silently

    new_status = "PAID" if event == "transfer.success" else "FAILED"
    failure_reason = transfer_data.get("reason") if new_status == "FAILED" else None

    await db.execute(text("""
        UPDATE expense_payments SET
          status = :status,
          paystack_response = :raw,
          failure_reason = :failure,
          payment_date = CASE WHEN :status = 'PAID' THEN NOW() ELSE payment_date END,
          updated_at = NOW()
        WHERE id = :id AND tenant_id = :tid
    """), {
        "status": new_status,
        "raw": json.dumps(transfer_data),
        "failure": failure_reason,
        "id": payment_id,
        "tid": tenant_id,
    })
    await db.commit()
    return {"ok": True}
