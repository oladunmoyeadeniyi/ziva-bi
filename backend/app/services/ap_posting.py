"""
AP posting service — M11.

Handles GL journal creation and posting_batch creation for AP invoices.
Called by the AP router on invoice APPROVE and on PAYMENT recording.

Three-mode routing:
  Lite      → no-op (workflow only)
  Connected → create PostingBatch entry on approval
  Full ERP  → create JournalEntry on approval + payment

Journal entry structure (Full ERP):
  On APPROVAL:
    DR  <expense GL per line>   line.amount_base   (one DR per line)
    CR  accounts_payable        invoice.net_payable (control account)
    (If VAT present, additional CR to vat_input_account)

  On PAYMENT:
    DR  accounts_payable        invoice.net_payable
    CR  <bank GL account>       invoice.net_payable
"""

import uuid
from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy import extract, func as sqlfunc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account_mapping import TenantAccountMapping
from app.models.ap import ApInvoice
from app.models.bank_account import BankAccount
from app.models.gl import PostingBatch
from app.schemas.gl import JournalLineInput
from app.services.gl_posting import PostingError, post_journal


_AP_CONTROL_ROLE = "accounts_payable"


async def _get_control_gl(db: AsyncSession, tenant_id: uuid.UUID, role_key: str) -> uuid.UUID:
    """
    Return the GL account UUID mapped to a posting role for a tenant.

    Raises PostingError if the role is not mapped (tenant hasn't configured
    account mapping for this role).
    """
    result = await db.execute(
        select(TenantAccountMapping.gl_account_id).where(
            TenantAccountMapping.tenant_id == tenant_id,
            TenantAccountMapping.role_key == role_key,
        )
    )
    gl_id = result.scalar_one_or_none()
    if gl_id is None:
        raise PostingError(
            "MISSING_ACCOUNT_MAPPING",
            f"No GL account mapped to posting role '{role_key}' for this tenant. "
            f"Configure it in Setup → Account Mapping before approving AP invoices.",
        )
    return gl_id


async def post_ap_approval(
    db: AsyncSession,
    invoice: ApInvoice,
    created_by: Optional[uuid.UUID] = None,
) -> None:
    """
    Create the GL journal entry for an approved AP invoice (Full ERP only).

    Journal:
      DR  <expense GL per line>   line.amount_base   (one per line)
      CR  accounts_payable        invoice.net_payable (control account)

    Sets invoice.journal_entry_id. Caller must commit.

    Parameters:
        db         — async DB session.
        invoice    — the ApInvoice ORM object (lines must be loaded).
        created_by — user who approved.

    Raises:
        PostingError — if accounts_payable is not mapped, or GL is invalid.
    """
    if invoice.posting_mode != "full_erp":
        return

    tenant_id = invoice.tenant_id
    ap_gl_id = await _get_control_gl(db, tenant_id, _AP_CONTROL_ROLE)

    lines: list[JournalLineInput] = []

    # DR lines — one per invoice line
    for line in invoice.lines:
        if not line.gl_account_id:
            raise PostingError(
                "MISSING_GL_ON_LINE",
                f"Invoice line {line.line_number} ('{line.description}') has no GL account. "
                "All lines must have a GL account before an AP invoice can be approved in Full ERP mode.",
            )
        lines.append(JournalLineInput(
            gl_account_id=line.gl_account_id,
            debit=line.amount_base,
            credit=Decimal("0"),
            description=line.description,
            dimensions={str(k): str(v) for k, v in (line.dimension_values or {}).items()},
        ))

    # CR line — accounts_payable control account
    lines.append(JournalLineInput(
        gl_account_id=ap_gl_id,
        debit=Decimal("0"),
        credit=invoice.net_payable,
        description=f"AP: {invoice.reference}",
    ))

    entry = await post_journal(
        db,
        tenant_id,
        entry_date=invoice.invoice_date,
        description=f"AP Invoice — {invoice.reference} ({invoice.vendor_id})",
        source="ap",
        source_reference=invoice.reference,
        lines=lines,
        created_by=created_by,
        module="ap",
    )
    invoice.journal_entry_id = entry.id


