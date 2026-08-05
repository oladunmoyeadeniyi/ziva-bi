"""Router — Vendor Portal.

Two sets of endpoints:

ADMIN (tenant-authenticated):
  GET  /api/vendor-portal/vendors          — list vendors with portal status
  POST /api/vendor-portal/vendors/{id}/enable  — enable portal + generate token
  POST /api/vendor-portal/vendors/{id}/disable — disable portal + clear token
  POST /api/vendor-portal/vendors/{id}/reset-token — regenerate portal token
  GET  /api/vendor-portal/submissions      — list vendor invoice submissions

PORTAL (token-authenticated — vendor-facing, public):
  POST /api/vendor-portal/auth/{token}     — authenticate with portal token → vendor JWT
  GET  /api/vendor-portal/portal/invoices  — vendor's AP invoices (read-only)
  GET  /api/vendor-portal/portal/invoices/{id} — invoice detail
  POST /api/vendor-portal/portal/submit    — submit a new invoice for review

Design note:
  The portal token is a long random string embedded in the shareable URL.
  It authenticates the vendor without requiring a username/password.
  Regenerating the token invalidates any previously shared link.
"""

from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timezone

import jwt as pyjwt
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.middleware.auth import CurrentUser, require_auth
from app.models.ap import ApInvoice, Vendor
from app.models.portals import VendorInvoiceSubmission

router = APIRouter(prefix="/api/vendor-portal", tags=["vendor-portal"])


def _tenant(current_user: CurrentUser) -> uuid.UUID:
    if current_user.tenant_id is None:
        raise HTTPException(400, detail="No tenant context.")
    return current_user.tenant_id


def _generate_token() -> str:
    """Generate a 64-char URL-safe random portal token."""
    return secrets.token_urlsafe(48)


# ── Vendor portal admin schemas ────────────────────────────────────────────────

