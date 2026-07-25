"""
Accounts Payable (AP) router — M11.

Vendor master CRUD and AP invoice lifecycle (DRAFT → SUBMITTED → APPROVED → PAID).
Three-mode aware: Lite (workflow + export), Connected (+ posting_batches), Full ERP (+ GL journals).

Routes:
    Vendors:
        GET    /api/ap/vendors                  — list active vendors
        POST   /api/ap/vendors                  — create vendor
        GET    /api/ap/vendors/{id}             — get vendor detail
        PATCH  /api/ap/vendors/{id}             — update vendor

    Invoices:
        GET    /api/ap/invoices                 — list invoices (filterable)
        POST   /api/ap/invoices                 — create DRAFT invoice
        GET    /api/ap/invoices/{id}            — invoice detail (with lines + approvals)
        PUT    /api/ap/invoices/{id}            — update DRAFT invoice
        DELETE /api/ap/invoices/{id}            — delete DRAFT invoice
        POST   /api/ap/invoices/{id}/submit     — submit for approval
        POST   /api/ap/invoices/{id}/approve    — approver action: approve
        POST   /api/ap/invoices/{id}/reject     — approver action: reject
        POST   /api/ap/invoices/{id}/cancel     — cancel invoice
        POST   /api/ap/invoices/{id}/pay        — record payment

    Reports:
        GET    /api/ap/aging                    — AP aging by vendor
        GET    /api/ap/invoices/export          — CSV/Excel export (all modes)
"""

