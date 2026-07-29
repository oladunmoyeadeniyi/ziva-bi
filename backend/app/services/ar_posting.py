"""
AR posting service — M14.

Handles GL journal creation and posting_batch creation for AR invoices.
Called by the AR router on invoice APPROVE and on RECEIPT recording.

Three-mode routing:
  Lite      → no-op (workflow only)
  Connected → create PostingBatch entry on approval
  Full ERP  → create JournalEntry on approval + receipt

Journal entry structure (Full ERP):
  On APPROVAL:
    DR  accounts_receivable   invoice.net_receivable (control account — BS asset)
    CR  <revenue GL per line>  line.amount_base      (one CR per line)

  On RECEIPT (customer pays):
    DR  <bank GL account>      invoice.net_receivable
    CR  accounts_receivable    invoice.net_receivable
"""

import uuid
from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy import extract, func as sqlfunc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account_mapping import TenantAccountMapping
from app.models.ar import ArInvoice
from app.models.bank_account import BankAccount
from app.models.gl import PostingBatch
from app.schemas.gl import JournalLineInput
from app.services.gl_posting import PostingError, post_journal


_AR_CONTROL_ROLE = "accounts_receivable"


async def _get_control_gl(db: AsyncSession, tenant_id: uuid.UUID, role_key: str) -> uuid.UUID:
    """
    Return the GL account UUID mapped to a posting role for a tenant.

    Raises PostingError if the role is not mapped (tenant hasn't configured
    account mapping for this role).

    Parameters:
        db         — async DB session.
        tenant_id  — current tenant.
        role_key   — key from posting_roles catalogue (e.g. 'accounts_receivable').

    Returns:
        UUID of the GL account mapped to this role.
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
            "Configure it in Setup → Account Mapping before approving AR invoices.",
        )
    return gl_id


async def post_ar_approval(
    db: AsyncSession,
    invoice: ArInvoice,
    created_by: Optional[uuid.UUID] = None,
) -> None:
    """
    Create the GL journal entry for an approved AR invoice (Full ERP only).

    Journal:
      DR  accounts_receivable   invoice.net_receivable  (control account)
      CR  <revenue GL per line>  line.amount_base       (one per line)

    Sets invoice.journal_entry_id. Caller must commit.

    Parameters:
        db         — async DB session.
        invoice    — the ArInvoice ORM object (lines must be loaded).
        created_by — UUID of the user who approved.

    Raises:
        PostingError — if accounts_receivable is not mapped, or a line has no GL.
    """
    if invoice.posting_mode != "full_erp":
        return

    tenant_id = invoice.tenant_id
    ar_gl_id = await _get_control_gl(db, tenant_id, _AR_CONTROL_ROLE)

    lines: list[JournalLineInput] = []

    # DR line — accounts_receivable control account (total receivable including VAT)
    lines.append(JournalLineInput(
        gl_account_id=ar_gl_id,
        debit=invoice.net_receivable,
        credit=Decimal("0"),
        description=f"AR: {invoice.reference}",
    ))

    # CR lines — one per invoice line (revenue GL accounts)
    for line in invoice.lines:
        if not line.gl_account_id:
            raise PostingError(
                "MISSING_GL_ON_LINE",
                f"Invoice line {line.line_number} ('{line.description}') has no GL account. "
                "All lines must have a GL account before an AR invoice can be approved in Full ERP mode.",
            )
        lines.append(JournalLineInput(
            gl_account_id=line.gl_account_id,
            debit=Decimal("0"),
            credit=line.amount_base,
            description=line.description,
            dimensions={str(k): str(v) for k, v in (line.dimension_values or {}).items()},
        ))

    entry = await post_journal(
        db,
        tenant_id,
        entry_date=invoice.invoice_date,
        description=f"AR Invoice — {invoice.reference} ({invoice.customer_id})",
        source="ar",
        source_reference=invoice.reference,
        lines=lines,
        created_by=created_by,
        module="ar",
    )
    invoice.journal_entry_id = entry.id


async def post_ar_receipt(
    db: AsyncSession,
    invoice: ArInvoice,
    receipt_date: date,
    bank_account_id: Optional[uuid.UUID],
    created_by: Optional[uuid.UUID] = None,
) -> None:
    """
    Create the GL receipt journal for a received AR payment (Full ERP only).

    Journal:
      DR  <bank GL account>      invoice.net_receivable
      CR  accounts_receivable    invoice.net_receivable

    Sets invoice.receipt_journal_entry_id. Caller must commit.

    Parameters:
        db              — async DB session.
        invoice         — the ArInvoice ORM object.
        receipt_date    — date the payment was received.
        bank_account_id — bank account the money was received into.
        created_by      — UUID of the user recording the receipt.

    Raises:
        PostingError — if accounts_receivable or bank GL is not mapped.
    """
    if invoice.posting_mode != "full_erp":
        return

    tenant_id = invoice.tenant_id
    ar_gl_id = await _get_control_gl(db, tenant_id, _AR_CONTROL_ROLE)

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
            "Configure it in Setup → Bank Accounts before recording receipt.",
        )

    lines = [
        JournalLineInput(
            gl_account_id=bank_gl_id,
            debit=invoice.net_receivable,
            credit=Decimal("0"),
            description=f"RCT: {invoice.reference}",
            bank_account_id=bank_account_id,
        ),
        JournalLineInput(
            gl_account_id=ar_gl_id,
            debit=Decimal("0"),
            credit=invoice.net_receivable,
            description=f"RCT: {invoice.reference}",
        ),
    ]

    entry = await post_journal(
        db,
        tenant_id,
        entry_date=receipt_date,
        description=f"AR Receipt — {invoice.reference}",
        source="ar",
        source_reference=f"RCT-{invoice.reference}",
        lines=lines,
        created_by=created_by,
        module="ar",
    )
    invoice.receipt_journal_entry_id = entry.id


async def _next_ar_batch_ref(db: AsyncSession, tenant_id: uuid.UUID, invoice_date: date) -> str:
    """Generate BATCH-{YYYY}-{MM}-{NNN} reference for a new AR posting batch."""
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


async def create_ar_posting_batch(
    db: AsyncSession,
    invoice: ArInvoice,
) -> None:
    """
    Create a posting_batches entry for a Connected-mode approved AR invoice.

    Serialises the full invoice + lines as a balanced transaction so the
    external ERP can import it directly. Sets invoice.posting_batch_id.
    Caller must commit.

    Parameters:
        db      — async DB session.
        invoice — the ArInvoice ORM object (lines must be loaded).
    """
    if invoice.posting_mode != "connected":
        return

    transaction_lines = []

    # DR line — AR control account (posting_role placeholder for external ERP)
    transaction_lines.append({
        "gl_account_id": None,
        "posting_role": "accounts_receivable",
        "debit": float(invoice.net_receivable),
        "credit": 0.0,
        "description": f"Accounts receivable — {invoice.reference}",
        "dimensions": {},
    })

    # CR lines — revenue per invoice line
    for ln in invoice.lines:
        transaction_lines.append({
            "gl_account_id": str(ln.gl_account_id) if ln.gl_account_id else None,
            "debit": 0.0,
            "credit": float(ln.amount_base),
            "description": f"{invoice.reference} / Line {ln.line_number}: {ln.description}",
            "dimensions": ln.dimension_values or {},
            "vat_amount": float(ln.vat_amount),
            "wht_amount": float(ln.wht_amount),
        })

    batch_ref = await _next_ar_batch_ref(db, invoice.tenant_id, invoice.invoice_date)

    batch = PostingBatch(
        tenant_id=invoice.tenant_id,
        batch_ref=batch_ref,
        module="ar",
        status="pending",
        transactions=[{
            "entry_date": invoice.invoice_date.isoformat(),
            "description": f"AR Invoice — {invoice.reference}",
            "source_module": "ar",
            "source_id": str(invoice.id),
            "lines": transaction_lines,
        }],
    )
    db.add(batch)
    await db.flush()
    invoice.posting_batch_id = batch.id
