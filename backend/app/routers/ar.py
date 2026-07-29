"""
Accounts Receivable (AR) router — M14.

Customer master CRUD and AR invoice lifecycle (DRAFT → SUBMITTED → APPROVED → RECEIVED).
Three-mode aware: Lite (workflow + export), Connected (+ posting_batches), Full ERP (+ GL journals).

Routes:
    Customers:
        GET    /api/ar/customers                  — list customers
        POST   /api/ar/customers                  — create customer
        GET    /api/ar/customers/{id}             — customer detail + outstanding balance
        PATCH  /api/ar/customers/{id}             — update customer

    Invoices:
        GET    /api/ar/invoices                   — list invoices (filterable)
        POST   /api/ar/invoices                   — create DRAFT invoice
        GET    /api/ar/invoices/{id}              — invoice detail (with lines + approvals)
        PUT    /api/ar/invoices/{id}              — update DRAFT invoice
        DELETE /api/ar/invoices/{id}              — delete DRAFT invoice
        POST   /api/ar/invoices/{id}/submit       — submit for approval
        POST   /api/ar/invoices/{id}/approve      — approver action: approve
        POST   /api/ar/invoices/{id}/reject       — approver action: reject
        POST   /api/ar/invoices/{id}/cancel       — cancel invoice
        POST   /api/ar/invoices/{id}/receive      — record receipt of customer payment

    Reports:
        GET    /api/ar/aging                      — AR aging by customer
        GET    /api/ar/invoices/export            — CSV/Excel export (all modes)
"""

import csv
import io
import logging
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import case, extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.middleware.auth import require_auth
from app.models.ar import (
    ArApproval, ArInvoice, ArInvoiceLine, ArInvoiceSnapshot, Customer,
)
from app.models.auth import User, UserTenant
from app.schemas.ar import (
    ArAgingBucket, ArAgingResponse, ArAgingRow,
    ArInvoiceCreate, ArInvoiceListItem, ArInvoiceReceiptRequest,
    ArInvoiceResponse, ArInvoiceSubmit, ArInvoiceUpdate,
    CustomerCreate, CustomerListItem, CustomerResponse, CustomerUpdate,
)
from app.services.ar_posting import (
    PostingError,
    create_ar_posting_batch,
    post_ar_approval,
    post_ar_receipt,
)
from app.services.approval_routing import (
    ApprovalChainHoldError,
    ApprovalRoutingError,
    ChainStep,
    compute_chain,
    get_policy,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ar", tags=["Accounts Receivable"])

# Approval policy module key for AR
_AR_MODULE = "receivable"


# ── Auth helpers ──────────────────────────────────────────────────────────────

def _tenant_id(user: UserTenant) -> uuid.UUID:
    """Return tenant_id or raise 400 if user has no tenant context."""
    tid = getattr(user, "tenant_id", None)
    if not tid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No tenant context.")
    return tid


# ── Reference sequence helpers ────────────────────────────────────────────────

async def _next_customer_code(db: AsyncSession, tenant_id: uuid.UUID) -> str:
    """Generate C-{NNNN:04d} customer code for this tenant."""
    result = await db.execute(
        select(func.count(Customer.id)).where(Customer.tenant_id == tenant_id)
    )
    n = result.scalar_one() or 0
    return f"C-{n + 1:04d}"


async def _next_ar_reference(db: AsyncSession, tenant_id: uuid.UUID, invoice_date: date) -> str:
    """Generate AR-{YYYY}-{NNNN:04d} reference for this tenant+year."""
    year = invoice_date.year
    result = await db.execute(
        select(func.count(ArInvoice.id)).where(
            ArInvoice.tenant_id == tenant_id,
            extract("year", ArInvoice.invoice_date) == year,
        )
    )
    n = result.scalar_one() or 0
    return f"AR-{year}-{n + 1:04d}"


def _compute_due_date(invoice_date: date, customer: Customer) -> Optional[date]:
    """
    Compute the due date from the customer's credit terms.

    Returns None if credit_terms is not set.
    """
    terms = customer.credit_terms
    if not terms:
        return None
    if terms == "immediate":
        return invoice_date
    if terms == "net_30":
        return invoice_date + timedelta(days=30)
    if terms == "net_60":
        return invoice_date + timedelta(days=60)
    if terms == "net_90":
        return invoice_date + timedelta(days=90)
    if terms == "custom" and customer.credit_terms_days:
        return invoice_date + timedelta(days=customer.credit_terms_days)
    return None


# ── Line computation ──────────────────────────────────────────────────────────

def _compute_line(line_in, exchange_rate: Decimal) -> dict:
    """
    Derive stored amounts from the input line fields.

    amount_base        = amount_foreign * exchange_rate
    vat_amount         = amount_base * vat_rate   (if vat_applicable)
    wht_amount         = amount_base * wht_rate   (if wht_applicable)
    net_receivable_line = amount_base + vat_amount - wht_amount
      (VAT increases what the customer owes; WHT reduces what we actually receive)
    """
    amount_foreign = line_in.amount_foreign
    amount_base = (amount_foreign * exchange_rate).quantize(Decimal("0.01"))
    vat_amount = (amount_base * line_in.vat_rate).quantize(Decimal("0.01")) if line_in.vat_applicable else Decimal("0")
    wht_amount = (amount_base * line_in.wht_rate).quantize(Decimal("0.01")) if line_in.wht_applicable else Decimal("0")
    net_receivable_line = amount_base + vat_amount - wht_amount

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
        "net_receivable_line": net_receivable_line,
        "category_hint": line_in.category_hint,
    }


