"""
Purchase Orders (PO) router — M11b.

PO lifecycle (DRAFT → SUBMITTED → APPROVED → SENT → PARTIALLY/FULLY_RECEIVED → CLOSED)
GRN lifecycle (DRAFT → CONFIRMED)
3-Way Match (invoice line ↔ GRN line junction records + variance engine)

Routes:
    Purchase Orders:
        GET    /api/po/                     — list POs (filterable by status/vendor)
        POST   /api/po/                     — create DRAFT PO
        GET    /api/po/{id}                 — PO detail (with lines + approvals)
        PUT    /api/po/{id}                 — update DRAFT PO
        DELETE /api/po/{id}                 — delete DRAFT PO
        POST   /api/po/{id}/submit          — submit for approval
        POST   /api/po/{id}/approve         — approver: approve
        POST   /api/po/{id}/reject          — approver: reject
        POST   /api/po/{id}/send            — mark as sent to vendor
        POST   /api/po/{id}/close           — close (manually)
        POST   /api/po/{id}/cancel          — cancel

    GRNs:
        GET    /api/po/{po_id}/grns         — list GRNs for a PO
        POST   /api/po/{po_id}/grns         — create DRAFT GRN
        GET    /api/po/grns/{grn_id}        — GRN detail
        POST   /api/po/grns/{grn_id}/confirm — confirm GRN (triggers GRNI journal)

    3-Way Match:
        POST   /api/po/matches              — record match records for an invoice
        GET    /api/po/matches/{invoice_id} — get all match records for an invoice
        PATCH  /api/po/matches/{match_id}/override — manual override of match status
        GET    /api/po/match-report         — match status summary across invoices
        GET    /api/po/tolerance            — get tolerance config
        PUT    /api/po/tolerance            — update tolerance config
"""

import logging
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.middleware.auth import require_auth, require_module
from app.models.ap import ApInvoice, ApInvoiceLine
from app.models.auth import UserTenant
from app.models.po import (
    ApInvoicePoMatch,
    GoodsReceiptNote,
    GrnLine,
    PoApproval,
    PoSnapshot,
    PoToleranceConfig,
    PurchaseOrder,
    PurchaseOrderLine,
)
from app.schemas.po import (
    GrnCreate,
    GrnDetail,
    GrnLineResponse,
    GrnResponse,
    MatchCreateBody,
    MatchOverrideBody,
    MatchReportRow,
    MatchResponse,
    PoActionBody,
    PoApprovalResponse,
    PoRejectBody,
    PoToleranceConfigResponse,
    PoToleranceConfigUpdate,
    PurchaseOrderCreate,
    PurchaseOrderDetail,
    PurchaseOrderLineResponse,
    PurchaseOrderResponse,
    PurchaseOrderUpdate,
)
from app.services.approval_routing import (
    ApprovalChainHoldError,
    ApprovalRoutingError,
    compute_chain,
    get_policy,
)
from app.services.po_match_engine import compute_match_status, invoice_payment_blocked
from app.services.po_posting import (
    create_grni_posting_batch,
    post_grni_accrual,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/po",
    tags=["Purchase Orders"],
    dependencies=[Depends(require_module("ap"))],  # PO is part of the AP (Procure-to-Pay) module
)


# ── Auth helpers ──────────────────────────────────────────────────────────────

def _tenant_id(user: UserTenant) -> uuid.UUID:
    tid = getattr(user, "tenant_id", None)
    if not tid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No tenant context.")
    return tid


# ── Reference sequence helpers ────────────────────────────────────────────────

async def _next_po_number(db: AsyncSession, tenant_id: uuid.UUID, po_date: date) -> str:
    """Generate PO-{YYYY}-{NNNN:04d} for this tenant+year."""
    year = po_date.year
    from sqlalchemy import extract
    result = await db.execute(
        select(func.count(PurchaseOrder.id)).where(
            PurchaseOrder.tenant_id == tenant_id,
            extract("year", PurchaseOrder.created_at) == year,
        )
    )
    n = result.scalar_one() or 0
    return f"PO-{year}-{n + 1:04d}"


async def _next_grn_number(db: AsyncSession, tenant_id: uuid.UUID, receipt_date: date) -> str:
    """Generate GRN-{YYYY}-{NNNN:04d} for this tenant+year."""
    year = receipt_date.year
    from sqlalchemy import extract
    result = await db.execute(
        select(func.count(GoodsReceiptNote.id)).where(
            GoodsReceiptNote.tenant_id == tenant_id,
            extract("year", GoodsReceiptNote.created_at) == year,
        )
    )
    n = result.scalar_one() or 0
    return f"GRN-{year}-{n + 1:04d}"


