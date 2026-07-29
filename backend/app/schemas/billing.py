"""
Pydantic schemas for Billing & Subscription (SA-B full).
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict


# ── Pricing Plans ──────────────────────────────────────────────────────────────

class PricingPlanCreate(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    monthly_price: Decimal = Decimal("0")
    annual_price: Decimal = Decimal("0")
    currency: str = "NGN"
    max_users: Optional[int] = None
    features: Optional[dict[str, Any]] = None
    sort_order: int = 0


class PricingPlanUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    monthly_price: Optional[Decimal] = None
    annual_price: Optional[Decimal] = None
    max_users: Optional[int] = None
    features: Optional[dict[str, Any]] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


class PricingPlanResponse(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    description: Optional[str]
    monthly_price: Decimal
    annual_price: Decimal
    currency: str
    max_users: Optional[int]
    features: Optional[dict[str, Any]]
    is_active: bool
    sort_order: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Tenant Subscriptions ───────────────────────────────────────────────────────

class SubscriptionCreate(BaseModel):
    """SA creates a subscription for a tenant."""
    plan_id: Optional[uuid.UUID] = None
    status: str = "TRIAL"
    billing_cycle: str = "monthly"
    trial_end_date: Optional[date] = None
    current_period_start: Optional[date] = None
    current_period_end: Optional[date] = None
    payment_provider: Optional[str] = None
    notes: Optional[str] = None


class SubscriptionUpdate(BaseModel):
    """SA manually overrides a subscription (e.g. mark paid via EFT)."""
    plan_id: Optional[uuid.UUID] = None
    status: Optional[str] = None
    billing_cycle: Optional[str] = None
    trial_end_date: Optional[date] = None
    current_period_start: Optional[date] = None
    current_period_end: Optional[date] = None
    next_billing_date: Optional[date] = None
    last_payment_date: Optional[date] = None
    last_payment_amount: Optional[Decimal] = None
    payment_provider: Optional[str] = None
    notes: Optional[str] = None
    cancellation_reason: Optional[str] = None


class SubscriptionResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    plan_id: Optional[uuid.UUID]
    plan_name: Optional[str] = None
    plan_code: Optional[str] = None
    status: str
    billing_cycle: str
    trial_end_date: Optional[date]
    current_period_start: Optional[date]
    current_period_end: Optional[date]
    payment_provider: Optional[str]
    last_payment_date: Optional[date]
    last_payment_amount: Optional[Decimal]
    next_billing_date: Optional[date]
    cancelled_at: Optional[datetime]
    cancellation_reason: Optional[str]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Billing Events ─────────────────────────────────────────────────────────────

class BillingEventResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    subscription_id: Optional[uuid.UUID]
    event_type: str
    amount: Optional[Decimal]
    currency: Optional[str]
    provider: Optional[str]
    data: Optional[dict[str, Any]]
    created_by_id: Optional[uuid.UUID]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
