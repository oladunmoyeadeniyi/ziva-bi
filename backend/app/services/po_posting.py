"""
PO / GRN posting service — M11b.

Handles GL journal creation and posting_batch creation for:
  1. GRN confirmation  — GRNI accrual (DR expense / asset GL, CR grni)
  2. PO approval       — Commitment journal (DR po_commitment, CR po_commitment — memo, default OFF)
  3. Invoice-match clearance — GRNI reversal on invoice approval (DR grni, CR accounts_payable)
     NOTE: GRNI clearance is triggered from ap_posting.py when the invoice is approved after
     matching. This service only writes the GRNI accrual side on GRN confirm.

Three-mode routing:
  Lite      → no-op for all GL actions (workflow only)
  Connected → create PostingBatch entry
  Full ERP  → create JournalEntry

Journal entry (Full ERP — GRN confirmation):
  For each GRN line:
    DR  <expense/asset GL from po_line.gl_account_id>  grn_line.amount_base
  CR  grni (control account, role_key="grni")           total amount_base of GRN

Journal entry (Full ERP — GRNI clearance on invoice approval after 3-way match):
  Called from this service as `post_grni_clearance()`:
    DR  grni                                 matched_amount_base
    CR  accounts_payable (control account)   matched_amount_base

The commitment journal (PO approval) is off by default. It is only triggered if
tenant config has commitment accounting enabled — this config is not yet implemented
and will be added in a future sprint. The function stub is provided for completeness.
"""

import uuid
from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account_mapping import TenantAccountMapping
from app.models.gl import PostingBatch
from app.models.po import GoodsReceiptNote
from app.schemas.gl import JournalLineInput
from app.services.ap_posting import _get_control_gl
from app.services.gl_posting import PostingError, post_journal


_GRNI_ROLE = "grni"
_AP_CONTROL_ROLE = "accounts_payable"


async def post_grni_accrual(
    db: AsyncSession,
    grn: GoodsReceiptNote,
    created_by: Optional[uuid.UUID] = None,
) -> None:
    """
    Post the GRNI accrual journal when a GRN is confirmed (Full ERP only).

    Journal:
      For each GRN line with a GL account on the PO line:
        DR  <po_line.gl_account_id>  grn_line.amount_base
      CR  grni (control account)     sum(grn_line.amount_base)

    Sets grn.grni_journal_entry_id. Caller must commit.

    Parameters:
        db         — async DB session (grn.lines and their po_lines must be loaded)
        grn        — confirmed GoodsReceiptNote ORM object
        created_by — user who confirmed the GRN

    Raises:
        PostingError — if grni account is not mapped, or any PO line lacks a GL account
    """
    # Determine posting_mode from PO (which has it snapshotted at approval time)
    po = grn.po
    if not po or po.posting_mode != "full_erp":
        return

    tenant_id = grn.tenant_id
    grni_gl_id = await _get_control_gl(db, tenant_id, _GRNI_ROLE)

    total_amount = Decimal("0")
    dr_lines: list[JournalLineInput] = []

    for gl in grn.lines:
        po_line = gl.po_line
        if not po_line or not po_line.gl_account_id:
            raise PostingError(
                "MISSING_GL_ON_PO_LINE",
                f"GRN line {gl.line_number} ('{gl.description}') references a PO line "
                "with no GL account. Assign a GL account to the PO line before confirming "
                "this GRN in Full ERP mode.",
            )
        dr_lines.append(JournalLineInput(
            gl_account_id=po_line.gl_account_id,
            debit=gl.amount_base,
            credit=Decimal("0"),
            description=f"GRNI: {grn.grn_number} / {gl.description}",
            dimensions={str(k): str(v) for k, v in (po_line.dimension_values or {}).items()},
        ))
        total_amount += gl.amount_base

    if total_amount == Decimal("0"):
        return  # Nothing to post (all zero quantities)

    # CR line — GRNI control account
    cr_line = JournalLineInput(
        gl_account_id=grni_gl_id,
        debit=Decimal("0"),
        credit=total_amount,
        description=f"GRNI accrual: {grn.grn_number}",
    )

    all_lines = dr_lines + [cr_line]

    entry = await post_journal(
        db,
        tenant_id,
        entry_date=grn.receipt_date,
        description=f"GRNI Accrual — GRN {grn.grn_number} (PO {po.po_number})",
        source="grn",
        source_reference=grn.grn_number,
        lines=all_lines,
        created_by=created_by,
        module="po",
    )
    grn.grni_journal_entry_id = entry.id


