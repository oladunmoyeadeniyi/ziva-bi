"""
Tax Engine router — M19 (transaction level).

Routes:
    Tax summary (computed on-the-fly):
        GET /api/tax/vat-summary    — VAT output vs input for a period
        GET /api/tax/wht-summary    — WHT deducted for a period

    Tax returns:
        GET    /api/tax/returns              — list tax returns
        POST   /api/tax/returns              — create return (auto-computes totals)
        GET    /api/tax/returns/{id}         — get return with detail
        PUT    /api/tax/returns/{id}         — update (filing ref, payment)
        POST   /api/tax/returns/{id}/file    — mark as FILED
        POST   /api/tax/returns/{id}/accept  — mark as ACCEPTED

    WHT Certificates:
        GET    /api/tax/wht-certificates           — list certificates
        POST   /api/tax/wht-certificates           — create certificate
        GET    /api/tax/wht-certificates/{id}      — get one
"""

import uuid
import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import require_auth
from app.models.auth import UserTenant
from app.models.tax_engine import TaxReturn, WhtCertificate
from app.schemas.tax_engine import (
    TaxReturnCreate,
    TaxReturnResponse,
    TaxReturnUpdate,
    VatSummaryResponse,
    WhtCertificateCreate,
    WhtCertificateResponse,
    WhtSummaryResponse,
)
from app.services.tax_compute_service import build_vat_summary, build_wht_summary

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tax", tags=["Tax Engine"])


def _tenant_id(user: UserTenant) -> uuid.UUID:
    tid = getattr(user, "tenant_id", None)
    if not tid:
        raise HTTPException(status_code=400, detail="No tenant context.")
    return tid


async def _next_cert_number(db: AsyncSession, tenant_id: uuid.UUID) -> str:
    """Generate WHT-{YYYY}-{NNNN:04d} certificate number."""
    from sqlalchemy import func, extract
    year = date.today().year
    result = await db.execute(
        select(func.count(WhtCertificate.id)).where(
            WhtCertificate.tenant_id == tenant_id,
        )
    )
    n = result.scalar_one() or 0
    return f"WHT-{year}-{n + 1:04d}"


# ── VAT Summary ───────────────────────────────────────────────────────────────

@router.get("/vat-summary", response_model=VatSummaryResponse)
async def get_vat_summary(
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
    period_start: date = Query(...),
    period_end: date = Query(...),
) -> VatSummaryResponse:
    """Compute VAT output vs input for a given period."""
    tenant_id = _tenant_id(current_user)
    summary = await build_vat_summary(db, tenant_id, period_start, period_end)
    return VatSummaryResponse(**summary)


# ── WHT Summary ───────────────────────────────────────────────────────────────

@router.get("/wht-summary", response_model=WhtSummaryResponse)
async def get_wht_summary(
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
    period_start: date = Query(...),
    period_end: date = Query(...),
) -> WhtSummaryResponse:
    """Compute WHT deducted for a given period."""
    tenant_id = _tenant_id(current_user)
    summary = await build_wht_summary(db, tenant_id, period_start, period_end)
    return WhtSummaryResponse(**summary)


# ── Tax Returns ────────────────────────────────────────────────────────────────

@router.get("/returns", response_model=list[TaxReturnResponse])
async def list_tax_returns(
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
    tax_type: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
) -> list[TaxReturnResponse]:
    """List tax returns for the tenant."""
    tenant_id = _tenant_id(current_user)
    q = select(TaxReturn).where(TaxReturn.tenant_id == tenant_id)
    if tax_type:
        q = q.where(TaxReturn.tax_type == tax_type.upper())
    if status_filter:
        q = q.where(TaxReturn.status == status_filter.upper())
    q = q.order_by(TaxReturn.period_start.desc())
    result = await db.execute(q)
    returns = result.scalars().all()
    return [TaxReturnResponse.model_validate(r) for r in returns]