# ── Line computation ──────────────────────────────────────────────────────────

def _compute_po_line(line_in, exchange_rate: Decimal) -> dict:
    """Derive stored amounts from a PurchaseOrderLineIn."""
    amount_foreign = (line_in.quantity_ordered * line_in.unit_price).quantize(Decimal("0.01"))
    amount_base = (amount_foreign * exchange_rate).quantize(Decimal("0.01"))
    return {
        "line_number": line_in.line_number,
        "description": line_in.description,
        "unit_of_measure": line_in.unit_of_measure,
        "quantity_ordered": line_in.quantity_ordered,
        "unit_price": line_in.unit_price,
        "amount_foreign": amount_foreign,
        "amount_base": amount_base,
        "gl_account_id": line_in.gl_account_id,
        "dimension_values": line_in.dimension_values,
        "vat_applicable": line_in.vat_applicable,
        "vat_rate": line_in.vat_rate,
        "wht_applicable": line_in.wht_applicable,
        "wht_rate": line_in.wht_rate,
        "category_hint": line_in.category_hint,
    }


def _recompute_po_totals(po: PurchaseOrder) -> None:
    """Recalculate PO header totals from lines."""
    po.total_amount_foreign = sum(ln.amount_foreign for ln in po.lines)
    po.total_amount_base = sum(ln.amount_base for ln in po.lines)


# ── Snapshot helper ───────────────────────────────────────────────────────────

def _build_po_snapshot(po: PurchaseOrder) -> dict:
    return {
        "po_number": po.po_number,
        "vendor_id": str(po.vendor_id),
        "title": po.title,
        "currency": po.currency,
        "exchange_rate": str(po.exchange_rate),
        "total_amount_foreign": str(po.total_amount_foreign),
        "total_amount_base": str(po.total_amount_base),
        "delivery_date": po.delivery_date.isoformat() if po.delivery_date else None,
        "lines": [
            {
                "line_number": ln.line_number,
                "description": ln.description,
                "quantity_ordered": str(ln.quantity_ordered),
                "unit_price": str(ln.unit_price),
                "amount_base": str(ln.amount_base),
                "gl_account_id": str(ln.gl_account_id) if ln.gl_account_id else None,
            }
            for ln in po.lines
        ],
    }


# ── Reload helpers ────────────────────────────────────────────────────────────

async def _reload_po(po_id: uuid.UUID, db: AsyncSession) -> PurchaseOrder:
    result = await db.execute(
        select(PurchaseOrder)
        .options(
            selectinload(PurchaseOrder.lines),
            selectinload(PurchaseOrder.approvals),
            selectinload(PurchaseOrder.grns),
        )
        .where(PurchaseOrder.id == po_id)
    )
    po = result.scalar_one_or_none()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase Order not found.")
    return po


async def _reload_grn(grn_id: uuid.UUID, db: AsyncSession) -> GoodsReceiptNote:
    result = await db.execute(
        select(GoodsReceiptNote)
        .options(
            selectinload(GoodsReceiptNote.lines).selectinload(GrnLine.po_line),
            selectinload(GoodsReceiptNote.po).selectinload(PurchaseOrder.lines),
        )
        .where(GoodsReceiptNote.id == grn_id)
    )
    grn = result.scalar_one_or_none()
    if not grn:
        raise HTTPException(status_code=404, detail="GRN not found.")
    return grn


def _po_to_detail(po: PurchaseOrder) -> PurchaseOrderDetail:
    return PurchaseOrderDetail(
        **{
            field: getattr(po, field)
            for field in PurchaseOrderResponse.model_fields
        },
        requester_id=po.requester_id,
        department_id=po.department_id,
        delivery_address=po.delivery_address,
        exchange_rate=po.exchange_rate,
        notes=po.notes,
        posting_mode=po.posting_mode,
        submitted_by=po.submitted_by,
        approved_by=po.approved_by,
        rejected_at=po.rejected_at,
        rejected_by=po.rejected_by,
        rejection_reason=po.rejection_reason,
        sent_at=po.sent_at,
        closed_at=po.closed_at,
        cancelled_at=po.cancelled_at,
        journal_entry_id=po.journal_entry_id,
        posting_batch_id=po.posting_batch_id,
        updated_at=po.updated_at,
        lines=[PurchaseOrderLineResponse.model_validate(ln) for ln in po.lines],
        approvals=[PoApprovalResponse.model_validate(a) for a in po.approvals],
    )