class VendorPortalStatus(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    email: str | None
    portal_enabled: bool
    portal_token: str | None
    portal_url: str | None

    model_config = {"from_attributes": True}


class SubmissionReviewPayload(BaseModel):
    action: str = Field(..., pattern="^(CONVERTED|REJECTED)$")
    rejection_reason: str | None = None
    converted_ap_invoice_id: uuid.UUID | None = None


# ── Admin endpoints ────────────────────────────────────────────────────────────

@router.get("/vendors", response_model=list[VendorPortalStatus])
async def list_vendor_portal_status(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> list[dict]:
    """List all active vendors with their portal enable/disable status."""
    tenant_id = _tenant(current_user)
    rows = (await db.execute(
        select(Vendor).where(Vendor.tenant_id == tenant_id, Vendor.is_active == True)  # noqa: E712
        .order_by(Vendor.name)
    )).scalars().all()

    base_url = getattr(settings, "app_base_url", "https://app.prad.com")
    return [
        VendorPortalStatus(
            id=v.id,
            code=v.code,
            name=v.name,
            email=v.email,
            portal_enabled=v.portal_enabled,
            portal_token=v.portal_token if v.portal_enabled else None,
            portal_url=f"{base_url}/portal/vendor/{v.portal_token}" if v.portal_enabled and v.portal_token else None,
        )
        for v in rows
    ]


@router.post("/vendors/{vendor_id}/enable")
async def enable_vendor_portal(
    vendor_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> dict:
    """Enable the vendor portal and generate a new access token."""
    tenant_id = _tenant(current_user)
    vendor = (await db.execute(
        select(Vendor).where(Vendor.id == vendor_id, Vendor.tenant_id == tenant_id)
    )).scalar_one_or_none()
    if not vendor:
        raise HTTPException(404, detail="Vendor not found.")

    if not vendor.portal_token:
        vendor.portal_token = _generate_token()
    vendor.portal_enabled = True
    await db.commit()

    base_url = getattr(settings, "app_base_url", "https://app.prad.com")
    return {
        "vendor_id": str(vendor_id),
        "portal_enabled": True,
        "portal_url": f"{base_url}/portal/vendor/{vendor.portal_token}",
    }


@router.post("/vendors/{vendor_id}/disable")
async def disable_vendor_portal(
    vendor_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> dict:
    """Disable vendor portal access (keeps existing token in DB but sets enabled=False)."""
    tenant_id = _tenant(current_user)
    vendor = (await db.execute(
        select(Vendor).where(Vendor.id == vendor_id, Vendor.tenant_id == tenant_id)
    )).scalar_one_or_none()
    if not vendor:
        raise HTTPException(404, detail="Vendor not found.")
    vendor.portal_enabled = False
    await db.commit()
    return {"vendor_id": str(vendor_id), "portal_enabled": False}


@router.post("/vendors/{vendor_id}/reset-token")
async def reset_vendor_portal_token(
    vendor_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> dict:
    """Regenerate the portal token, invalidating any previously shared link."""
    tenant_id = _tenant(current_user)
    vendor = (await db.execute(
        select(Vendor).where(Vendor.id == vendor_id, Vendor.tenant_id == tenant_id)
    )).scalar_one_or_none()
    if not vendor:
        raise HTTPException(404, detail="Vendor not found.")
    vendor.portal_token = _generate_token()
    vendor.portal_enabled = True
    await db.commit()
    base_url = getattr(settings, "app_base_url", "https://app.prad.com")
    return {
        "vendor_id": str(vendor_id),
        "portal_url": f"{base_url}/portal/vendor/{vendor.portal_token}",
        "message": "Token reset. Previous link is now invalid.",
    }


@router.get("/submissions")
async def list_submissions(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> list[dict]:
    """List all vendor invoice submissions for review."""
    tenant_id = _tenant(current_user)
    rows = (await db.execute(
        select(VendorInvoiceSubmission, Vendor.name.label("vendor_name"))
        .join(Vendor, VendorInvoiceSubmission.vendor_id == Vendor.id)
        .where(VendorInvoiceSubmission.tenant_id == tenant_id)
        .order_by(VendorInvoiceSubmission.submitted_at.desc())
    )).all()
    return [
        {
            "id": str(r.VendorInvoiceSubmission.id),
            "vendor_name": r.vendor_name,
            "invoice_number": r.VendorInvoiceSubmission.invoice_number,
            "invoice_date": r.VendorInvoiceSubmission.invoice_date.isoformat(),
            "total_amount": float(r.VendorInvoiceSubmission.total_amount),
            "currency_code": r.VendorInvoiceSubmission.currency_code,
            "status": r.VendorInvoiceSubmission.status,
            "submitted_at": r.VendorInvoiceSubmission.submitted_at.isoformat(),
        }
        for r in rows
    ]


@router.put("/submissions/{submission_id}/review")
async def review_submission(
    submission_id: uuid.UUID,
    payload: SubmissionReviewPayload,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> dict:
    """Mark a vendor submission as converted or rejected."""
    tenant_id = _tenant(current_user)
    sub = (await db.execute(
        select(VendorInvoiceSubmission).where(
            VendorInvoiceSubmission.id == submission_id,
            VendorInvoiceSubmission.tenant_id == tenant_id,
        )
    )).scalar_one_or_none()
    if not sub:
        raise HTTPException(404, detail="Submission not found.")
    if sub.status != "PENDING":
        raise HTTPException(400, detail="Only PENDING submissions can be reviewed.")

    sub.status = payload.action
    sub.reviewed_by = current_user.user_id
    sub.reviewed_at = datetime.now(timezone.utc)
    if payload.action == "REJECTED":
        sub.rejection_reason = payload.rejection_reason
    elif payload.action == "CONVERTED" and payload.converted_ap_invoice_id:
        sub.converted_ap_invoice_id = payload.converted_ap_invoice_id

    await db.commit()
    return {"id": str(submission_id), "status": sub.status}


# ── Portal (vendor-facing) endpoints ──────────────────────────────────────────

class PortalInvoiceSubmit(BaseModel):
    invoice_number: str
    invoice_date: str
    due_date: str | None = None
    currency_code: str = "NGN"
    total_amount: float
    description: str | None = None


def _make_portal_jwt(vendor_id: str, tenant_id: str) -> str:
    """Issue a short-lived JWT for vendor portal access (8 hours)."""
    from datetime import timedelta
    import time
    payload = {
        "sub": f"vendor:{vendor_id}",
        "tenant_id": tenant_id,
        "vendor_id": vendor_id,
        "role": "vendor_portal",
        "exp": int(time.time()) + 28800,  # 8 hours
        "iat": int(time.time()),
    }
    return pyjwt.encode(payload, settings.secret_key, algorithm="HS256")


def _verify_portal_jwt(token: str) -> dict:
    """Verify vendor portal JWT and return payload."""
    try:
        return pyjwt.decode(token, settings.secret_key, algorithms=["HS256"])
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(401, detail="Portal session expired. Please use your portal link again.")
    except pyjwt.InvalidTokenError:
        raise HTTPException(401, detail="Invalid portal token.")


@router.post("/auth/{portal_token}")
async def portal_authenticate(
    portal_token: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Exchange a portal URL token for a vendor JWT session.

    Called by the public vendor portal page when the vendor first opens their link.
    Returns a JWT the frontend stores in memory for subsequent API calls.

    Args:
        portal_token: The token embedded in the vendor's portal URL.

    Returns:
        jwt (str), vendor_name (str), tenant_name (str).

    Raises:
        404: Token not found or portal disabled.
    """
    vendor = (await db.execute(
        select(Vendor).where(
            Vendor.portal_token == portal_token,
            Vendor.portal_enabled == True,  # noqa: E712
        )
    )).scalar_one_or_none()
    if not vendor:
        raise HTTPException(404, detail="This portal link is invalid or has been disabled.")

    token = _make_portal_jwt(str(vendor.id), str(vendor.tenant_id))
    return {
        "jwt": token,
        "vendor_name": vendor.name,
        "vendor_code": vendor.code,
    }


@router.get("/portal/invoices")
async def portal_list_invoices(
    authorization: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """List AP invoices for the authenticated vendor (portal session).

    The vendor sees their own invoices only — never other vendors' data.
    """
    from fastapi import Header
    # The portal JWT is passed in the Authorization header by the frontend
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, detail="Missing portal authorization.")
    claims = _verify_portal_jwt(authorization[7:])
    vendor_id = uuid.UUID(claims["vendor_id"])
    tenant_id = uuid.UUID(claims["tenant_id"])

    rows = (await db.execute(
        select(ApInvoice).where(
            ApInvoice.vendor_id == vendor_id,
            ApInvoice.tenant_id == tenant_id,
        ).order_by(ApInvoice.invoice_date.desc())
    )).scalars().all()

    return [
        {
            "id": str(inv.id),
            "invoice_number": inv.invoice_number,
            "invoice_date": inv.invoice_date.isoformat() if inv.invoice_date else None,
            "due_date": inv.due_date.isoformat() if inv.due_date else None,
            "total_amount": float(inv.total_amount),
            "currency_code": inv.currency_code,
            "status": inv.status,
        }
        for inv in rows
    ]


@router.post("/portal/submit")
async def portal_submit_invoice(
    authorization: str | None = None,
    payload: PortalInvoiceSubmit = ...,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Submit a new invoice via the vendor portal.

    Creates a VendorInvoiceSubmission for finance team review.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, detail="Missing portal authorization.")
    claims = _verify_portal_jwt(authorization[7:])
    vendor_id = uuid.UUID(claims["vendor_id"])
    tenant_id = uuid.UUID(claims["tenant_id"])

    from datetime import date as _date
    sub = VendorInvoiceSubmission(
        tenant_id=tenant_id,
        vendor_id=vendor_id,
        invoice_number=payload.invoice_number,
        invoice_date=_date.fromisoformat(payload.invoice_date),
        due_date=_date.fromisoformat(payload.due_date) if payload.due_date else None,
        currency_code=payload.currency_code,
        total_amount=payload.total_amount,
        description=payload.description,
    )
    db.add(sub)
    await db.commit()
    return {"id": str(sub.id), "status": "PENDING", "message": "Invoice submitted for review."}
