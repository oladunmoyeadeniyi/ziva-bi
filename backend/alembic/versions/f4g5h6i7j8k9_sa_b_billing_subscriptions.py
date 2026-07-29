"""sa_b_billing_subscriptions

Revision ID: f4g5h6i7j8k9
Revises: e3f4g5h6i7j8
Create Date: 2026-07-28 12:30:00.000000

SA-B — Billing & Subscription backend (full).

SA-B-lite already added `plan` + `paid_since` to the `tenants` table.
This migration adds the full subscription management infrastructure:

  pricing_plans       — product catalogue (Free, Starter, Growth, Enterprise)
  tenant_subscriptions — one active subscription per tenant
  billing_events      — immutable log of billing state changes (activations, cancellations, renewals)

Payment provider integration (Stripe/Paystack webhooks) updates these tables.
The SA portal can also manually override plan/status for clients paying via EFT.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "f4g5h6i7j8k9"
down_revision = "e3f4g5h6i7j8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── pricing_plans ─────────────────────────────────────────────────────
    op.create_table(
        "pricing_plans",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("code", sa.String(50), nullable=False, unique=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("monthly_price", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("annual_price", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(3), nullable=False, server_default="NGN"),
        sa.Column("max_users", sa.Integer, nullable=True),        # NULL = unlimited
        sa.Column("max_tenants", sa.Integer, nullable=True),      # for multi-entity plans
        sa.Column("features", JSONB, nullable=True),              # {"ap": true, "ar": true, ...}
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_pricing_plans_active", "pricing_plans", ["is_active"])

    # ── tenant_subscriptions ──────────────────────────────────────────────
    op.create_table(
        "tenant_subscriptions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("plan_id", UUID(as_uuid=True), sa.ForeignKey("pricing_plans.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="TRIAL"),
        sa.Column("billing_cycle", sa.String(10), nullable=False, server_default="monthly"),  # monthly | annual
        sa.Column("trial_end_date", sa.Date, nullable=True),
        sa.Column("current_period_start", sa.Date, nullable=True),
        sa.Column("current_period_end", sa.Date, nullable=True),
        sa.Column("payment_provider", sa.String(30), nullable=True),   # stripe | paystack | manual
        sa.Column("provider_customer_id", sa.String(200), nullable=True),
        sa.Column("provider_subscription_id", sa.String(200), nullable=True),
        sa.Column("last_payment_date", sa.Date, nullable=True),
        sa.Column("last_payment_amount", sa.Numeric(10, 2), nullable=True),
        sa.Column("next_billing_date", sa.Date, nullable=True),
        sa.Column("cancelled_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("cancellation_reason", sa.Text, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "status IN ('TRIAL','ACTIVE','PAST_DUE','CANCELLED','PAUSED','COMPLIMENTARY')",
            name="ck_subscription_status",
        ),
        sa.CheckConstraint(
            "billing_cycle IN ('monthly','annual')",
            name="ck_subscription_billing_cycle",
        ),
    )
    op.create_index("ix_tenant_subscriptions_tenant_id", "tenant_subscriptions", ["tenant_id"])
    op.create_index("ix_tenant_subscriptions_status", "tenant_subscriptions", ["status"])
    op.create_index("ix_tenant_subscriptions_plan_id", "tenant_subscriptions", ["plan_id"])

    # ── billing_events ────────────────────────────────────────────────────
    op.create_table(
        "billing_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("subscription_id", UUID(as_uuid=True), sa.ForeignKey("tenant_subscriptions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("event_type", sa.String(50), nullable=False),   # subscription.created | payment.succeeded | ...
        sa.Column("amount", sa.Numeric(10, 2), nullable=True),
        sa.Column("currency", sa.String(3), nullable=True),
        sa.Column("provider", sa.String(30), nullable=True),
        sa.Column("provider_event_id", sa.String(200), nullable=True),
        sa.Column("data", JSONB, nullable=True),
        sa.Column("created_by_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_billing_events_tenant_id", "billing_events", ["tenant_id"])
    op.create_index("ix_billing_events_event_type", "billing_events", ["event_type"])
    op.create_index("ix_billing_events_provider_event_id", "billing_events", ["provider_event_id"])

    # Seed default pricing plans
    op.execute(
        """
        INSERT INTO pricing_plans (code, name, description, monthly_price, annual_price, currency, max_users, features, sort_order)
        VALUES
          ('free',       'Free',       'Up to 3 users, expense tracking only',  0,      0,       'NGN', 3,    '{"expense": true}', 1),
          ('starter',    'Starter',    'Up to 10 users, core finance modules',  25000,  250000,  'NGN', 10,   '{"expense": true, "ap": true, "ar": true}', 2),
          ('growth',     'Growth',     'Up to 50 users, all modules',           75000,  750000,  'NGN', 50,   '{"expense": true, "ap": true, "ar": true, "budget": true, "payroll": true}', 3),
          ('enterprise', 'Enterprise', 'Unlimited users, full ERP + support',   200000, 2000000, 'NGN', null, '{"all": true}', 4)
        ON CONFLICT (code) DO NOTHING
        """
    )


def downgrade() -> None:
    op.drop_table("billing_events")
    op.drop_table("tenant_subscriptions")
    op.drop_table("pricing_plans")
