"""
Billing & Subscription ORM models — SA-B full.

Three tables:
  PricingPlan          — product catalogue entry (Free / Starter / Growth / Enterprise)
  TenantSubscription   — one active subscription per tenant
  BillingEvent         — immutable append-only log of billing state transitions

SA-B-lite already added `plan` + `paid_since` to the `tenants` table for manual tracking.
These tables add structured subscription management used by the SA portal and,
eventually, payment provider webhooks (Stripe / Paystack).
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base


class PricingPlan(Base):
    """
    A product tier in the pricing catalogue.

    Attributes:
        code:          Stable identifier (free, starter, growth, enterprise).
        name:          Human display name.
        monthly_price: Recurring monthly price in `currency`.
        annual_price:  Discounted annual price (paid upfront).
        max_users:     User cap for this plan; NULL = unlimited.
        features:      JSONB dict mapping module_key → bool (drives module licensing).
        is_active:     Hidden from new signups when False.
    """

    __tablename__ = "pricing_plans"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    monthly_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=Decimal("0"))
    annual_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=Decimal("0"))
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="NGN")
    max_users: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    max_tenants: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    features: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    subscriptions: Mapped[list[TenantSubscription]] = relationship(
        "TenantSubscription", back_populates="plan"
    )


class TenantSubscription(Base):
    """
    The active subscription record for a tenant.

    One row per tenant (enforced by unique constraint on tenant_id).

    Status lifecycle:
      TRIAL → ACTIVE (payment received)
      ACTIVE → PAST_DUE (payment failed)
      PAST_DUE → ACTIVE (payment retried) or CANCELLED (grace period elapsed)
      ACTIVE → CANCELLED (voluntary cancellation)
      Any → COMPLIMENTARY (SA override for partner / demo tenants)

    Attributes:
        tenant_id:               One subscription per tenant.
        plan_id:                 FK to pricing_plans.
        status:                  TRIAL | ACTIVE | PAST_DUE | CANCELLED | PAUSED | COMPLIMENTARY.
        billing_cycle:           monthly | annual.
        trial_end_date:          When the trial period expires.
        current_period_start/end: Current billing interval.
        payment_provider:        stripe | paystack | manual.
        provider_customer_id:    Payment provider's customer ID.
        provider_subscription_id: Payment provider's subscription ID.
        last_payment_date/amount: Most recent successful payment.
        next_billing_date:       Next renewal date.
        cancelled_at:            Cancellation timestamp.
    """

    __tablename__ = "tenant_subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    plan_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("pricing_plans.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="TRIAL")
    billing_cycle: Mapped[str] = mapped_column(String(10), nullable=False, default="monthly")
    trial_end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    current_period_start: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    current_period_end: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    payment_provider: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    provider_customer_id: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    provider_subscription_id: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    last_payment_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    last_payment_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    next_billing_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    cancellation_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint(
            "status IN ('TRIAL','ACTIVE','PAST_DUE','CANCELLED','PAUSED','COMPLIMENTARY')",
            name="ck_subscription_status",
        ),
        CheckConstraint("billing_cycle IN ('monthly','annual')", name="ck_subscription_billing_cycle"),
    )

    plan: Mapped[Optional[PricingPlan]] = relationship("PricingPlan", back_populates="subscriptions")
    events: Mapped[list[BillingEvent]] = relationship(
        "BillingEvent", back_populates="subscription", cascade="all, delete-orphan"
    )


class BillingEvent(Base):
    """
    Immutable append-only log of billing state transitions.

    Every subscription change (activation, payment, cancellation, SA override)
    is recorded here for audit purposes.

    Attributes:
        event_type:        e.g. subscription.created, payment.succeeded, plan.changed.
        amount/currency:   Payment amount if applicable.
        provider:          Which payment provider fired the event.
        provider_event_id: Provider's idempotency key (dedup webhooks).
        data:              Raw event payload for debugging.
        created_by_id:     SA user if manually overridden, else NULL (webhook).
    """

    __tablename__ = "billing_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    subscription_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenant_subscriptions.id", ondelete="SET NULL"),
        nullable=True,
    )
    event_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    currency: Mapped[Optional[str]] = mapped_column(String(3), nullable=True)
    provider: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    provider_event_id: Mapped[Optional[str]] = mapped_column(String(200), nullable=True, index=True)
    data: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    created_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    subscription: Mapped[Optional[TenantSubscription]] = relationship(
        "TenantSubscription", back_populates="events"
    )