def _recompute_totals(invoice: ArInvoice) -> None:
    """Recalculate header totals from lines (called after line upsert)."""
    invoice.total_amount_foreign = sum(ln.amount_foreign for ln in invoice.lines)
    invoice.total_amount_base = sum(ln.amount_base for ln in invoice.lines)
    invoice.total_vat = sum(ln.vat_amount for ln in invoice.lines)
    invoice.total_wht = sum(ln.wht_amount for ln in invoice.lines)
    invoice.net_receivable = sum(ln.net_receivable_line for ln in invoice.lines)


# ── Snapshot helper ───────────────────────────────────────────────────────────

def _build_snapshot(invoice: ArInvoice) -> dict:
    """Serialise the full invoice to a JSONB-safe dict at submission time."""
    return {
        "reference": invoice.reference,
        "invoice_number": invoice.invoice_number,
        "customer_id": str(invoice.customer_id),
        "invoice_date": invoice.invoice_date.isoformat(),
        "due_date": invoice.due_date.isoformat() if invoice.due_date else None,
        "service_period_start": invoice.service_period_start.isoformat() if invoice.service_period_start else None,
        "service_period_end": invoice.service_period_end.isoformat() if invoice.service_period_end else None,
        "currency": invoice.currency,
        "exchange_rate": str(invoice.exchange_rate),
        "total_amount_foreign": str(invoice.total_amount_foreign),
        "total_amount_base": str(invoice.total_amount_base),
        "total_vat": str(invoice.total_vat),
        "total_wht": str(invoice.total_wht),
        "net_receivable": str(invoice.net_receivable),
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
                "net_receivable_line": str(ln.net_receivable_line),
            }
            for ln in invoice.lines
        ],
    }


# ── Reload helper ─────────────────────────────────────────────────────────────