@router.post("/returns", response_model=TaxReturnResponse, status_code=status.HTTP_201_CREATED)
async def create_tax_return(
    body: TaxReturnCreate,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> TaxReturnResponse:
    """
    Create a tax return and auto-compute totals from transaction data.
    """
    tenant_id = _tenant_id(current_user)

    # Auto-compute totals
    total_collected = Decimal("0")
    total_paid = Decimal("0")
    line_detail: dict = {}

    if body.tax_type == "VAT":
        summary = await build_vat_summary(db, tenant_id, body.period_start, body.period_end)
        total_collected = summary["output_vat"]
        total_paid = summary["input_vat"]
        line_detail = {k: str(v) if isinstance(v, Decimal) else v for k, v in summary.items()}
    elif body.tax_type == "WHT":
        summary = await build_wht_summary(db, tenant_id, body.period_start, body.period_end)
        total_collected = summary["total_wht_deducted"]
        total_paid = Decimal("0")
        line_detail = {k: str(v) if isinstance(v, Decimal) else v for k, v in summary.items()}

    net_payable = total_collected - total_paid

    tax_return = TaxReturn(
        tenant_id=tenant_id,
        tax_type=body.tax_type,
        period_start=body.period_start,
        period_end=body.period_end,
        filing_deadline=body.filing_deadline,
        status="DRAFT",
        total_tax_collected=total_collected,
        total_tax_paid=total_paid,
        net_payable=net_payable,
        notes=body.notes,
        line_detail=line_detail,
    )
    db.add(tax_return)
    await db.commit()
    await db.refresh(tax_return)
    return TaxReturnResponse.model_validate(tax_return)


@router.get("/returns/{return_id}", response_model=TaxReturnResponse)
async def get_tax_return(
    return_id: uuid.UUID,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> TaxReturnResponse:
    """Get a tax return by ID."""
    tenant_id = _tenant_id(current_user)
    result = await db.execute(
        select(TaxReturn).where(TaxReturn.id == return_id, TaxReturn.tenant_id == tenant_id)
    )
    tax_return = result.scalar_one_or_none()
    if not tax_return:
        raise HTTPException(status_code=404, detail="Tax return not found.")
    return TaxReturnResponse.model_validate(tax_return)


@router.put("/returns/{return_id}", response_model=TaxReturnResponse)
async def update_tax_return(
    return_id: uuid.UUID,
    body: TaxReturnUpdate,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> TaxReturnResponse:
    """Update tax return (filing reference, payment details)."""
    tenant_id = _tenant_id(current_user)
    result = await db.execute(
        select(TaxReturn).where(TaxReturn.id == return_id, TaxReturn.tenant_id == tenant_id)
    )
    tax_return = result.scalar_one_or_none()
    if not tax_return:
        raise HTTPException(status_code=404, detail="Tax return not found.")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(tax_return, k, v)
    await db.commit()
    await db.refresh(tax_return)
    return TaxReturnResponse.model_validate(tax_return)


@router.post("/returns/{return_id}/file", response_model=TaxReturnResponse)
async def file_tax_return(
    return_id: uuid.UUID,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> TaxReturnResponse:
    """Mark a DRAFT tax return as FILED."""
    tenant_id = _tenant_id(current_user)
    result = await db.execute(
        select(TaxReturn).where(TaxReturn.id == return_id, TaxReturn.tenant_id == tenant_id)
    )
    tax_return = result.scalar_one_or_none()
    if not tax_return:
        raise HTTPException(status_code=404, detail="Tax return not found.")
    if tax_return.status != "DRAFT":
        raise HTTPException(status_code=400, detail=f"Cannot file a {tax_return.status} return.")
    tax_return.status = "FILED"
    tax_return.filed_at = datetime.now(timezone.utc)
    tax_return.filed_by_id = current_user.user_id
    await db.commit()
    await db.refresh(tax_return)
    return TaxReturnResponse.model_validate(tax_return)


@router.post("/returns/{return_id}/accept", response_model=TaxReturnResponse)
async def accept_tax_return(
    return_id: uuid.UUID,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> TaxReturnResponse:
    """Mark a FILED tax return as ACCEPTED (confirmation received from FIRS)."""
    tenant_id = _tenant_id(current_user)
    result = await db.execute(
        select(TaxReturn).where(TaxReturn.id == return_id, TaxReturn.tenant_id == tenant_id)
    )
    tax_return = result.scalar_one_or_none()
    if not tax_return:
        raise HTTPException(status_code=404, detail="Tax return not found.")
    if tax_return.status != "FILED":
        raise HTTPException(status_code=400, detail=f"Can only accept a FILED return (current: {tax_return.status}).")
    tax_return.status = "ACCEPTED"
    await db.commit()
    await db.refresh(tax_return)
    return TaxReturnResponse.model_validate(tax_return)


# ── WHT Certificates ──────────────────────────────────────────────────────────

@router.get("/wht-certificates", response_model=list[WhtCertificateResponse])
async def list_wht_certificates(
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
    cert_type: Optional[str] = Query(None),
    vendor_id: Optional[uuid.UUID] = Query(None),
    customer_id: Optional[uuid.UUID] = Query(None),
) -> list[WhtCertificateResponse]:
    """List WHT certificates for the tenant."""
    tenant_id = _tenant_id(current_user)
    q = select(WhtCertificate).where(WhtCertificate.tenant_id == tenant_id)
    if cert_type:
        q = q.where(WhtCertificate.certificate_type == cert_type.upper())
    if vendor_id:
        q = q.where(WhtCertificate.vendor_id == vendor_id)
    if customer_id:
        q = q.where(WhtCertificate.customer_id == customer_id)
    q = q.order_by(WhtCertificate.created_at.desc())
    result = await db.execute(q)
    certs = result.scalars().all()
    return [WhtCertificateResponse.model_validate(c) for c in certs]


@router.post("/wht-certificates", response_model=WhtCertificateResponse, status_code=status.HTTP_201_CREATED)
async def create_wht_certificate(
    body: WhtCertificateCreate,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> WhtCertificateResponse:
    """Create a WHT certificate record."""
    tenant_id = _tenant_id(current_user)
    cert_number = await _next_cert_number(db, tenant_id)
    cert = WhtCertificate(
        tenant_id=tenant_id,
        certificate_number=cert_number,
        created_by_id=current_user.user_id,
        **body.model_dump(),
    )
    db.add(cert)
    await db.commit()
    await db.refresh(cert)
    return WhtCertificateResponse.model_validate(cert)


@router.get("/wht-certificates/{cert_id}", response_model=WhtCertificateResponse)
async def get_wht_certificate(
    cert_id: uuid.UUID,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> WhtCertificateResponse:
    """Get a WHT certificate by ID."""
    tenant_id = _tenant_id(current_user)
    result = await db.execute(
        select(WhtCertificate).where(WhtCertificate.id == cert_id, WhtCertificate.tenant_id == tenant_id)
    )
    cert = result.scalar_one_or_none()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found.")
    return WhtCertificateResponse.model_validate(cert)