async def post_grni_clearance(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    invoice_reference: str,
    invoice_date: date,
    matched_amount_base: Decimal,
    created_by: Optional[uuid.UUID] = None,
) -> uuid.UUID:
    """
    Post the GRNI clearance journal when a matched invoice is approved (Full ERP only).

    Called from ap_posting.post_ap_approval() after a 3-way match is confirmed.
    Reverses the GRNI accrual by swapping DR/CR:

    Journal:
      DR  grni              matched_amount_base
      CR  accounts_payable  matched_amount_base

    Returns the journal_entry.id for the caller to link to the invoice.

    Parameters:
        db                  — async DB session
        tenant_id           — tenant UUID
        invoice_reference   — AP invoice reference (for description)
        invoice_date        — date for the journal entry
        matched_amount_base — total matched base amount across all match records
        created_by          — user who approved the invoice

    Raises:
        PostingError — if grni or accounts_payable not mapped
    """
    grni_gl_id = await _get_control_gl(db, tenant_id, _GRNI_ROLE)
    ap_gl_id = await _get_control_gl(db, tenant_id, _AP_CONTROL_ROLE)

    lines = [
        JournalLineInput(
            gl_account_id=grni_gl_id,
            debit=matched_amount_base,
            credit=Decimal("0"),
            description=f"GRNI clearance: {invoice_reference}",
        ),
        JournalLineInput(
            gl_account_id=ap_gl_id,
            debit=Decimal("0"),
            credit=matched_amount_base,
            description=f"AP liability: {invoice_reference}",
        ),
    ]

    entry = await post_journal(
        db,
        tenant_id,
        entry_date=invoice_date,
        description=f"GRNI Clearance — Invoice {invoice_reference}",
        source="ap",
        source_reference=f"GRNI-CLR-{invoice_reference}",
        lines=lines,
        created_by=created_by,
        module="po",
    )
    return entry.id


async def create_grni_posting_batch(
    db: AsyncSession,
    grn: GoodsReceiptNote,
) -> None:
    """
    Create a posting_batches entry for a Connected-mode confirmed GRN.

    Sets grn.grni_posting_batch_id. Caller must commit.
    The batch encodes the GRNI accrual so the external ERP can import it.
    """
    po = grn.po
    if not po or po.posting_mode != "connected":
        return

    transaction_lines = []
    total_amount = Decimal("0")

    for gl in grn.lines:
        po_line = gl.po_line
        transaction_lines.append({
            "gl_account_id": str(po_line.gl_account_id) if po_line and po_line.gl_account_id else None,
            "debit": float(gl.amount_base),
            "credit": 0.0,
            "description": f"GRNI {grn.grn_number} / {gl.description}",
            "dimensions": (po_line.dimension_values or {}) if po_line else {},
        })
        total_amount += gl.amount_base

    transaction_lines.append({
        "gl_account_id": None,
        "posting_role": _GRNI_ROLE,
        "debit": 0.0,
        "credit": float(total_amount),
        "description": f"GRNI accrual: {grn.grn_number}",
        "dimensions": {},
    })

    # Generate batch reference
    from sqlalchemy import extract, func as sqlfunc
    result = await db.execute(
        select(sqlfunc.count(PostingBatch.id)).where(
            PostingBatch.tenant_id == grn.tenant_id,
        )
    )
    count: int = result.scalar_one()
    batch_ref = f"GRNI-{grn.receipt_date.year}-{count + 1:04d}"

    batch = PostingBatch(
        tenant_id=grn.tenant_id,
        batch_ref=batch_ref,
        module="po",
        status="pending",
        transactions=[{
            "entry_date": grn.receipt_date.isoformat(),
            "description": f"GRNI Accrual — GRN {grn.grn_number}",
            "source_module": "grn",
            "source_id": str(grn.id),
            "lines": transaction_lines,
        }],
    )
    db.add(batch)
    await db.flush()
    grn.grni_posting_batch_id = batch.id
