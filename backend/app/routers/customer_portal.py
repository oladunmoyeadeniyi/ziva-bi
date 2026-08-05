"""Router — Customer Portal.

Two sets of endpoints (mirrors vendor_portal.py pattern):

ADMIN (tenant-authenticated):
  GET  /api/customer-portal/customers              — list customers with portal status
  POST /api/customer-portal/customers/{id}/enable  — enable portal + generate token
  POST /api/customer-portal/customers/{id}/disable — disable portal
  POST /api/customer-portal/customers/{id}/reset-token — regenerate token
  GET  /api/customer-portal/messages               — list customer messages/disputes
  PUT  /api/customer-portal/messages/{id}/resolve  — mark message resolved

PORTAL (token-authenticated — customer-facing, public):
  POST /api/customer-portal/auth/{token}           — exchange URL token for customer JWT
  GET  /api/customer-portal/portal/invoices        — customer's AR invoices
  GET  /api/customer-portal/portal/invoices/{id}   — invoice detail + payment history
  POST /api/customer-portal/portal/message         — send a message/dispute/remittance notice
"""

from __future__ import annotations

import secrets
import time
import uuid
from datetime import datetime, timezone

import jwt as pyjwt
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.middleware.auth import CurrentUser, require_auth
from app.models.ar import ArInvoice, Customer
from app.models.portals import CustomerPortalMessage

router = APIRouter(prefix="/api/customer-portal", tags=["customer-portal"])


def _tenant(cu: CurrentUser) -> uuid.UUID:
    if cu.tenant_id is None:
        raise HTTPException(400, detail="No tenant context.")
    return cu.tenant_id


def _gen_token() -> str:
    return secrets.token_urlsafe(48)


def _make_portal_jwt(customer_id: str, tenant_id: str) -> str:
    payload = {
        "sub": f"customer:{customer_id}",
        "tenant_id": tenant_id,
        "customer_id": customer_id,
        "role": "customer_portal",
        "exp": int(time.time()) + 28800,
        "iat": int(time.time()),
    }
    return pyjwt.encode(payload, settings.secret_key, algorithm="HS256")


def _verify_portal_jwt(token: str) -> dict:
    try:
        return pyjwt.decode(token, settings.secret_key, algorithms=["HS256"])
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(401, detail="Portal session expired.")
    except pyjwt.InvalidTokenError:
        raise HTTPException(401, detail="Invalid portal token.")


# ── Admin endpoints ────────────────────────────────────────────────────────────

class CustomerPortalStatus(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    email: str | None
    portal_enabled: bool
    portal_url: str | None

    model_config = {"from_attributes": True}


@router.get("/customers", response_model=list[CustomerPortalStatus])
async def list_customer_portal_status(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> list[CustomerPortalStatus]:
    tenant_id = _tenant(current_user)
    rows = (await db.execute(
        select(Customer).where(Customer.tenant_id == tenant_id, Customer.is_active == True)  # noqa: E712
        .order_by(Customer.name)
    )).scalars().all()
    base_url = getattr(settings, "app_base_url", "https://app.prad.com")
    return [
        CustomerPortalStatus(
            id=c.id,
            code=c.code,
            name=c.name,
            email=c.email,
            portal_enabled=c.portal_enabled,
            portal_url=f"{base_url}/portal/customer/{c.portal_token}" if c.portal_enabled and c.portal_token else None,
        )
        for c in rows
    ]


@router.post("/customers/{customer_id}/enable")
async def enable_customer_portal(
    customer_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> dict:
    tenant_id = _tenant(current_user)
    customer = (await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.tenant_id == tenant_id)
    )).scalar_one_or_none()
    if not customer:
        raise HTTPException(404, detail="Customer not found.")
    if not customer.portal_token:
        customer.portal_token = _gen_token()
    customer.portal_enabled = True
    await db.commit()
    base_url = getattr(settings, "app_base_url", "https://app.prad.com")
    return {"portal_url": f"{base_url}/portal/customer/{customer.portal_token}"}


@router.post("/customers/{customer_id}/disable")
async def disable_customer_portal(
    customer_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> dict:
    tenant_id = _tenant(current_user)
    customer = (await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.tenant_id == tenant_id)
    )).scalar_one_or_none()
    if not customer:
        raise HTTPException(404, detail="Customer not found.")
    customer.portal_enabled = False
    await db.commit()
    return {"customer_id": str(customer_id), "portal_enabled": False}