async def _reload_invoice(invoice_id: uuid.UUID, db: AsyncSession) -> ArInvoice:
    """Reload an AR invoice with all relationships (customer, lines, approvals)."""
    result = await db.execute(
        select(ArInvoice)
        .options(
            selectinload(ArInvoice.customer),
            selectinload(ArInvoice.lines),
            selectinload(ArInvoice.approvals),
        )
        .where(ArInvoice.id == invoice_id)
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    return inv


def _to_response(invoice: ArInvoice) -> ArInvoiceResponse:
    """Build ArInvoiceResponse, injecting customer name from relationship."""
    customer = invoice.customer
    return ArInvoiceResponse(
        id=invoice.id,
        reference=invoice.reference,
        invoice_number=invoice.invoice_number,
        customer_id=invoice.customer_id,
        customer_name=customer.name if customer else "",
        customer_code=customer.code if customer else "",
        invoice_date=invoice.invoice_date,
        due_date=invoice.due_date,
        service_period_start=invoice.service_period_start,
        service_period_end=invoice.service_period_end,
        currency=invoice.currency,
        exchange_rate=invoice.exchange_rate,
        total_amount_foreign=invoice.total_amount_foreign,
        total_amount_base=invoice.total_amount_base,
        total_vat=invoice.total_vat,
        total_wht=invoice.total_wht,
        net_receivable=invoice.net_receivable,
        description=invoice.description,
        status=invoice.status,
        posting_mode=invoice.posting_mode,
        duplicate_flag=invoice.duplicate_flag,
        submitted_at=invoice.submitted_at,
        approved_at=invoice.approved_at,
        rejected_at=invoice.rejected_at,
        rejection_reason=invoice.rejection_reason,
        received_at=invoice.received_at,
        receipt_reference=invoice.receipt_reference,
        journal_entry_id=invoice.journal_entry_id,
        receipt_journal_entry_id=invoice.receipt_journal_entry_id,
        posting_batch_id=invoice.posting_batch_id,
        created_at=invoice.created_at,
        lines=[],
        approvals=[],
    )


# ═════════════════════════════════════════════════════════════════════════════
# CUSTOMER ENDPOINTS
# ═════════════════════════════════════════════════════════════════════════════

@router.get("/customers", response_model=list[CustomerListItem])
async def list_customers(
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
    include_inactive: bool = Query(False),
    search: Optional[str] = Query(None),
) -> list[CustomerListItem]:
    """
    List customers for the tenant.

    Parameters:
        include_inactive — include deactivated customers (default: False)
        search           — filter by name or code (case-insensitive substring)
    """
    tenant_id = _tenant_id(current_user)
    q = select(Customer).where(Customer.tenant_id == tenant_id)
    if not include_inactive:
        q = q.where(Customer.is_active.is_(True))
    if search:
        q = q.where(Customer.name.ilike(f"%{search}%") | Customer.code.ilike(f"%{search}%"))
    q = q.order_by(Customer.name)
    customers = (await db.execute(q)).scalars().all()

    # Compute outstanding balance per customer (sum of net_receivable on APPROVED invoices)
    balance_q = (
        select(ArInvoice.customer_id, func.sum(ArInvoice.net_receivable))
        .where(
            ArInvoice.tenant_id == tenant_id,
            ArInvoice.status == "APPROVED",
        )
        .group_by(ArInvoice.customer_id)
    )
    balance_rows = (await db.execute(balance_q)).all()
    balance_map: dict[uuid.UUID, Decimal] = {
        row[0]: Decimal(str(row[1])) for row in balance_rows
    }

    return [
        CustomerListItem(
            id=c.id,
            code=c.code,
            name=c.name,
            customer_type=c.customer_type,
            email=c.email,
            is_active=c.is_active,
            outstanding_balance=balance_map.get(c.id, Decimal("0")),
            credit_limit=c.credit_limit,
        )
        for c in customers
    ]


@router.post("/customers", response_model=CustomerResponse, status_code=201)
async def create_customer(
    body: CustomerCreate,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> CustomerResponse:
    """
    Create a new customer master record.

    code is auto-generated as C-{NNNN} if not supplied.
    """
    tenant_id = _tenant_id(current_user)
    code = body.code or await _next_customer_code(db, tenant_id)

    customer = Customer(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        code=code,
        **{k: v for k, v in body.model_dump(exclude={"code"}).items()},
    )
    db.add(customer)
    await db.commit()
    await db.refresh(customer)
    return CustomerResponse.model_validate(customer)


@router.get("/customers/{customer_id}", response_model=CustomerResponse)
async def get_customer(
    customer_id: uuid.UUID,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> CustomerResponse:
    """Get a customer detail including outstanding balance."""
    tenant_id = _tenant_id(current_user)
    result = await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.tenant_id == tenant_id)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found.")

    balance_q = select(func.coalesce(func.sum(ArInvoice.net_receivable), 0)).where(
        ArInvoice.tenant_id == tenant_id,
        ArInvoice.customer_id == customer_id,
        ArInvoice.status == "APPROVED",
    )
    outstanding = Decimal(str((await db.execute(balance_q)).scalar_one()))

    resp = CustomerResponse.model_validate(customer)
    resp.outstanding_balance = outstanding
    return resp


@router.patch("/customers/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    customer_id: uuid.UUID,
    body: CustomerUpdate,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> CustomerResponse:
    """Update a customer record (PATCH semantics — only provided fields are changed)."""
    tenant_id = _tenant_id(current_user)
    result = await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.tenant_id == tenant_id)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found.")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(customer, field, value)

    await db.commit()
    await db.refresh(customer)
    return CustomerResponse.model_validate(customer)


# ═════════════════════════════════════════════════════════════════════════════
# INVOICE ENDPOINTS
# ═════════════════════════════════════════════════════════════════════════════

@router.get("/invoices/export")
async def export_ar_invoices(
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
    format: str = Query("csv", pattern="^(csv|xlsx)$"),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
) -> Response:
    """
    Export AR invoices as CSV or Excel (all modes).

    Parameters:
        format       — 'csv' or 'xlsx'
        from_date    — filter by invoice_date (inclusive)
        to_date      — filter by invoice_date (inclusive)
        status       — filter by status (e.g. 'APPROVED')
    """
    tenant_id = _tenant_id(current_user)

    q = (
        select(ArInvoice)
        .options(selectinload(ArInvoice.customer), selectinload(ArInvoice.lines))
        .where(ArInvoice.tenant_id == tenant_id)
        .order_by(ArInvoice.invoice_date.desc())
    )
    if from_date:
        q = q.where(ArInvoice.invoice_date >= from_date)
    if to_date:
        q = q.where(ArInvoice.invoice_date <= to_date)
    if status_filter:
        q = q.where(ArInvoice.status == status_filter.upper())

    invoices = (await db.execute(q)).scalars().all()

    # Build rows
    headers = [
        "Reference", "Invoice Number", "Customer Code", "Customer Name",
        "Invoice Date", "Due Date", "Currency", "Total (Base)",
        "VAT", "WHT", "Net Receivable", "Status",
    ]

    def _safe(v: str) -> str:
        """Prevent CSV formula injection."""
        if v and v[0] in ("=", "+", "-", "@"):
            return "'" + v
        return v

    rows = []
    for inv in invoices:
        cust = inv.customer
        rows.append([
            _safe(inv.reference),
            _safe(inv.invoice_number),
            _safe(cust.code if cust else ""),
            _safe(cust.name if cust else ""),
            inv.invoice_date.isoformat(),
            inv.due_date.isoformat() if inv.due_date else "",
            inv.currency,
            str(inv.total_amount_base),
            str(inv.total_vat),
            str(inv.total_wht),
            str(inv.net_receivable),
            inv.status,
        ])

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(headers)
        writer.writerows(rows)
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=ar_invoices.csv"},
        )
    else:
        try:
            import openpyxl
            from openpyxl.styles import Font
        except ImportError:
            raise HTTPException(status_code=500, detail="openpyxl not installed.")

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "AR Invoices"
        ws.append(headers)
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
            headers={"Content-Disposition": "attachment; filename=ar_invoices.xlsx"},
        )