async def post_ap_payment(
    db: AsyncSession,
    invoice: ApInvoice,
    payment_date: date,
    bank_account_id: Optional[uuid.UUID],
    created_by: Optional[uuid.UUID] = None,
) -> None:
    """
    Create the GL payment journal for a paid AP invoice (Full ERP only).

    Journal:
      DR  accounts_payable      invoice.net_payable
      CR  <bank GL account>     invoice.net_payable

    Sets invoice.payment_journal_entry_id. Caller must commit.

    Raises:
        PostingError — if accounts_payable not mapped, or bank account has no GL.
    """
    if invoice.posting_mode != "full_erp":
        return

    tenant_id = invoice.tenant_id
    ap_gl_id = await _get_control_gl(db, tenant_id, _AP_CONTROL_ROLE)

    # Get bank GL account
    bank_gl_id: Optional[uuid.UUID] = None
    if bank_account_id:
        result = await db.execute(
            select(BankAccount.gl_account_id).where(
                BankAccount.id == bank_account_id,
                BankAccount.tenant_id == tenant_id,
            )
        )
        bank_gl_id = result.scalar_one_or_none()

    if not bank_gl_id:
        raise PostingError(
            "MISSING_BANK_GL",
            "The selected bank account has no GL account mapped. "
            "Configure it in Setup → Bank Accounts before recording payment.",
        )

    lines = [
        JournalLineInput(
            gl_account_id=ap_gl_id,
            debit=invoice.net_payable,
            credit=Decimal("0"),
            description=f"PMT: {invoice.reference}",
        ),
        JournalLineInput(
            gl_account_id=bank_gl_id,
            debit=Decimal("0"),
            credit=invoice.net_payable,
            description=f"PMT: {invoice.reference}",
            bank_account_id=bank_account_id,
        ),
    ]

    entry = await post_journal(
        db,
        tenant_id,
        entry_date=payment_date,
        description=f"AP Payment — {invoice.reference}",
        source="ap",
        source_reference=f"PMT-{invoice.reference}",
        lines=lines,
        created_by=created_by,
        module="ap",
    )
    invoice.payment_journal_entry_id = entry.id


async def _next_ap_batch_ref(db: AsyncSession, tenant_id: uuid.UUID, invoice_date: date) -> str:
    """Generate BATCH-{YYYY}-{MM}-{NNN} reference for a new AP posting batch."""
    year = invoice_date.year
    month = invoice_date.month
    result = await db.execute(
        select(sqlfunc.count(PostingBatch.id)).where(
            PostingBatch.tenant_id == tenant_id,
            extract("year", PostingBatch.created_at) == year,
            extract("month", PostingBatch.created_at) == month,
        )
    )
    count: int = result.scalar_one()
    return f"BATCH-{year}-{month:02d}-{count + 1:03d}"


async def create_ap_posting_batch(
    db: AsyncSession,
    invoice: ApInvoice,
) -> None:
    """
    Create a posting_batches entry for a Connected-mode approved AP invoice.

    Serialises the full invoice + lines as a balanced transaction so the
    external ERP can import it directly. Sets invoice.posting_batch_id.
    Caller must commit.
    """
    if invoice.posting_mode != "connected":
        return

    transaction_lines = []
    for ln in invoice.lines:
        transaction_lines.append({
            "gl_account_id": str(ln.gl_account_id) if ln.gl_account_id else None,
            "debit": float(ln.amount_base),
            "credit": 0.0,
            "description": f"{invoice.reference} / Line {ln.line_number}: {ln.description}",
            "dimensions": ln.dimension_values or {},
            "vat_amount": float(ln.vat_amount),
            "wht_amount": float(ln.wht_amount),
        })

    # CR entry — AP control account placeholder (no GL id in Connected mode;
    # the external ERP maps it using role_key = 'accounts_payable')
    transaction_lines.append({
        "gl_account_id": None,
        "posting_role": "accounts_payable",
        "debit": 0.0,
        "credit": float(invoice.net_payable),
        "description": f"Accounts payable — {invoice.reference}",
        "dimensions": {},
    })

    batch_ref = await _next_ap_batch_ref(db, invoice.tenant_id, invoice.invoice_date)

    batch = PostingBatch(
        tenant_id=invoice.tenant_id,
        batch_ref=batch_ref,
        module="ap",
        status="pending",
        transactions=[{
            "entry_date": invoice.invoice_date.isoformat(),
            "description": f"AP Invoice — {invoice.reference}",
            "source_module": "ap",
            "source_id": str(invoice.id),
            "lines": transaction_lines,
        }],
    )
    db.add(batch)
    await db.flush()
    invoice.posting_batch_id = batch.id