@router.post("/customers/{customer_id}/reset-token")
async def reset_customer_portal_token(
    customer_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> dict:
    tenant_id = _tenant(current_user)
    customer = (await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.tenant_id == tenant_id)
    )).scalar_one_or_none()
    if not customer:
        raise HTTPException(404, detail="Customer not found.")
    customer.portal_token = _gen_token()
    customer.portal_enabled = True
    await db.commit()
    base_url = getattr(settings, "app_base_url", "https://app.prad.com")
    return {"portal_url": f"{base_url}/portal/customer/{customer.portal_token}"}


@router.get("/messages")
async def list_customer_messages(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> list[dict]:
    tenant_id = _tenant(current_user)
    rows = (await db.execute(
        select(CustomerPortalMessage, Customer.name.label("customer_name"))
        .join(Customer, CustomerPortalMessage.customer_id == Customer.id)
        .where(CustomerPortalMessage.tenant_id == tenant_id)
        .order_by(CustomerPortalMessage.created_at.desc())
    )).all()
    return [
        {
            "id": str(r.CustomerPortalMessage.id),
            "customer_name": r.customer_name,
            "message_type": r.CustomerPortalMessage.message_type,
            "subject": r.CustomerPortalMessage.subject,
            "amount": float(r.CustomerPortalMessage.amount) if r.CustomerPortalMessage.amount else None,
            "status": r.CustomerPortalMessage.status,
            "created_at": r.CustomerPortalMessage.created_at.isoformat(),
        }
        for r in rows
    ]


@router.put("/messages/{message_id}/resolve")
async def resolve_customer_message(
    message_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> dict:
    tenant_id = _tenant(current_user)
    msg = (await db.execute(
        select(CustomerPortalMessage).where(
            CustomerPortalMessage.id == message_id,
            CustomerPortalMessage.tenant_id == tenant_id,
        )
    )).scalar_one_or_none()
    if not msg:
        raise HTTPException(404, detail="Message not found.")
    msg.status = "RESOLVED"
    msg.resolved_by = current_user.user_id
    msg.resolved_at = datetime.now(timezone.utc)
    await db.commit()
    return {"id": str(message_id), "status": "RESOLVED"}


# ── Portal (customer-facing) endpoints ────────────────────────────────────────

class CustomerMessagePayload(BaseModel):
    message_type: str
    subject: str
    body: str | None = None
    amount: float | None = None
    ar_invoice_id: str | None = None


@router.post("/auth/{portal_token}")
async def customer_portal_authenticate(
    portal_token: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Exchange portal URL token for a customer JWT session."""
    customer = (await db.execute(
        select(Customer).where(
            Customer.portal_token == portal_token,
            Customer.portal_enabled == True,  # noqa: E712
        )
    )).scalar_one_or_none()
    if not customer:
        raise HTTPException(404, detail="This portal link is invalid or has been disabled.")
    token = _make_portal_jwt(str(customer.id), str(customer.tenant_id))
    return {"jwt": token, "customer_name": customer.name, "customer_code": customer.code}


@router.get("/portal/invoices")
async def customer_portal_invoices(
    authorization: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """List AR invoices for the authenticated customer."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, detail="Missing portal authorization.")
    claims = _verify_portal_jwt(authorization[7:])
    customer_id = uuid.UUID(claims["customer_id"])
    tenant_id = uuid.UUID(claims["tenant_id"])

    rows = (await db.execute(
        select(ArInvoice).where(
            ArInvoice.customer_id == customer_id,
            ArInvoice.tenant_id == tenant_id,
        ).order_by(ArInvoice.invoice_date.desc())
    )).scalars().all()

    return [
        {
            "id": str(inv.id),
            "invoice_number": inv.invoice_number,
            "invoice_date": inv.invoice_date.isoformat() if inv.invoice_date else None,
            "due_date": inv.due_date.isoformat() if inv.due_date else None,
            "total_amount": float(inv.total_amount),
            "balance_due": float(inv.balance_due) if inv.balance_due is not None else float(inv.total_amount),
            "currency_code": inv.currency_code,
            "status": inv.status,
        }
        for inv in rows
    ]


@router.post("/portal/message")
async def customer_portal_send_message(
    payload: CustomerMessagePayload,
    authorization: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Customer sends a message/dispute/remittance notice."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, detail="Missing portal authorization.")
    claims = _verify_portal_jwt(authorization[7:])
    customer_id = uuid.UUID(claims["customer_id"])
    tenant_id = uuid.UUID(claims["tenant_id"])

    msg = CustomerPortalMessage(
        tenant_id=tenant_id,
        customer_id=customer_id,
        ar_invoice_id=uuid.UUID(payload.ar_invoice_id) if payload.ar_invoice_id else None,
        message_type=payload.message_type,
        subject=payload.subject,
        body=payload.body,
        amount=payload.amount,
    )
    db.add(msg)
    await db.commit()
    return {"id": str(msg.id), "status": "OPEN", "message": "Your message has been sent."}