@router.get("/invoices", response_model=list[ArInvoiceListItem])
async def list_ar_invoices(
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
    status_filter: Optional[str] = Query(None, alias="status"),
    customer_id: Optional[uuid.UUID] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> list[ArInvoiceListItem]:
    """
    List AR invoices for the tenant (paginated).

    Parameters:
        status      — filter by status ('DRAFT','SUBMITTED','APPROVED',etc.)
        customer_id — filter by customer
        limit       — page size (default 50, max 200)
        offset      — page offset
    """
    tenant_id = _tenant_id(current_user)
    today = date.today()

    q = (
        select(ArInvoice)
        .options(selectinload(ArInvoice.customer))
        .where(ArInvoice.tenant_id == tenant_id)
        .order_by(ArInvoice.invoice_date.desc())
        .limit(limit)
        .offset(offset)
    )
    if status_filter:
        q = q.where(ArInvoice.status == status_filter.upper())
    if customer_id:
        q = q.where(ArInvoice.customer_id == customer_id)

    invoices = (await db.execute(q)).scalars().all()

    items = []
    for inv in invoices:
        cust = inv.customer
        # Compute days_overdue for APPROVED invoices with a due_date in the past
        days_overdue = None
        if inv.status == "APPROVED" and inv.due_date and inv.due_date < today:
            days_overdue = (today - inv.due_date).days

        items.append(ArInvoiceListItem(
            id=inv.id,
            reference=inv.reference,
            invoice_number=inv.invoice_number,
            customer_id=inv.customer_id,
            customer_name=cust.name if cust else "",
            customer_code=cust.code if cust else "",
            invoice_date=inv.invoice_date,
            due_date=inv.due_date,
            currency=inv.currency,
            total_amount_base=inv.total_amount_base,
            net_receivable=inv.net_receivable,
            status=inv.status,
            duplicate_flag=inv.duplicate_flag,
            days_overdue=days_overdue,
        ))
    return items


@router.post("/invoices", response_model=ArInvoiceResponse, status_code=201)
async def create_ar_invoice(
    body: ArInvoiceCreate,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> ArInvoiceResponse:
    """
    Create a new DRAFT AR invoice with lines.

    due_date is computed from the customer's credit_terms if not supplied.
    Duplicate detection: same (tenant_id, customer_id, invoice_number) with a
    non-cancelled/rejected status sets duplicate_flag = True (not blocked).
    """
    tenant_id = _tenant_id(current_user)

    # Load customer (validates customer belongs to this tenant)
    cust_result = await db.execute(
        select(Customer).where(Customer.id == body.customer_id, Customer.tenant_id == tenant_id)
    )
    customer = cust_result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found.")
    if not customer.is_active:
        raise HTTPException(status_code=422, detail="Cannot create an invoice for an inactive customer.")

    reference = await _next_ar_reference(db, tenant_id, body.invoice_date)

    # Duplicate detection
    dup_result = await db.execute(
        select(func.count(ArInvoice.id)).where(
            ArInvoice.tenant_id == tenant_id,
            ArInvoice.customer_id == body.customer_id,
            ArInvoice.invoice_number == body.invoice_number,
            ArInvoice.status.notin_(["CANCELLED", "REJECTED"]),
        )
    )
    duplicate_flag = (dup_result.scalar_one() or 0) > 0

    # Compute due_date if not provided
    due_date = body.due_date or _compute_due_date(body.invoice_date, customer)

    invoice = ArInvoice(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        customer_id=body.customer_id,
        reference=reference,
        invoice_number=body.invoice_number,
        invoice_date=body.invoice_date,
        due_date=due_date,
        service_period_start=body.service_period_start,
        service_period_end=body.service_period_end,
        currency=body.currency,
        exchange_rate=body.exchange_rate,
        description=body.description,
        status="DRAFT",
        duplicate_flag=duplicate_flag,
        created_by=current_user.user_id if hasattr(current_user, "user_id") else None,
    )
    db.add(invoice)
    await db.flush()

    # Add lines
    for line_in in body.lines:
        computed = _compute_line(line_in, body.exchange_rate)
        db.add(ArInvoiceLine(id=uuid.uuid4(), invoice_id=invoice.id, **computed))

    await db.flush()

    # Load lines and recompute header totals
    lines_result = await db.execute(
        select(ArInvoiceLine).where(ArInvoiceLine.invoice_id == invoice.id).order_by(ArInvoiceLine.line_number)
    )
    invoice.lines = list(lines_result.scalars().all())
    _recompute_totals(invoice)

    await db.commit()

    inv = await _reload_invoice(invoice.id, db)
    resp = _to_response(inv)
    resp.lines = [l for l in resp.lines] if False else []  # empty list - use detail endpoint
    return resp


@router.get("/invoices/{invoice_id}", response_model=ArInvoiceResponse)
async def get_ar_invoice(
    invoice_id: uuid.UUID,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> ArInvoiceResponse:
    """Get AR invoice detail with lines and approval trail."""
    tenant_id = _tenant_id(current_user)
    inv = await _reload_invoice(invoice_id, db)
    if inv.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Invoice not found.")

    from app.schemas.ar import ArInvoiceLineOut, ArApprovalOut
    resp = _to_response(inv)
    resp.lines = [ArInvoiceLineOut.model_validate(ln) for ln in inv.lines]
    resp.approvals = [ArApprovalOut.model_validate(a) for a in inv.approvals]
    return resp


@router.put("/invoices/{invoice_id}", response_model=ArInvoiceResponse)
async def update_ar_invoice(
    invoice_id: uuid.UUID,
    body: ArInvoiceUpdate,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> ArInvoiceResponse:
    """
    Replace a DRAFT AR invoice (PUT semantics — replaces all lines if provided).

    Only allowed when status is DRAFT.
    """
    tenant_id = _tenant_id(current_user)
    inv = await _reload_invoice(invoice_id, db)
    if inv.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    if inv.status != "DRAFT":
        raise HTTPException(status_code=422, detail="Only DRAFT invoices can be updated.")

    update_data = body.model_dump(exclude_unset=True, exclude={"lines"})
    for field, value in update_data.items():
        setattr(inv, field, value)

    exchange_rate = inv.exchange_rate

    if body.lines is not None:
        # Replace all lines
        for old_line in list(inv.lines):
            await db.delete(old_line)
        await db.flush()

        for line_in in body.lines:
            computed = _compute_line(line_in, exchange_rate)
            db.add(ArInvoiceLine(id=uuid.uuid4(), invoice_id=inv.id, **computed))

        await db.flush()
        lines_result = await db.execute(
            select(ArInvoiceLine).where(ArInvoiceLine.invoice_id == inv.id).order_by(ArInvoiceLine.line_number)
        )
        inv.lines = list(lines_result.scalars().all())
        _recompute_totals(inv)

    await db.commit()
    inv = await _reload_invoice(invoice_id, db)
    return _to_response(inv)


@router.delete("/invoices/{invoice_id}", status_code=204)
async def delete_ar_invoice(
    invoice_id: uuid.UUID,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a DRAFT AR invoice. Only DRAFT invoices can be deleted."""
    tenant_id = _tenant_id(current_user)
    result = await db.execute(
        select(ArInvoice).where(ArInvoice.id == invoice_id, ArInvoice.tenant_id == tenant_id)
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    if inv.status != "DRAFT":
        raise HTTPException(status_code=422, detail="Only DRAFT invoices can be deleted.")
    await db.delete(inv)
    await db.commit()


@router.post("/invoices/{invoice_id}/submit", response_model=ArInvoiceResponse)
async def submit_ar_invoice(
    invoice_id: uuid.UUID,
    body: ArInvoiceSubmit,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> ArInvoiceResponse:
    """
    Submit an AR invoice for approval.

    Approval chain is built from the 'receivable' policy on this tenant.
    If no policy exists and selected_approver_id is provided, that approver
    is used as a single-step manual chain.
    """
    tenant_id = _tenant_id(current_user)
    inv = await _reload_invoice(invoice_id, db)
    if inv.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    if inv.status != "DRAFT":
        raise HTTPException(status_code=422, detail="Only DRAFT invoices can be submitted.")
    if not inv.lines:
        raise HTTPException(status_code=422, detail="Cannot submit an invoice with no lines.")

    # Determine posting_mode for this submission
    from app.models.setup import TenantOrgConfig
    org_result = await db.execute(
        select(TenantOrgConfig.posting_mode).where(TenantOrgConfig.tenant_id == tenant_id)
    )
    posting_mode = (org_result.scalar_one_or_none()) or "lite"

    # Build approval chain
    chain_steps: list[ChainStep] = []
    submitter_user_id = getattr(current_user, "user_id", None)

    try:
        policy = await get_policy(_AR_MODULE, tenant_id, db)
        if policy:
            chain_steps = await compute_chain(
                module=_AR_MODULE,
                submitter_user_id=submitter_user_id,
                total_amount=float(inv.net_receivable),
                db=db,
                tenant_id=tenant_id,
            )
    except (ApprovalRoutingError, ApprovalChainHoldError) as exc:
        logger.warning("AR approval routing failed for invoice %s: %s", invoice_id, exc)
        chain_steps = []

    # Fallback to manual approver
    if not chain_steps and body.selected_approver_id:
        chain_steps = [ChainStep(
            level=1,
            approver_user_id=body.selected_approver_id,
            is_advisory=False,
        )]

    if not chain_steps:
        raise HTTPException(
            status_code=422,
            detail="No approval chain configured for AR invoices and no approver selected. "
                   "Set up an approval policy for 'receivable' or select an approver manually.",
        )

    # Write snapshot
    now = datetime.now(timezone.utc)
    inv.status = "SUBMITTED"
    inv.submitted_at = now
    inv.submitted_by = submitter_user_id
    inv.posting_mode = posting_mode

    db.add(ArInvoiceSnapshot(
        id=uuid.uuid4(),
        invoice_id=inv.id,
        snapshot_data=_build_snapshot(inv),
    ))

    # Create approval steps
    for step in chain_steps:
        db.add(ArApproval(
            id=uuid.uuid4(),
            invoice_id=inv.id,
            tenant_id=tenant_id,
            step_order=step.level,
            approver_id=step.approver_user_id,
            status="PENDING",
            is_advisory=step.is_advisory,
        ))

    await db.commit()
    inv = await _reload_invoice(invoice_id, db)
    return _to_response(inv)


@router.post("/invoices/{invoice_id}/approve", response_model=ArInvoiceResponse)
async def approve_ar_invoice(
    invoice_id: uuid.UUID,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
    comment: Optional[str] = None,
) -> ArInvoiceResponse:
    """
    Approve the current pending step on an AR invoice.

    When the final mandatory step is approved, the invoice moves to APPROVED and
    GL posting is triggered (Full ERP) or a posting_batch is created (Connected).
    """
    tenant_id = _tenant_id(current_user)
    inv = await _reload_invoice(invoice_id, db)
    if inv.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    if inv.status != "SUBMITTED":
        raise HTTPException(status_code=422, detail="Only SUBMITTED invoices can be approved.")

    approver_user_id = getattr(current_user, "user_id", None)

    # Find the pending step assigned to this approver
    pending = next(
        (a for a in inv.approvals if a.status == "PENDING" and a.approver_id == approver_user_id),
        None,
    )
    if not pending:
        raise HTTPException(status_code=403, detail="No pending approval step assigned to you for this invoice.")

    now = datetime.now(timezone.utc)
    pending.status = "APPROVED"
    pending.action_at = now
    pending.comment = comment

    # Check if all mandatory steps are approved
    all_mandatory_approved = all(
        a.status in ("APPROVED", "SKIPPED") or a.is_advisory
        for a in inv.approvals
    )

    if all_mandatory_approved:
        inv.status = "APPROVED"
        inv.approved_at = now
        inv.approved_by = approver_user_id

        # GL posting
        try:
            if inv.posting_mode == "full_erp":
                await post_ar_approval(db, inv, created_by=approver_user_id)
            elif inv.posting_mode == "connected":
                await create_ar_posting_batch(db, inv)
        except PostingError as exc:
            raise HTTPException(
                status_code=422,
                detail=f"Posting failed: {exc.args[1] if len(exc.args) > 1 else str(exc)}",
            )

    await db.commit()
    return _to_response(await _reload_invoice(invoice_id, db))


@router.post("/invoices/{invoice_id}/reject", response_model=ArInvoiceResponse)
async def reject_ar_invoice(
    invoice_id: uuid.UUID,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
    rejection_reason: str = "",
) -> ArInvoiceResponse:
    """
    Reject an AR invoice.

    Moves the invoice back to DRAFT (allowing correction and resubmission).
    rejection_reason should explain why the invoice was rejected.
    """
    tenant_id = _tenant_id(current_user)
    inv = await _reload_invoice(invoice_id, db)
    if inv.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    if inv.status != "SUBMITTED":
        raise HTTPException(status_code=422, detail="Only SUBMITTED invoices can be rejected.")

    approver_user_id = getattr(current_user, "user_id", None)
    pending = next(
        (a for a in inv.approvals if a.status == "PENDING" and a.approver_id == approver_user_id),
        None,
    )
    if not pending:
        raise HTTPException(status_code=403, detail="No pending approval step assigned to you for this invoice.")

    now = datetime.now(timezone.utc)
    pending.status = "REJECTED"
    pending.action_at = now

    inv.status = "REJECTED"
    inv.rejected_at = now
    inv.rejected_by = approver_user_id
    inv.rejection_reason = rejection_reason

    await db.commit()
    return _to_response(await _reload_invoice(invoice_id, db))


@router.post("/invoices/{invoice_id}/cancel", response_model=ArInvoiceResponse)
async def cancel_ar_invoice(
    invoice_id: uuid.UUID,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> ArInvoiceResponse:
    """Cancel a DRAFT or SUBMITTED AR invoice."""
    tenant_id = _tenant_id(current_user)
    inv = await _reload_invoice(invoice_id, db)
    if inv.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    if inv.status not in ("DRAFT", "SUBMITTED"):
        raise HTTPException(status_code=422, detail="Only DRAFT or SUBMITTED invoices can be cancelled.")

    inv.status = "CANCELLED"
    inv.cancelled_at = datetime.now(timezone.utc)
    inv.cancelled_by = getattr(current_user, "user_id", None)

    await db.commit()
    return _to_response(await _reload_invoice(invoice_id, db))


@router.post("/invoices/{invoice_id}/receive", response_model=ArInvoiceResponse)
async def receive_ar_payment(
    invoice_id: uuid.UUID,
    body: ArInvoiceReceiptRequest,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> ArInvoiceResponse:
    """
    Record receipt of payment from a customer.

    Only APPROVED invoices can be receipted. In Full ERP mode this posts:
      DR bank GL / CR accounts_receivable
    """
    tenant_id = _tenant_id(current_user)
    inv = await _reload_invoice(invoice_id, db)
    if inv.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    if inv.status != "APPROVED":
        raise HTTPException(status_code=422, detail="Only APPROVED invoices can be marked as received.")

    now = datetime.now(timezone.utc)
    user_id = getattr(current_user, "user_id", None)

    inv.received_at = now
    inv.received_by = user_id
    inv.receipt_reference = body.receipt_reference
    inv.receipt_bank_account_id = body.bank_account_id
    inv.status = "RECEIVED"

    try:
        if inv.posting_mode == "full_erp":
            await post_ar_receipt(
                db, inv,
                receipt_date=body.receipt_date,
                bank_account_id=body.bank_account_id,
                created_by=user_id,
            )
    except PostingError as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Receipt posting failed: {exc.args[1] if len(exc.args) > 1 else str(exc)}",
        )

    await db.commit()
    return _to_response(await _reload_invoice(invoice_id, db))


# ═════════════════════════════════════════════════════════════════════════════
# AGING REPORT
# ═════════════════════════════════════════════════════════════════════════════

@router.get("/aging", response_model=ArAgingResponse)
async def ar_aging(
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
    as_at_date: Optional[date] = Query(None),
) -> ArAgingResponse:
    """
    AR Aging report — outstanding receivables bucketed by days overdue.

    Buckets: Current (not yet due), 1–30, 31–60, 61–90, 90+ days.
    Only considers APPROVED invoices (not yet received).

    Parameters:
        as_at_date — date to compute aging against (default: today)
    """
    tenant_id = _tenant_id(current_user)
    as_at = as_at_date or date.today()

    q = (
        select(ArInvoice)
        .options(selectinload(ArInvoice.customer))
        .where(
            ArInvoice.tenant_id == tenant_id,
            ArInvoice.status == "APPROVED",
        )
    )
    invoices = (await db.execute(q)).scalars().all()

    # Group by customer
    rows_map: dict[uuid.UUID, ArAgingRow] = {}
    for inv in invoices:
        cid = inv.customer_id
        if cid not in rows_map:
            cust = inv.customer
            rows_map[cid] = ArAgingRow(
                customer_id=cid,
                customer_code=cust.code if cust else "",
                customer_name=cust.name if cust else "",
                buckets=ArAgingBucket(),
                invoice_count=0,
            )

        row = rows_map[cid]
        row.invoice_count += 1
        amt = inv.net_receivable

        due = inv.due_date
        if due is None or due >= as_at:
            row.buckets.current += amt
        else:
            days = (as_at - due).days
            if days <= 30:
                row.buckets.days_1_30 += amt
            elif days <= 60:
                row.buckets.days_31_60 += amt
            elif days <= 90:
                row.buckets.days_61_90 += amt
            else:
                row.buckets.days_over_90 += amt

        row.buckets.total += amt

    # Compute totals across all customers
    totals = ArAgingBucket()
    for row in rows_map.values():
        totals.current += row.buckets.current
        totals.days_1_30 += row.buckets.days_1_30
        totals.days_31_60 += row.buckets.days_31_60
        totals.days_61_90 += row.buckets.days_61_90
        totals.days_over_90 += row.buckets.days_over_90
        totals.total += row.buckets.total

    rows = sorted(rows_map.values(), key=lambda r: r.customer_name)
    return ArAgingResponse(as_at_date=as_at, rows=rows, totals=totals)