async def _get_tolerance(db: AsyncSession, tenant_id: uuid.UUID) -> PoToleranceConfig:
    """Get or create (with defaults) the tolerance config for a tenant."""
    result = await db.execute(
        select(PoToleranceConfig).where(PoToleranceConfig.tenant_id == tenant_id)
    )
    cfg = result.scalar_one_or_none()
    if not cfg:
        cfg = PoToleranceConfig(tenant_id=tenant_id)
        db.add(cfg)
        await db.flush()
    return cfg


# ── PO endpoints ──────────────────────────────────────────────────────────────

@router.get("/", response_model=list[PurchaseOrderResponse])
async def list_pos(
    user: Annotated[UserTenant, Depends(require_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
    status_filter: Optional[str] = Query(None, alias="status"),
    vendor_id: Optional[uuid.UUID] = None,
    limit: int = Query(100, le=500),
    offset: int = 0,
) -> list[PurchaseOrderResponse]:
    """List Purchase Orders for the authenticated tenant."""
    tenant_id = _tenant_id(user)
    q = select(PurchaseOrder).where(PurchaseOrder.tenant_id == tenant_id)
    if status_filter:
        q = q.where(PurchaseOrder.status == status_filter)
    if vendor_id:
        q = q.where(PurchaseOrder.vendor_id == vendor_id)
    q = q.order_by(PurchaseOrder.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(q)
    return [PurchaseOrderResponse.model_validate(po) for po in result.scalars().all()]


@router.post("/", response_model=PurchaseOrderDetail, status_code=status.HTTP_201_CREATED)
async def create_po(
    body: PurchaseOrderCreate,
    user: Annotated[UserTenant, Depends(require_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PurchaseOrderDetail:
    """Create a new DRAFT Purchase Order."""
    tenant_id = _tenant_id(user)
    user_id = getattr(user, "user_id", None)
    today = date.today()
    po_number = await _next_po_number(db, tenant_id, today)

    po = PurchaseOrder(
        tenant_id=tenant_id,
        vendor_id=body.vendor_id,
        po_number=po_number,
        requester_id=user_id,
        department_id=body.department_id,
        title=body.title,
        delivery_date=body.delivery_date,
        delivery_address=body.delivery_address,
        currency=body.currency,
        exchange_rate=body.exchange_rate,
        notes=body.notes,
        status="DRAFT",
        created_by=user_id,
    )
    db.add(po)
    await db.flush()

    for line_in in body.lines:
        line_data = _compute_po_line(line_in, body.exchange_rate)
        db.add(PurchaseOrderLine(po_id=po.id, **line_data))

    await db.flush()
    po = await _reload_po(po.id, db)
    _recompute_po_totals(po)
    await db.commit()
    return _po_to_detail(await _reload_po(po.id, db))


@router.get("/{po_id}", response_model=PurchaseOrderDetail)
async def get_po(
    po_id: uuid.UUID,
    user: Annotated[UserTenant, Depends(require_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PurchaseOrderDetail:
    tenant_id = _tenant_id(user)
    po = await _reload_po(po_id, db)
    if po.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Purchase Order not found.")
    return _po_to_detail(po)


@router.put("/{po_id}", response_model=PurchaseOrderDetail)
async def update_po(
    po_id: uuid.UUID,
    body: PurchaseOrderUpdate,
    user: Annotated[UserTenant, Depends(require_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PurchaseOrderDetail:
    """Update a DRAFT Purchase Order."""
    tenant_id = _tenant_id(user)
    po = await _reload_po(po_id, db)
    if po.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Purchase Order not found.")
    if po.status != "DRAFT":
        raise HTTPException(status_code=400, detail="Only DRAFT Purchase Orders can be updated.")

    lines_body = body.lines
    update_data = body.model_dump(exclude_unset=True, exclude={"lines"})
    for field, value in update_data.items():
        setattr(po, field, value)

    exchange_rate = po.exchange_rate

    if lines_body is not None:
        # Delete existing lines and replace
        for existing_line in po.lines:
            await db.delete(existing_line)
        await db.flush()
        for line_in in lines_body:
            line_data = _compute_po_line(line_in, exchange_rate)
            db.add(PurchaseOrderLine(po_id=po.id, **line_data))
        await db.flush()

    po = await _reload_po(po_id, db)
    _recompute_po_totals(po)
    await db.commit()
    return _po_to_detail(await _reload_po(po_id, db))


@router.delete("/{po_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_po(
    po_id: uuid.UUID,
    user: Annotated[UserTenant, Depends(require_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Delete a DRAFT Purchase Order."""
    tenant_id = _tenant_id(user)
    po = await _reload_po(po_id, db)
    if po.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Purchase Order not found.")
    if po.status != "DRAFT":
        raise HTTPException(status_code=400, detail="Only DRAFT Purchase Orders can be deleted.")
    await db.delete(po)
    await db.commit()


@router.post("/{po_id}/submit", response_model=PurchaseOrderDetail)
async def submit_po(
    po_id: uuid.UUID,
    user: Annotated[UserTenant, Depends(require_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PurchaseOrderDetail:
    """Submit a DRAFT PO for approval. Computes the approval chain and writes PoApproval rows."""
    tenant_id = _tenant_id(user)
    user_id = getattr(user, "user_id", None)
    po = await _reload_po(po_id, db)
    if po.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Purchase Order not found.")
    if po.status != "DRAFT":
        raise HTTPException(status_code=400, detail="Only DRAFT POs can be submitted.")
    if not po.lines:
        raise HTTPException(status_code=400, detail="PO must have at least one line before submitting.")

    now = datetime.now(timezone.utc)

    # Compute approval chain — mirrors ap.py submit_invoice() pattern exactly.
    # module key "po" must match what the approval-matrix UI saves for PO policies.
    policy = await get_policy("po", tenant_id, db)
    chain_steps: list = []

    if policy:
        try:
            chain_steps = await compute_chain(
                submitter_user_id=user_id,
                tenant_id=tenant_id,
                module="po",
                total_amount=po.total_amount_base,
                db=db,
            )
        except ApprovalChainHoldError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        except ApprovalRoutingError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
    else:
        # No PO policy configured — cannot route automatically.
        # Finance must configure a PO approval policy in the approval-matrix UI first.
        raise HTTPException(
            status_code=422,
            detail=(
                "No PO approval policy is configured for this tenant. "
                "Set one up in Setup → Approval Workflows before submitting POs."
            ),
        )

    # SOD: submitter cannot be in the approval chain
    for step in chain_steps:
        if step.approver_user_id == user_id:
            raise HTTPException(
                status_code=400,
                detail="Separation of duties: an approver in the chain is the same person as the submitter.",
            )

    # ChainStep fields: level (int), approver_user_id (UUID), is_advisory (bool)
    for step in chain_steps:
        db.add(PoApproval(
            po_id=po.id,
            tenant_id=tenant_id,
            step_order=step.level,
            approver_id=step.approver_user_id,
            status="PENDING",
            is_advisory=step.is_advisory,
        ))

    # Write immutable snapshot
    db.add(PoSnapshot(po_id=po.id, snapshot_data=_build_po_snapshot(po)))

    po.status = "SUBMITTED"
    po.submitted_at = now
    po.submitted_by = user_id
    await db.commit()
    return _po_to_detail(await _reload_po(po_id, db))


@router.post("/{po_id}/approve", response_model=PurchaseOrderDetail)
async def approve_po(
    po_id: uuid.UUID,
    body: PoActionBody,
    user: Annotated[UserTenant, Depends(require_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PurchaseOrderDetail:
    """Approve a submitted PO (current approver action)."""
    tenant_id = _tenant_id(user)
    user_id = getattr(user, "user_id", None)
    po = await _reload_po(po_id, db)
    if po.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Purchase Order not found.")
    if po.status not in ("SUBMITTED", "APPROVED"):
        raise HTTPException(status_code=400, detail="PO is not awaiting approval.")

    now = datetime.now(timezone.utc)

    # Find the pending approval step assigned to this user
    pending_result = await db.execute(
        select(PoApproval).where(
            PoApproval.po_id == po.id,
            PoApproval.status == "PENDING",
            PoApproval.approver_id == user_id,
        ).order_by(PoApproval.step_order)
    )
    pending_step = pending_result.scalars().first()

    if not pending_step:
        raise HTTPException(status_code=403, detail="You have no pending approval step for this PO.")

    pending_step.status = "APPROVED"
    pending_step.action_at = now
    pending_step.comment = body.comment

    # Check if any non-advisory pending steps remain
    remaining_result = await db.execute(
        select(PoApproval).where(
            PoApproval.po_id == po.id,
            PoApproval.status == "PENDING",
            PoApproval.is_advisory.is_(False),
        )
    )
    remaining = remaining_result.scalars().all()
    # Exclude the step just approved
    remaining = [s for s in remaining if s.id != pending_step.id]

    if not remaining:
        # All mandatory steps approved — PO is fully approved
        po.status = "APPROVED"
        po.approved_at = now
        po.approved_by = user_id

        # Snapshot the posting_mode from tenant config
        from sqlalchemy.orm import selectinload as sil
        from app.models.auth import Tenant
        t_result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
        tenant = t_result.scalar_one_or_none()
        if tenant:
            po.posting_mode = getattr(tenant, "posting_mode", None)

    await db.commit()
    return _po_to_detail(await _reload_po(po_id, db))


@router.post("/{po_id}/reject", response_model=PurchaseOrderDetail)
async def reject_po(
    po_id: uuid.UUID,
    body: PoRejectBody,
    user: Annotated[UserTenant, Depends(require_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PurchaseOrderDetail:
    """Reject a submitted PO. Returns it to DRAFT for edits."""
    tenant_id = _tenant_id(user)
    user_id = getattr(user, "user_id", None)
    po = await _reload_po(po_id, db)
    if po.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Purchase Order not found.")
    if po.status not in ("SUBMITTED", "APPROVED"):
        raise HTTPException(status_code=400, detail="PO is not awaiting approval.")

    now = datetime.now(timezone.utc)

    pending_result = await db.execute(
        select(PoApproval).where(
            PoApproval.po_id == po.id,
            PoApproval.status == "PENDING",
            PoApproval.approver_id == user_id,
        )
    )
    pending_step = pending_result.scalars().first()
    if not pending_step:
        raise HTTPException(status_code=403, detail="You have no pending approval step for this PO.")

    pending_step.status = "REJECTED"
    pending_step.action_at = now
    pending_step.comment = body.comment

    po.status = "REJECTED"
    po.rejected_at = now
    po.rejected_by = user_id
    po.rejection_reason = body.rejection_reason
    await db.commit()
    return _po_to_detail(await _reload_po(po_id, db))


@router.post("/{po_id}/send", response_model=PurchaseOrderDetail)
async def send_po(
    po_id: uuid.UUID,
    user: Annotated[UserTenant, Depends(require_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PurchaseOrderDetail:
    """Mark an APPROVED PO as sent to the vendor."""
    tenant_id = _tenant_id(user)
    user_id = getattr(user, "user_id", None)
    po = await _reload_po(po_id, db)
    if po.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Purchase Order not found.")
    if po.status != "APPROVED":
        raise HTTPException(status_code=400, detail="Only APPROVED POs can be marked as sent.")
    po.status = "SENT"
    po.sent_at = datetime.now(timezone.utc)
    po.sent_by = user_id
    await db.commit()
    return _po_to_detail(await _reload_po(po_id, db))


@router.post("/{po_id}/close", response_model=PurchaseOrderDetail)
async def close_po(
    po_id: uuid.UUID,
    user: Annotated[UserTenant, Depends(require_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PurchaseOrderDetail:
    """Manually close a PO (e.g. after partial receipt + decision to stop)."""
    tenant_id = _tenant_id(user)
    user_id = getattr(user, "user_id", None)
    po = await _reload_po(po_id, db)
    if po.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Purchase Order not found.")
    if po.status not in ("SENT", "PARTIALLY_RECEIVED", "FULLY_RECEIVED"):
        raise HTTPException(status_code=400, detail="PO cannot be closed in its current status.")
    po.status = "CLOSED"
    po.closed_at = datetime.now(timezone.utc)
    po.closed_by = user_id
    await db.commit()
    return _po_to_detail(await _reload_po(po_id, db))


@router.post("/{po_id}/cancel", response_model=PurchaseOrderDetail)
async def cancel_po(
    po_id: uuid.UUID,
    user: Annotated[UserTenant, Depends(require_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PurchaseOrderDetail:
    """Cancel a PO that has not yet been received against."""
    tenant_id = _tenant_id(user)
    user_id = getattr(user, "user_id", None)
    po = await _reload_po(po_id, db)
    if po.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Purchase Order not found.")
    if po.status in ("PARTIALLY_RECEIVED", "FULLY_RECEIVED", "CLOSED", "CANCELLED"):
        raise HTTPException(status_code=400, detail="PO cannot be cancelled in its current status.")
    po.status = "CANCELLED"
    po.cancelled_at = datetime.now(timezone.utc)
    po.cancelled_by = user_id
    await db.commit()
    return _po_to_detail(await _reload_po(po_id, db))


# ── GRN endpoints ─────────────────────────────────────────────────────────────

@router.get("/{po_id}/grns", response_model=list[GrnResponse])
async def list_grns(
    po_id: uuid.UUID,
    user: Annotated[UserTenant, Depends(require_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[GrnResponse]:
    """List GRNs for a specific PO."""
    tenant_id = _tenant_id(user)
    result = await db.execute(
        select(GoodsReceiptNote)
        .where(GoodsReceiptNote.po_id == po_id, GoodsReceiptNote.tenant_id == tenant_id)
        .order_by(GoodsReceiptNote.created_at.desc())
    )
    return [GrnResponse.model_validate(g) for g in result.scalars().all()]


@router.post("/{po_id}/grns", response_model=GrnDetail, status_code=status.HTTP_201_CREATED)
async def create_grn(
    po_id: uuid.UUID,
    body: GrnCreate,
    user: Annotated[UserTenant, Depends(require_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> GrnDetail:
    """Create a DRAFT GRN against an APPROVED / SENT / PARTIALLY_RECEIVED PO."""
    tenant_id = _tenant_id(user)
    user_id = getattr(user, "user_id", None)
    po = await _reload_po(po_id, db)
    if po.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Purchase Order not found.")
    if po.status not in ("APPROVED", "SENT", "PARTIALLY_RECEIVED"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot create GRN against a PO with status '{po.status}'."
        )

    grn_number = await _next_grn_number(db, tenant_id, body.receipt_date)
    grn = GoodsReceiptNote(
        tenant_id=tenant_id,
        po_id=po_id,
        grn_number=grn_number,
        received_by=user_id,
        receipt_date=body.receipt_date,
        delivery_note_number=body.delivery_note_number,
        notes=body.notes,
        status="DRAFT",
        created_by=user_id,
    )
    db.add(grn)
    await db.flush()

    # Build GRN lines — enforce over-receipt guard
    po_lines_by_id = {ln.id: ln for ln in po.lines}
    for line_in in body.lines:
        po_line = po_lines_by_id.get(line_in.po_line_id)
        if not po_line:
            raise HTTPException(status_code=400, detail=f"PO line {line_in.po_line_id} not found on this PO.")
        remaining = po_line.quantity_ordered - po_line.quantity_received
        if line_in.quantity_received > remaining:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Line {line_in.line_number}: quantity_received ({line_in.quantity_received}) "
                    f"exceeds remaining quantity ({remaining}) on PO line."
                ),
            )
        amount_base = (line_in.quantity_received * po_line.unit_price * po.exchange_rate).quantize(Decimal("0.01"))
        db.add(GrnLine(
            grn_id=grn.id,
            po_line_id=line_in.po_line_id,
            line_number=line_in.line_number,
            description=line_in.description,
            quantity_received=line_in.quantity_received,
            unit_price_on_po=po_line.unit_price,
            amount_base=amount_base,
            condition_notes=line_in.condition_notes,
        ))

    await db.commit()
    return GrnDetail.model_validate(await _reload_grn(grn.id, db))


@router.get("/grns/{grn_id}", response_model=GrnDetail)
async def get_grn(
    grn_id: uuid.UUID,
    user: Annotated[UserTenant, Depends(require_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> GrnDetail:
    tenant_id = _tenant_id(user)
    grn = await _reload_grn(grn_id, db)
    if grn.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="GRN not found.")
    return GrnDetail.model_validate(grn)


@router.post("/grns/{grn_id}/confirm", response_model=GrnDetail)
async def confirm_grn(
    grn_id: uuid.UUID,
    user: Annotated[UserTenant, Depends(require_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> GrnDetail:
    """
    Confirm a GRN — immutable after this point.

    Side effects:
      1. Increments po_line.quantity_received for each GRN line
      2. Updates purchase_orders.amount_received
      3. Advances PO status to PARTIALLY_RECEIVED or FULLY_RECEIVED
      4. Full ERP: posts GRNI accrual journal (DR expense GL / CR grni)
      5. Connected: creates posting_batch for GRNI accrual
    """
    tenant_id = _tenant_id(user)
    user_id = getattr(user, "user_id", None)
    grn = await _reload_grn(grn_id, db)
    if grn.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="GRN not found.")
    if grn.status != "DRAFT":
        raise HTTPException(status_code=400, detail="GRN is already confirmed.")

    now = datetime.now(timezone.utc)
    grn.status = "CONFIRMED"
    grn.confirmed_at = now
    grn.confirmed_by = user_id

    po = grn.po
    if not po:
        raise HTTPException(status_code=500, detail="GRN is not linked to a PO.")

    # Reload PO lines fresh to avoid stale state
    po_lines_result = await db.execute(
        select(PurchaseOrderLine).where(PurchaseOrderLine.po_id == po.id)
    )
    po_lines_by_id = {ln.id: ln for ln in po_lines_result.scalars().all()}

    total_grn_amount = Decimal("0")
    for gl in grn.lines:
        po_line = po_lines_by_id.get(gl.po_line_id)
        if po_line:
            po_line.quantity_received += gl.quantity_received
        total_grn_amount += gl.amount_base

    po.amount_received += total_grn_amount

    # Determine new PO status
    all_fully_received = all(
        ln.quantity_received >= ln.quantity_ordered
        for ln in po_lines_by_id.values()
    )
    po.status = "FULLY_RECEIVED" if all_fully_received else "PARTIALLY_RECEIVED"

    await db.flush()

    # GL effects
    try:
        await post_grni_accrual(db, grn, created_by=user_id)
        await create_grni_posting_batch(db, grn)
    except Exception as exc:
        logger.error("GRNI posting failed for GRN %s: %s", grn_id, exc)
        raise HTTPException(status_code=500, detail=f"GRNI posting error: {exc}")

    await db.commit()
    return GrnDetail.model_validate(await _reload_grn(grn_id, db))


# ── 3-Way Match endpoints ─────────────────────────────────────────────────────

@router.post("/matches", response_model=list[MatchResponse], status_code=status.HTTP_201_CREATED)
async def create_matches(
    body: MatchCreateBody,
    user: Annotated[UserTenant, Depends(require_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[MatchResponse]:
    """
    Record 3-way match records linking AP invoice lines to GRN lines.

    The match engine auto-computes price_variance, qty_variance, and match_status.
    Existing match records for the same invoice are NOT replaced — call this once
    per invoice. To override a specific match status use PATCH /matches/{id}/override.
    """
    tenant_id = _tenant_id(user)
    user_id = getattr(user, "user_id", None)

    # Verify invoice belongs to tenant
    inv_result = await db.execute(
        select(ApInvoice)
        .options(selectinload(ApInvoice.lines))
        .where(ApInvoice.id == body.invoice_id, ApInvoice.tenant_id == tenant_id)
    )
    invoice = inv_result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    if invoice.status not in ("SUBMITTED", "APPROVED", "DRAFT"):
        raise HTTPException(status_code=400, detail="Matches can only be created for active invoices.")

    inv_lines_by_id = {ln.id: ln for ln in invoice.lines}
    tolerance = await _get_tolerance(db, tenant_id)
    created_matches: list[ApInvoicePoMatch] = []

    for m in body.matches:
        inv_line = inv_lines_by_id.get(m.invoice_line_id)
        if not inv_line:
            raise HTTPException(status_code=400, detail=f"Invoice line {m.invoice_line_id} not found on invoice.")

        # Load GRN line and its PO line
        grn_line_result = await db.execute(
            select(GrnLine)
            .options(selectinload(GrnLine.grn), selectinload(GrnLine.po_line))
            .where(GrnLine.id == m.grn_line_id)
        )
        grn_line = grn_line_result.scalar_one_or_none()
        if not grn_line or grn_line.grn.tenant_id != tenant_id:
            raise HTTPException(status_code=400, detail=f"GRN line {m.grn_line_id} not found.")
        if grn_line.grn.status != "CONFIRMED":
            raise HTTPException(status_code=400, detail="Can only match against CONFIRMED GRN lines.")

        po_line = grn_line.po_line
        grn = grn_line.grn

        # Compute variance
        result = compute_match_status(
            invoice_unit_price=inv_line.unit_price,
            po_unit_price=grn_line.unit_price_on_po,
            matched_quantity=m.matched_quantity,
            grn_line_quantity=grn_line.quantity_received,
            exchange_rate=grn_line.grn.po.exchange_rate if grn_line.grn.po else Decimal("1"),
            price_tolerance_pct=tolerance.price_tolerance_pct,
            qty_tolerance_pct=tolerance.qty_tolerance_pct,
            auto_approve_within_tolerance=tolerance.auto_approve_within_tolerance,
        )

        match_record = ApInvoicePoMatch(
            tenant_id=tenant_id,
            invoice_id=body.invoice_id,
            invoice_line_id=m.invoice_line_id,
            grn_id=grn.id,
            grn_line_id=m.grn_line_id,
            po_id=grn.po_id,
            po_line_id=grn_line.po_line_id,
            matched_quantity=m.matched_quantity,
            matched_amount_base=result.matched_amount_base,
            price_variance=result.price_variance,
            price_variance_pct=result.price_variance_pct,
            qty_variance=result.qty_variance,
            match_status=result.match_status,
            created_by=user_id,
        )
        db.add(match_record)
        created_matches.append(match_record)

        # Update po_line.quantity_invoiced
        if po_line:
            po_line.quantity_invoiced += m.matched_quantity

        # Update po.amount_invoiced
        if grn.po:
            grn.po.amount_invoiced += result.matched_amount_base

    await db.commit()
    # Reload with IDs
    for cm in created_matches:
        await db.refresh(cm)
    return [MatchResponse.model_validate(cm) for cm in created_matches]


@router.get("/matches/{invoice_id}", response_model=list[MatchResponse])
async def get_invoice_matches(
    invoice_id: uuid.UUID,
    user: Annotated[UserTenant, Depends(require_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[MatchResponse]:
    """Get all 3-way match records for an AP invoice."""
    tenant_id = _tenant_id(user)
    result = await db.execute(
        select(ApInvoicePoMatch)
        .where(ApInvoicePoMatch.invoice_id == invoice_id, ApInvoicePoMatch.tenant_id == tenant_id)
        .order_by(ApInvoicePoMatch.created_at)
    )
    return [MatchResponse.model_validate(m) for m in result.scalars().all()]


@router.patch("/matches/{match_id}/override", response_model=MatchResponse)
async def override_match(
    match_id: uuid.UUID,
    body: MatchOverrideBody,
    user: Annotated[UserTenant, Depends(require_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MatchResponse:
    """Finance override — sets match status to MANUAL_OVERRIDE with a comment."""
    tenant_id = _tenant_id(user)
    result = await db.execute(
        select(ApInvoicePoMatch).where(
            ApInvoicePoMatch.id == match_id,
            ApInvoicePoMatch.tenant_id == tenant_id,
        )
    )
    match = result.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=404, detail="Match record not found.")
    match.match_status = "MANUAL_OVERRIDE"
    match.override_comment = body.override_comment
    await db.commit()
    await db.refresh(match)
    return MatchResponse.model_validate(match)


@router.get("/match-report", response_model=list[MatchReportRow])
async def match_report(
    user: Annotated[UserTenant, Depends(require_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
    invoice_status: Optional[str] = Query(None),
) -> list[MatchReportRow]:
    """
    Match status summary across all invoices that have match records.

    Returns one row per invoice with variance counts and payment-blocked flag.
    """
    tenant_id = _tenant_id(user)
    tolerance = await _get_tolerance(db, tenant_id)

    # Load all match records for tenant
    q = (
        select(ApInvoicePoMatch)
        .where(ApInvoicePoMatch.tenant_id == tenant_id)
        .order_by(ApInvoicePoMatch.invoice_id, ApInvoicePoMatch.created_at)
    )
    result = await db.execute(q)
    matches = result.scalars().all()

    # Group by invoice_id
    grouped: dict[uuid.UUID, list[ApInvoicePoMatch]] = {}
    for m in matches:
        grouped.setdefault(m.invoice_id, []).append(m)

    # Load invoices for metadata
    if not grouped:
        return []

    inv_result = await db.execute(
        select(ApInvoice)
        .options(selectinload(ApInvoice.vendor))
        .where(ApInvoice.id.in_(list(grouped.keys())), ApInvoice.tenant_id == tenant_id)
    )
    invoices_by_id = {inv.id: inv for inv in inv_result.scalars().all()}

    rows: list[MatchReportRow] = []
    for invoice_id, inv_matches in grouped.items():
        inv = invoices_by_id.get(invoice_id)
        if not inv:
            continue
        if invoice_status and inv.status != invoice_status:
            continue

        statuses = [m.match_status for m in inv_matches]
        variance_count = sum(1 for s in statuses if s not in ("MATCHED", "MANUAL_OVERRIDE"))
        rows.append(MatchReportRow(
            invoice_id=invoice_id,
            invoice_reference=inv.reference,
            vendor_name=inv.vendor.name if inv.vendor else "",
            total_invoice_amount=inv.total_amount_base,
            total_matched_amount=sum(m.matched_amount_base for m in inv_matches),
            line_count=len(inv_matches),
            clean_match_count=sum(1 for s in statuses if s == "MATCHED"),
            variance_count=variance_count,
            payment_blocked=invoice_payment_blocked(statuses, tolerance.block_payment_on_variance),
            match_statuses=list(set(statuses)),
        ))

    return rows


@router.get("/tolerance", response_model=PoToleranceConfigResponse)
async def get_tolerance(
    user: Annotated[UserTenant, Depends(require_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PoToleranceConfigResponse:
    """Get this tenant's 3-way match tolerance settings."""
    tenant_id = _tenant_id(user)
    cfg = await _get_tolerance(db, tenant_id)
    await db.commit()  # Persist auto-created defaults if needed
    return PoToleranceConfigResponse.model_validate(cfg)


@router.put("/tolerance", response_model=PoToleranceConfigResponse)
async def update_tolerance(
    body: PoToleranceConfigUpdate,
    user: Annotated[UserTenant, Depends(require_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PoToleranceConfigResponse:
    """Update tolerance settings (all fields optional)."""
    tenant_id = _tenant_id(user)
    user_id = getattr(user, "user_id", None)
    cfg = await _get_tolerance(db, tenant_id)
    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(cfg, field, value)
    cfg.updated_by = user_id
    await db.commit()
    await db.refresh(cfg)
    return PoToleranceConfigResponse.model_validate(cfg)
