"""
Billing & Subscription router — SA-B full.

All endpoints are Super Admin (SA) only.  Tenant users cannot access these routes.

Routes:
    Pricing plans (public read, SA write):
        GET    /api/sa/billing/plans              — list all plans
        POST   /api/sa/billing/plans              — create plan
        PUT    /api/sa/billing/plans/{id}         — update plan
        DELETE /api/sa/billing/plans/{id}         — deactivate plan

    Tenant subscriptions (SA only):
        GET    /api/sa/billing/subscriptions      — list all subscriptions
        GET    /api/sa/billing/subscriptions/{tenant_id}  — get one tenant's subscription
        POST   /api/sa/billing/subscriptions/{tenant_id}  — create / assign subscription
        PUT    /api/sa/billing/subscriptions/{tenant_id}  — update (manual override)

    Billing events:
        GET    /api/sa/billing/events/{tenant_id} — list events for a tenant
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.middleware.auth import require_auth
from app.models.auth import UserTenant
from app.models.billing import BillingEvent, PricingPlan, TenantSubscription
from app.schemas.billing import (
    BillingEventResponse,
    PricingPlanCreate,
    PricingPlanResponse,
    PricingPlanUpdate,
    SubscriptionCreate,
    SubscriptionResponse,
    SubscriptionUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sa/billing", tags=["SA Billing"])


def _require_sa(user: UserTenant) -> None:
    """Raise 403 if user is not a super admin."""
    role = getattr(user, "role_tier", None) or getattr(user, "role", None) or ""
    if "super_admin" not in str(role).lower() and "power_admin" not in str(role).lower():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super Admin access required.")


# ── Pricing Plans ──────────────────────────────────────────────────────────────

@router.get("/plans", response_model=list[PricingPlanResponse])
async def list_plans(
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
    include_inactive: bool = Query(False),
) -> list[PricingPlanResponse]:
    """List pricing plans (all users can read, SA can manage)."""
    q = select(PricingPlan)
    if not include_inactive:
        q = q.where(PricingPlan.is_active.is_(True))
    q = q.order_by(PricingPlan.sort_order)
    result = await db.execute(q)
    plans = result.scalars().all()
    return [PricingPlanResponse.model_validate(p) for p in plans]


@router.post("/plans", response_model=PricingPlanResponse, status_code=status.HTTP_201_CREATED)
async def create_plan(
    body: PricingPlanCreate,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> PricingPlanResponse:
    """Create a new pricing plan (SA only)."""
    _require_sa(current_user)
    plan = PricingPlan(**body.model_dump())
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    return PricingPlanResponse.model_validate(plan)


@router.put("/plans/{plan_id}", response_model=PricingPlanResponse)
async def update_plan(
    plan_id: uuid.UUID,
    body: PricingPlanUpdate,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> PricingPlanResponse:
    """Update pricing plan details (SA only)."""
    _require_sa(current_user)
    plan = await db.get(PricingPlan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found.")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(plan, k, v)
    await db.commit()
    await db.refresh(plan)
    return PricingPlanResponse.model_validate(plan)


@router.delete("/plans/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_plan(
    plan_id: uuid.UUID,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> None:
    """Deactivate a pricing plan (soft delete — SA only)."""
    _require_sa(current_user)
    plan = await db.get(PricingPlan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found.")
    plan.is_active = False
    await db.commit()


# ── Tenant Subscriptions ───────────────────────────────────────────────────────

@router.get("/subscriptions", response_model=list[SubscriptionResponse])
async def list_subscriptions(
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
    status_filter: Optional[str] = Query(None, alias="status"),
) -> list[SubscriptionResponse]:
    """List all tenant subscriptions (SA only)."""
    _require_sa(current_user)
    q = select(TenantSubscription).options(selectinload(TenantSubscription.plan))
    if status_filter:
        q = q.where(TenantSubscription.status == status_filter.upper())
    q = q.order_by(TenantSubscription.created_at.desc())
    result = await db.execute(q)
    subs = result.scalars().all()
    return [
        SubscriptionResponse(
            **{k: getattr(s, k) for k in SubscriptionResponse.model_fields if hasattr(s, k)},
            plan_name=s.plan.name if s.plan else None,
            plan_code=s.plan.code if s.plan else None,
        )
        for s in subs
    ]


@router.get("/subscriptions/{tenant_id}", response_model=SubscriptionResponse)
async def get_subscription(
    tenant_id: uuid.UUID,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> SubscriptionResponse:
    """Get a tenant's subscription (SA only)."""
    _require_sa(current_user)
    result = await db.execute(
        select(TenantSubscription)
        .where(TenantSubscription.tenant_id == tenant_id)
        .options(selectinload(TenantSubscription.plan))
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found.")
    return SubscriptionResponse(
        **{k: getattr(sub, k) for k in SubscriptionResponse.model_fields if hasattr(sub, k)},
        plan_name=sub.plan.name if sub.plan else None,
        plan_code=sub.plan.code if sub.plan else None,
    )


@router.post("/subscriptions/{tenant_id}", response_model=SubscriptionResponse, status_code=status.HTTP_201_CREATED)
async def create_subscription(
    tenant_id: uuid.UUID,
    body: SubscriptionCreate,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> SubscriptionResponse:
    """Create or assign a subscription to a tenant (SA only)."""
    _require_sa(current_user)

    # Check if subscription already exists
    existing = await db.execute(
        select(TenantSubscription).where(TenantSubscription.tenant_id == tenant_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Tenant already has a subscription. Use PUT to update.")

    sub = TenantSubscription(tenant_id=tenant_id, **body.model_dump())
    db.add(sub)
    await db.flush()

    # Log billing event
    db.add(BillingEvent(
        tenant_id=tenant_id,
        subscription_id=sub.id,
        event_type="subscription.created",
        data={"status": sub.status, "plan_id": str(body.plan_id) if body.plan_id else None},
        created_by_id=current_user.user_id,
    ))
    await db.commit()
    await db.refresh(sub)

    plan = await db.get(PricingPlan, sub.plan_id) if sub.plan_id else None
    return SubscriptionResponse(
        **{k: getattr(sub, k) for k in SubscriptionResponse.model_fields if hasattr(sub, k)},
        plan_name=plan.name if plan else None,
        plan_code=plan.code if plan else None,
    )


@router.put("/subscriptions/{tenant_id}", response_model=SubscriptionResponse)
async def update_subscription(
    tenant_id: uuid.UUID,
    body: SubscriptionUpdate,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> SubscriptionResponse:
    """Manually update a tenant subscription (SA only — e.g. mark paid via EFT)."""
    _require_sa(current_user)
    result = await db.execute(
        select(TenantSubscription)
        .where(TenantSubscription.tenant_id == tenant_id)
        .options(selectinload(TenantSubscription.plan))
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found.")

    old_status = sub.status
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(sub, k, v)

    if body.status and body.status != old_status:
        if body.status == "CANCELLED":
            sub.cancelled_at = datetime.now(timezone.utc)
        db.add(BillingEvent(
            tenant_id=tenant_id,
            subscription_id=sub.id,
            event_type=f"status.changed.{body.status.lower()}",
            data={"old_status": old_status, "new_status": body.status, "reason": body.cancellation_reason},
            created_by_id=current_user.user_id,
        ))

    await db.commit()
    await db.refresh(sub)

    plan = await db.get(PricingPlan, sub.plan_id) if sub.plan_id else None
    return SubscriptionResponse(
        **{k: getattr(sub, k) for k in SubscriptionResponse.model_fields if hasattr(sub, k)},
        plan_name=plan.name if plan else None,
        plan_code=plan.code if plan else None,
    )


# ── Billing Events ─────────────────────────────────────────────────────────────

@router.get("/events/{tenant_id}", response_model=list[BillingEventResponse])
async def list_billing_events(
    tenant_id: uuid.UUID,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> list[BillingEventResponse]:
    """List billing events for a tenant (SA only)."""
    _require_sa(current_user)
    result = await db.execute(
        select(BillingEvent)
        .where(BillingEvent.tenant_id == tenant_id)
        .order_by(BillingEvent.created_at.desc())
    )
    events = result.scalars().all()
    return [BillingEventResponse.model_validate(e) for e in events]