import csv
import io
import logging
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import case, extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.middleware.auth import require_auth
from app.models.ap import ApApproval, ApInvoice, ApInvoiceLine, ApInvoiceSnapshot, Vendor
from app.models.auth import User, UserTenant
from app.schemas.ap import (
    ApAgingResponse,
    ApAgingVendorRow,
    ApApproveBody,
    ApInvoiceCreate,
    ApInvoiceDetail,
    ApInvoiceLineResponse,
    ApInvoiceResponse,
    ApInvoiceUpdate,
    ApPayBody,
    ApRejectBody,
    VendorCreate,
    VendorResponse,
    VendorUpdate,
)
from app.services.ap_posting import (
    PostingError,
    create_ap_posting_batch,
    post_ap_approval,
    post_ap_payment,
)
from app.services.approval_routing import (
    ApprovalChainHoldError,
    ApprovalRoutingError,
    ChainStep,
    compute_chain,
    get_policy,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ap", tags=["Accounts Payable"])


# ── Auth helpers ──────────────────────────────────────────────────────────────

def _tenant_id(user: UserTenant) -> uuid.UUID:
    """Return tenant_id or raise 400 if user has no tenant context."""
    tid = getattr(user, "tenant_id", None)
    if not tid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No tenant context.")
    return tid


# ── Reference sequence helpers ────────────────────────────────────────────────

async def _next_vendor_code(db: AsyncSession, tenant_id: uuid.UUID) -> str:
    """Generate V-{NNNN:04d} vendor code for this tenant."""
    result = await db.execute(
        select(func.count(Vendor.id)).where(Vendor.tenant_id == tenant_id)
    )
    n = result.scalar_one() or 0
    return f"V-{n + 1:04d}"


async def _next_ap_reference(db: AsyncSession, tenant_id: uuid.UUID, invoice_date: date) -> str:
    """Generate AP-{YYYY}-{NNNN:04d} reference for this tenant+year."""
    year = invoice_date.year
    result = await db.execute(
        select(func.count(ApInvoice.id)).where(
            ApInvoice.tenant_id == tenant_id,
            extract("year", ApInvoice.invoice_date) == year,
        )
    )
    n = result.scalar_one() or 0
    return f"AP-{year}-{n + 1:04d}"


# ── Line computation ──────────────────────────────────────────────────────────

def _compute_line(
    line_in,
    exchange_rate: Decimal,
) -> dict:
    """
    Derive stored amounts from the input line fields.

    amount_base     = amount_foreign * exchange_rate
    vat_amount      = amount_base * vat_rate   (if vat_applicable)
    wht_amount      = amount_base * wht_rate   (if wht_applicable)
    net_payable_line = amount_base - wht_amount
    """
    amount_foreign = line_in.amount_foreign
    amount_base = (amount_foreign * exchange_rate).quantize(Decimal("0.01"))
    vat_amount = (amount_base * line_in.vat_rate).quantize(Decimal("0.01")) if line_in.vat_applicable else Decimal("0")
    wht_amount = (amount_base * line_in.wht_rate).quantize(Decimal("0.01")) if line_in.wht_applicable else Decimal("0")
    net_payable_line = amount_base - wht_amount

    return {
        "line_number": line_in.line_number,
        "description": line_in.description,
        "quantity": line_in.quantity,
        "unit_price": line_in.unit_price,
        "amount_foreign": amount_foreign,
        "amount_base": amount_base,
        "gl_account_id": line_in.gl_account_id,
        "dimension_values": line_in.dimension_values,
        "vat_applicable": line_in.vat_applicable,
        "vat_rate": line_in.vat_rate,
        "vat_amount": vat_amount,
        "wht_applicable": line_in.wht_applicable,
        "wht_rate": line_in.wht_rate,
        "wht_amount": wht_amount,
        "net_payable_line": net_payable_line,
        "category_hint": line_in.category_hint,
    }


def _recompute_totals(invoice: ApInvoice) -> None:
    """Recalculate header totals from lines (called after line upsert)."""
    invoice.total_amount_foreign = sum(ln.amount_foreign for ln in invoice.lines)
    invoice.total_amount_base = sum(ln.amount_base for ln in invoice.lines)
    invoice.total_vat = sum(ln.vat_amount for ln in invoice.lines)
    invoice.total_wht = sum(ln.wht_amount for ln in invoice.lines)
    invoice.net_payable = sum(ln.net_payable_line for ln in invoice.lines)


# ── Snapshot helper ───────────────────────────────────────────────────────────

def _build_snapshot(invoice: ApInvoice) -> dict:
    """Serialise the full invoice to a JSONB-safe dict at submission time."""
    return {
        "reference": invoice.reference,
        "invoice_number": invoice.invoice_number,
        "vendor_id": str(invoice.vendor_id),
        "invoice_date": invoice.invoice_date.isoformat(),
        "received_date": invoice.received_date.isoformat(),
        "due_date": invoice.due_date.isoformat() if invoice.due_date else None,
        "currency": invoice.currency,
        "exchange_rate": str(invoice.exchange_rate),
        "total_amount_foreign": str(invoice.total_amount_foreign),
        "total_amount_base": str(invoice.total_amount_base),
        "total_vat": str(invoice.total_vat),
        "total_wht": str(invoice.total_wht),
        "net_payable": str(invoice.net_payable),
        "description": invoice.description,
        "lines": [
            {
                "line_number": ln.line_number,
                "description": ln.description,
                "amount_foreign": str(ln.amount_foreign),
                "amount_base": str(ln.amount_base),
                "gl_account_id": str(ln.gl_account_id) if ln.gl_account_id else None,
                "dimension_values": ln.dimension_values,
                "vat_applicable": ln.vat_applicable,
                "vat_amount": str(ln.vat_amount),
                "wht_applicable": ln.wht_applicable,
                "wht_amount": str(ln.wht_amount),
                "net_payable_line": str(ln.net_payable_line),
            }
            for ln in invoice.lines
        ],
    }


# ── Reload helper ─────────────────────────────────────────────────────────────

async def _reload_invoice(invoice_id: uuid.UUID, db: AsyncSession) -> ApInvoice:
    """Reload an invoice with all relationships (vendor, lines, approvals)."""
    result = await db.execute(
        select(ApInvoice)
        .options(
            selectinload(ApInvoice.vendor),
            selectinload(ApInvoice.lines),
            selectinload(ApInvoice.approvals),
        )
        .where(ApInvoice.id == invoice_id)
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    return inv


def _to_response(invoice: ApInvoice) -> ApInvoiceResponse:
    """Build ApInvoiceResponse, injecting vendor_name from relationship."""
    return ApInvoiceResponse(
        id=invoice.id,
        tenant_id=invoice.tenant_id,
        vendor_id=invoice.vendor_id,
        vendor_name=invoice.vendor.name if invoice.vendor else "",
        reference=invoice.reference,
        invoice_number=invoice.invoice_number,
        invoice_date=invoice.invoice_date,
        due_date=invoice.due_date,
        currency=invoice.currency,
        total_amount_base=invoice.total_amount_base,
        total_vat=invoice.total_vat,
        total_wht=invoice.total_wht,
        net_payable=invoice.net_payable,
        status=invoice.status,
        duplicate_flag=invoice.duplicate_flag,
        submitted_at=invoice.submitted_at,
        approved_at=invoice.approved_at,
        paid_at=invoice.paid_at,
        created_at=invoice.created_at,
    )


def _to_detail(invoice: ApInvoice) -> ApInvoiceDetail:
    """Build ApInvoiceDetail (full with lines + approvals)."""
    return ApInvoiceDetail(
        id=invoice.id,
        tenant_id=invoice.tenant_id,
        vendor_id=invoice.vendor_id,
        vendor_name=invoice.vendor.name if invoice.vendor else "",
        reference=invoice.reference,
        invoice_number=invoice.invoice_number,
        invoice_date=invoice.invoice_date,
        due_date=invoice.due_date,
        currency=invoice.currency,
        total_amount_base=invoice.total_amount_base,
        total_vat=invoice.total_vat,
        total_wht=invoice.total_wht,
        net_payable=invoice.net_payable,
        status=invoice.status,
        duplicate_flag=invoice.duplicate_flag,
        submitted_at=invoice.submitted_at,
        approved_at=invoice.approved_at,
        paid_at=invoice.paid_at,
        created_at=invoice.created_at,
        received_date=invoice.received_date,
        exchange_rate=invoice.exchange_rate,
        total_amount_foreign=invoice.total_amount_foreign,
        description=invoice.description,
        posting_mode=invoice.posting_mode,
        is_advance_settlement=invoice.is_advance_settlement,
        rejection_reason=invoice.rejection_reason,
        payment_reference=invoice.payment_reference,
        journal_entry_id=invoice.journal_entry_id,
        payment_journal_entry_id=invoice.payment_journal_entry_id,
        posting_batch_id=invoice.posting_batch_id,
        lines=[ApInvoiceLineResponse.model_validate(ln) for ln in invoice.lines],
        approvals=[],
    )


# ═════════════════════════════════════════════════════════════════════════════
# VENDOR ENDPOINTS
# ═════════════════════════════════════════════════════════════════════════════

@router.get("/vendors", response_model=list[VendorResponse])
async def list_vendors(
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
    include_inactive: bool = Query(False),
    search: Optional[str] = Query(None),
) -> list[VendorResponse]:
    """
    List vendors for the tenant.

    Parameters:
        include_inactive — include deactivated vendors (default: False)
        search           — filter by name or code (case-insensitive substring)
    """
    tenant_id = _tenant_id(current_user)
    q = select(Vendor).where(Vendor.tenant_id == tenant_id)
    if not include_inactive:
        q = q.where(Vendor.is_active.is_(True))
    if search:
        q = q.where(Vendor.name.ilike(f"%{search}%") | Vendor.code.ilike(f"%{search}%"))
    q = q.order_by(Vendor.name)
    result = await db.execute(q)
    return [VendorResponse.model_validate(v) for v in result.scalars().all()]


@router.post("/vendors", response_model=VendorResponse, status_code=201)
async def create_vendor(
    body: VendorCreate,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> VendorResponse:
    """
    Create a new vendor.

    If 'code' is omitted, one is auto-generated in the format V-{NNNN}.
    """
    tenant_id = _tenant_id(current_user)
    code = body.code or await _next_vendor_code(db, tenant_id)

    # Uniqueness check
    exists = await db.execute(
        select(func.count(Vendor.id)).where(
            Vendor.tenant_id == tenant_id, Vendor.code == code
        )
    )
    if exists.scalar_one() > 0:
        raise HTTPException(status_code=409, detail=f"Vendor code '{code}' already exists.")

    v = Vendor(
        tenant_id=tenant_id,
        code=code,
        **{k: v for k, v in body.model_dump().items() if k != "code"},
    )
    db.add(v)
    await db.commit()
    await db.refresh(v)
    return VendorResponse.model_validate(v)


@router.get("/vendors/{vendor_id}", response_model=VendorResponse)
async def get_vendor(
    vendor_id: uuid.UUID,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> VendorResponse:
    """Get a single vendor by ID."""
    tenant_id = _tenant_id(current_user)
    result = await db.execute(
        select(Vendor).where(Vendor.id == vendor_id, Vendor.tenant_id == tenant_id)
    )
    v = result.scalar_one_or_none()
    if not v:
        raise HTTPException(status_code=404, detail="Vendor not found.")
    return VendorResponse.model_validate(v)


@router.patch("/vendors/{vendor_id}", response_model=VendorResponse)
async def update_vendor(
    vendor_id: uuid.UUID,
    body: VendorUpdate,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> VendorResponse:
    """Update vendor fields. All fields optional (PATCH semantics)."""
    tenant_id = _tenant_id(current_user)
    result = await db.execute(
        select(Vendor).where(Vendor.id == vendor_id, Vendor.tenant_id == tenant_id)
    )
    v = result.scalar_one_or_none()
    if not v:
        raise HTTPException(status_code=404, detail="Vendor not found.")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(v, field, value)

    await db.commit()
    await db.refresh(v)
    return VendorResponse.model_validate(v)


# ═════════════════════════════════════════════════════════════════════════════
# INVOICE ENDPOINTS
# ═════════════════════════════════════════════════════════════════════════════

@router.get("/invoices", response_model=list[ApInvoiceResponse])
async def list_invoices(
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
    inv_status: Optional[str] = Query(None, alias="status"),
    vendor_id: Optional[uuid.UUID] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
) -> list[ApInvoiceResponse]:
    """
    List AP invoices for the tenant.

    Filterable by status and vendor. Ordered newest first.
    """
    tenant_id = _tenant_id(current_user)
    q = (
        select(ApInvoice)
        .options(selectinload(ApInvoice.vendor))
        .where(ApInvoice.tenant_id == tenant_id)
        .order_by(ApInvoice.created_at.desc())
    )
    if inv_status:
        q = q.where(ApInvoice.status == inv_status.upper())
    if vendor_id:
        q = q.where(ApInvoice.vendor_id == vendor_id)
    q = q.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q)
    return [_to_response(inv) for inv in result.scalars().all()]


@router.post("/invoices", response_model=ApInvoiceDetail, status_code=201)
async def create_invoice(
    body: ApInvoiceCreate,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> ApInvoiceDetail:
    """
    Create a new DRAFT AP invoice.

    Computes line-level VAT, WHT, and net payable amounts from the
    rates provided. Checks for duplicate invoice numbers per vendor
    and sets duplicate_flag if a match is found.
    """
    tenant_id = _tenant_id(current_user)

    # Vendor exists check
    vendor_check = await db.execute(
        select(Vendor).where(Vendor.id == body.vendor_id, Vendor.tenant_id == tenant_id)
    )
    if not vendor_check.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Vendor not found.")

    reference = await _next_ap_reference(db, tenant_id, body.invoice_date)

    # Duplicate detection (non-cancelled, non-rejected)
    dup_check = await db.execute(
        select(func.count(ApInvoice.id)).where(
            ApInvoice.tenant_id == tenant_id,
            ApInvoice.vendor_id == body.vendor_id,
            ApInvoice.invoice_number == body.invoice_number,
            ApInvoice.status.not_in(["CANCELLED", "REJECTED"]),
        )
    )
    duplicate_flag = (dup_check.scalar_one() or 0) > 0

    invoice = ApInvoice(
        tenant_id=tenant_id,
        vendor_id=body.vendor_id,
        reference=reference,
        invoice_number=body.invoice_number,
        invoice_date=body.invoice_date,
        received_date=body.received_date or date.today(),
        due_date=body.due_date,
        currency=body.currency,
        exchange_rate=body.exchange_rate,
        description=body.description,
        duplicate_flag=duplicate_flag,
        created_by=current_user.user_id,
    )
    db.add(invoice)
    await db.flush()  # get invoice.id

    for line_in in body.lines:
        computed = _compute_line(line_in, body.exchange_rate)
        db.add(ApInvoiceLine(invoice_id=invoice.id, **computed))

    await db.flush()

    # Reload to have lines for total computation
    inv = await _reload_invoice(invoice.id, db)
    _recompute_totals(inv)
    await db.commit()

    inv = await _reload_invoice(invoice.id, db)
    return _to_detail(inv)


@router.get("/invoices/{invoice_id}", response_model=ApInvoiceDetail)
async def get_invoice(
    invoice_id: uuid.UUID,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> ApInvoiceDetail:
    """Get a single AP invoice with full detail (lines + approvals)."""
    tenant_id = _tenant_id(current_user)
    result = await db.execute(
        select(ApInvoice)
        .options(
            selectinload(ApInvoice.vendor),
            selectinload(ApInvoice.lines),
            selectinload(ApInvoice.approvals),
        )
        .where(ApInvoice.id == invoice_id, ApInvoice.tenant_id == tenant_id)
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    return _to_detail(inv)


@router.put("/invoices/{invoice_id}", response_model=ApInvoiceDetail)
async def update_invoice(
    invoice_id: uuid.UUID,
    body: ApInvoiceUpdate,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> ApInvoiceDetail:
    """
    Update a DRAFT invoice.

    Only DRAFT invoices can be updated. If lines are included in the
    body, all existing lines are replaced.
    """
    tenant_id = _tenant_id(current_user)
    result = await db.execute(
        select(ApInvoice)
        .options(selectinload(ApInvoice.lines))
        .where(ApInvoice.id == invoice_id, ApInvoice.tenant_id == tenant_id)
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    if inv.status != "DRAFT":
        raise HTTPException(
            status_code=422,
            detail=f"Only DRAFT invoices can be edited. This invoice is {inv.status}.",
        )

    # Extract lines from body BEFORE model_dump so they remain ApInvoiceLineIn
    # objects (with attribute access) rather than plain dicts.
    lines_body = body.lines
    update_data = body.model_dump(exclude_unset=True, exclude={"lines"})

    for field, value in update_data.items():
        setattr(inv, field, value)

    if lines_body is not None:
        # Replace all lines
        for old_line in inv.lines:
            await db.delete(old_line)
        await db.flush()

        exchange_rate = inv.exchange_rate
        for line_in in lines_body:
            computed = _compute_line(line_in, exchange_rate)
            db.add(ApInvoiceLine(invoice_id=inv.id, **computed))
        await db.flush()

    inv = await _reload_invoice(invoice_id, db)
    _recompute_totals(inv)
    await db.commit()

    inv = await _reload_invoice(invoice_id, db)
    return _to_detail(inv)


@router.delete("/invoices/{invoice_id}", status_code=204)
async def delete_invoice(
    invoice_id: uuid.UUID,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a DRAFT invoice. Only DRAFT invoices can be deleted."""
    tenant_id = _tenant_id(current_user)
    result = await db.execute(
        select(ApInvoice).where(ApInvoice.id == invoice_id, ApInvoice.tenant_id == tenant_id)
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    if inv.status != "DRAFT":
        raise HTTPException(
            status_code=422,
            detail="Only DRAFT invoices can be deleted. Cancel the invoice instead.",
        )
    await db.delete(inv)
    await db.commit()


# ── Invoice lifecycle endpoints ───────────────────────────────────────────────

class SubmitInvoiceBody:
    """Optional selected_approver_id for tenants without a configured AP policy."""
    def __init__(self, selected_approver_id: Optional[uuid.UUID] = None) -> None:
        self.selected_approver_id = selected_approver_id


from pydantic import BaseModel as _BaseModel


class SubmitBody(_BaseModel):
    """Submit request body — selected_approver_id required when no AP policy is configured."""
    selected_approver_id: Optional[uuid.UUID] = None


@router.post("/invoices/{invoice_id}/submit", response_model=ApInvoiceDetail)
async def submit_invoice(
    invoice_id: uuid.UUID,
    body: SubmitBody,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> ApInvoiceDetail:
    """
    Submit a DRAFT AP invoice for approval.

    Routing:
      - If an active AP approval policy exists: compute_chain is used to
        build the approval chain automatically.
      - If no policy: selected_approver_id is required; creates a single-step chain.

    Writes an immutable snapshot on submission.
    """
    tenant_id = _tenant_id(current_user)
    inv = await _reload_invoice(invoice_id, db)
    if inv.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    if inv.status != "DRAFT":
        raise HTTPException(status_code=422, detail=f"Only DRAFT invoices can be submitted. Status: {inv.status}")
    if not inv.lines:
        raise HTTPException(status_code=422, detail="Invoice must have at least one line before submitting.")

    # Write snapshot
    db.add(ApInvoiceSnapshot(
        invoice_id=inv.id,
        snapshot_data=_build_snapshot(inv),
    ))

    # Compute approval chain
    # NOTE: the approval-policy system uses "payable" as the AP module key
    # (set by the existing approval-matrix UI — approval_policies.module = "payable").
    policy = await get_policy("payable", tenant_id, db)
    chain_steps: list[ChainStep] = []

    if policy:
        try:
            chain_steps = await compute_chain(
                submitter_user_id=current_user.user_id,
                tenant_id=tenant_id,
                module="payable",
                total_amount=inv.net_payable,
                db=db,
                requestor_selected_approver_id=body.selected_approver_id,
            )
        except ApprovalChainHoldError as e:
            raise HTTPException(status_code=422, detail=str(e))
        except ApprovalRoutingError as e:
            raise HTTPException(status_code=422, detail=str(e))
    elif body.selected_approver_id:
        # Single-step manual chain
        approver_check = await db.execute(
            select(User).where(User.id == body.selected_approver_id)
        )
        if not approver_check.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Selected approver not found.")
        from app.services.approval_routing import ChainStep as _CS
        chain_steps = [
            _CS(
                level=1,
                approver_user_id=body.selected_approver_id,
                role_label="Approver",
                chain_type="management",
            )
        ]
    else:
        raise HTTPException(
            status_code=422,
            detail="No AP approval policy is configured. Provide selected_approver_id to route manually.",
        )

    # SOD check
    for step in chain_steps:
        if step.approver_user_id == current_user.user_id:
            raise HTTPException(
                status_code=400,
                detail="Separation of duties: an approver in the chain is the same person as the submitter.",
            )

    for step in chain_steps:
        db.add(ApApproval(
            invoice_id=inv.id,
            tenant_id=tenant_id,
            step_order=step.level,
            approver_id=step.approver_user_id,
            status="PENDING",
            is_advisory=step.is_advisory,
        ))

    inv.status = "SUBMITTED"
    inv.submitted_at = datetime.now(timezone.utc)
    inv.submitted_by = current_user.user_id

    await db.commit()
    return _to_detail(await _reload_invoice(invoice_id, db))


@router.post("/invoices/{invoice_id}/approve", response_model=ApInvoiceDetail)
async def approve_invoice(
    invoice_id: uuid.UUID,
    body: ApApproveBody,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> ApInvoiceDetail:
    """
    Approve an AP invoice.

    The caller must be the assigned approver for the earliest pending step.
    Advisory steps are advanced automatically without blocking the chain.
    When all non-advisory steps are approved the invoice status becomes APPROVED
    and the GL / posting-batch hook is called based on the tenant's posting_mode.
    """
    tenant_id = _tenant_id(current_user)
    inv = await _reload_invoice(invoice_id, db)
    if inv.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    if inv.status != "SUBMITTED":
        raise HTTPException(status_code=422, detail=f"Invoice is not awaiting approval. Status: {inv.status}")

    # Load pending approvals ordered by step
    pending_result = await db.execute(
        select(ApApproval)
        .where(ApApproval.invoice_id == invoice_id, ApApproval.status == "PENDING")
        .order_by(ApApproval.step_order)
    )
    pending = pending_result.scalars().all()
    if not pending:
        raise HTTPException(status_code=422, detail="No pending approval steps found.")

    # Current step is lowest-order pending
    current_step = pending[0]
    if current_step.approver_id != current_user.user_id:
        raise HTTPException(
            status_code=403,
            detail="You are not assigned as the approver for the current step.",
        )

    current_step.status = "APPROVED"
    current_step.action_at = datetime.now(timezone.utc)
    current_step.comment = body.comment
    await db.flush()

    # Check if any non-advisory steps remain
    remaining_result = await db.execute(
        select(ApApproval).where(
            ApApproval.invoice_id == invoice_id,
            ApApproval.status == "PENDING",
            ApApproval.is_advisory.is_(False),
        )
    )
    blocking_remaining = remaining_result.scalars().all()

    if not blocking_remaining:
        # All done — mark APPROVED
        inv.status = "APPROVED"
        inv.approved_at = datetime.now(timezone.utc)
        inv.approved_by = current_user.user_id

        # Get posting mode from org config
        from app.models.setup import TenantOrgConfig
        mode_result = await db.execute(
            select(TenantOrgConfig.posting_mode).where(TenantOrgConfig.tenant_id == tenant_id)
        )
        posting_mode = mode_result.scalar_one_or_none() or "full_erp"
        inv.posting_mode = posting_mode

        # Reload lines for posting
        inv = await _reload_invoice(invoice_id, db)

        try:
            if posting_mode == "full_erp":
                await post_ap_approval(db, inv, created_by=current_user.user_id)
            elif posting_mode == "connected":
                await create_ap_posting_batch(db, inv)
            # Lite: no posting action
        except PostingError as e:
            raise HTTPException(status_code=422, detail=str(e))

    await db.commit()
    return _to_detail(await _reload_invoice(invoice_id, db))


@router.post("/invoices/{invoice_id}/reject", response_model=ApInvoiceDetail)
async def reject_invoice(
    invoice_id: uuid.UUID,
    body: ApRejectBody,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> ApInvoiceDetail:
    """
    Reject an AP invoice. Sends the invoice back to DRAFT for correction.

    The caller must be the assigned approver for the current pending step.
    """
    tenant_id = _tenant_id(current_user)
    inv = await _reload_invoice(invoice_id, db)
    if inv.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    if inv.status != "SUBMITTED":
        raise HTTPException(status_code=422, detail=f"Invoice is not awaiting approval. Status: {inv.status}")

    pending_result = await db.execute(
        select(ApApproval)
        .where(ApApproval.invoice_id == invoice_id, ApApproval.status == "PENDING")
        .order_by(ApApproval.step_order)
    )
    current_step = pending_result.scalars().first()
    if not current_step or current_step.approver_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="You are not assigned as the approver for the current step.")

    current_step.status = "REJECTED"
    current_step.action_at = datetime.now(timezone.utc)
    current_step.comment = body.reason

    inv.status = "REJECTED"
    inv.rejected_at = datetime.now(timezone.utc)
    inv.rejected_by = current_user.user_id
    inv.rejection_reason = body.reason

    await db.commit()
    return _to_detail(await _reload_invoice(invoice_id, db))


@router.post("/invoices/{invoice_id}/cancel", response_model=ApInvoiceDetail)
async def cancel_invoice(
    invoice_id: uuid.UUID,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> ApInvoiceDetail:
    """
    Cancel an AP invoice. Only DRAFT or SUBMITTED invoices can be cancelled.

    APPROVED invoices cannot be cancelled — they must be reversed via
    a credit memo once the GL posting is live.
    """
    tenant_id = _tenant_id(current_user)
    inv = await _reload_invoice(invoice_id, db)
    if inv.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    if inv.status not in ("DRAFT", "SUBMITTED"):
        raise HTTPException(
            status_code=422,
            detail=f"Only DRAFT or SUBMITTED invoices can be cancelled. Status: {inv.status}",
        )

    inv.status = "CANCELLED"
    inv.cancelled_at = datetime.now(timezone.utc)
    inv.cancelled_by = current_user.user_id

    await db.commit()
    return _to_detail(await _reload_invoice(invoice_id, db))


@router.post("/invoices/{invoice_id}/pay", response_model=ApInvoiceDetail)
async def pay_invoice(
    invoice_id: uuid.UUID,
    body: ApPayBody,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> ApInvoiceDetail:
    """
    Record payment against an APPROVED AP invoice.

    In Full ERP mode, creates a DR accounts_payable / CR bank GL journal entry.
    In Connected and Lite modes, records the payment metadata only.
    """
    tenant_id = _tenant_id(current_user)
    inv = await _reload_invoice(invoice_id, db)
    if inv.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    if inv.status != "APPROVED":
        raise HTTPException(status_code=422, detail=f"Only APPROVED invoices can be paid. Status: {inv.status}")

    payment_date = body.paid_at or date.today()

    try:
        if inv.posting_mode == "full_erp":
            await post_ap_payment(
                db,
                inv,
                payment_date=payment_date,
                bank_account_id=body.payment_bank_account_id,
                created_by=current_user.user_id,
            )
    except PostingError as e:
        raise HTTPException(status_code=422, detail=str(e))

    inv.status = "PAID"
    inv.paid_at = datetime.now(timezone.utc)
    inv.paid_by = current_user.user_id
    inv.payment_reference = body.payment_reference
    inv.payment_bank_account_id = body.payment_bank_account_id

    await db.commit()
    return _to_detail(await _reload_invoice(invoice_id, db))


# ═════════════════════════════════════════════════════════════════════════════
# REPORTS
# ═════════════════════════════════════════════════════════════════════════════

@router.get("/aging", response_model=ApAgingResponse)
async def ap_aging(
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
    as_at_date: Optional[date] = Query(None),
) -> ApAgingResponse:
    """
    AP Aging report — outstanding (APPROVED, unpaid) invoices grouped by vendor.

    Buckets: Current (not yet due), 1-30 days, 31-60 days, 61-90 days, 90+ days.
    as_at_date defaults to today.
    """
    tenant_id = _tenant_id(current_user)
    ref_date = as_at_date or date.today()

    result = await db.execute(
        select(ApInvoice)
        .options(selectinload(ApInvoice.vendor))
        .where(
            ApInvoice.tenant_id == tenant_id,
            ApInvoice.status == "APPROVED",
        )
    )
    invoices = result.scalars().all()

    # Group by vendor
    vendor_map: dict[uuid.UUID, ApAgingVendorRow] = {}

    for inv in invoices:
        vid = inv.vendor_id
        if vid not in vendor_map:
            vendor_map[vid] = ApAgingVendorRow(
                vendor_id=vid,
                vendor_code=inv.vendor.code if inv.vendor else "",
                vendor_name=inv.vendor.name if inv.vendor else "",
                current=Decimal("0"),
                days_1_30=Decimal("0"),
                days_31_60=Decimal("0"),
                days_61_90=Decimal("0"),
                days_90_plus=Decimal("0"),
                total=Decimal("0"),
            )
        row = vendor_map[vid]
        amt = inv.net_payable

        if inv.due_date is None or inv.due_date >= ref_date:
            row.current += amt
        else:
            days_overdue = (ref_date - inv.due_date).days
            if days_overdue <= 30:
                row.days_1_30 += amt
            elif days_overdue <= 60:
                row.days_31_60 += amt
            elif days_overdue <= 90:
                row.days_61_90 += amt
            else:
                row.days_90_plus += amt

        row.total += amt

    rows = sorted(vendor_map.values(), key=lambda r: r.vendor_name)

    return ApAgingResponse(
        as_at_date=ref_date,
        rows=rows,
        grand_current=sum(r.current for r in rows),
        grand_1_30=sum(r.days_1_30 for r in rows),
        grand_31_60=sum(r.days_31_60 for r in rows),
        grand_61_90=sum(r.days_61_90 for r in rows),
        grand_90_plus=sum(r.days_90_plus for r in rows),
        grand_total=sum(r.total for r in rows),
    )


@router.get("/invoices/export")
async def export_invoices(
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
    inv_status: Optional[str] = Query(None, alias="status"),
    fmt: str = Query("csv", alias="format", pattern="^(csv|xlsx)$"),
) -> Response:
    """
    Export AP invoices as CSV or Excel.

    Available in all modes (Lite, Connected, Full ERP).
    Filterable by status. Returns file download.
    """
    tenant_id = _tenant_id(current_user)
    q = (
        select(ApInvoice)
        .options(selectinload(ApInvoice.vendor))
        .where(ApInvoice.tenant_id == tenant_id)
        .order_by(ApInvoice.invoice_date.desc())
    )
    if inv_status:
        q = q.where(ApInvoice.status == inv_status.upper())
    result = await db.execute(q)
    invoices = result.scalars().all()

    headers_row = [
        "Reference", "Vendor Code", "Vendor Name", "Invoice Number",
        "Invoice Date", "Due Date", "Currency", "Total Amount (Base)",
        "Total VAT", "Total WHT", "Net Payable", "Status",
        "Submitted At", "Approved At", "Paid At",
    ]

    rows = []
    for inv in invoices:
        rows.append([
            inv.reference,
            inv.vendor.code if inv.vendor else "",
            inv.vendor.name if inv.vendor else "",
            inv.invoice_number,
            inv.invoice_date.isoformat(),
            inv.due_date.isoformat() if inv.due_date else "",
            inv.currency,
            float(inv.total_amount_base),
            float(inv.total_vat),
            float(inv.total_wht),
            float(inv.net_payable),
            inv.status,
            inv.submitted_at.isoformat() if inv.submitted_at else "",
            inv.approved_at.isoformat() if inv.approved_at else "",
            inv.paid_at.isoformat() if inv.paid_at else "",
        ])

    if fmt == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(headers_row)
        writer.writerows(rows)
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=ap_invoices.csv"},
        )

    # Excel
    try:
        import openpyxl
        from openpyxl.styles import Font
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="openpyxl not installed. Run `pip install openpyxl` to enable Excel export.",
        )

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "AP Invoices"
    ws.append(headers_row)
    for cell in ws[1]:
        cell.font = Font(bold=True)
    for row in rows:
        ws.append(row)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return Response(
        content=buf.read(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=ap_invoices.xlsx"},
    )
