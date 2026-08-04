"""FX models — dedicated currency and exchange-rate tables.

Replaces the JSONB `enabled_currencies` / `fx_rates` columns in `org_setup`
with proper relational tables. Enables efficient querying, audit trails,
and per-date rate lookups across all three posting modes.

Tables:
  tenant_currencies      — enabled currencies per tenant (functional, reporting, others)
  tenant_fx_rates        — historical exchange rates per tenant per date
  fx_revaluation_rules   — FX-b: period-end revaluation config per account type
  bdc_register           — FX-b: Bureau de Change / parallel market rate log

Migration note: existing JSONB data must be migrated via a data migration
script (see docs/fx_migration_guide.md) before the org_setup JSONB columns
are dropped. The JSONB columns are left in place until all data is migrated.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean, CheckConstraint, Date, ForeignKey,
    Numeric, String, Text, TIMESTAMP, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base


class TenantCurrency(Base):
    """An enabled currency for a tenant.

    Every tenant has exactly one functional currency and may designate
    one reporting currency. Additional currencies can be enabled for
    transaction entry.

    Args:
        tenant_id: The tenant this currency belongs to.
        currency: ISO 4217 alpha-3 code (e.g. "NGN", "USD", "GBP").
        is_functional: True for the base measurement currency.
        is_reporting: True for the statutory reporting currency.
        is_enabled: False = soft-disabled (hidden from pickers).
    """

    __tablename__ = "tenant_currencies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    is_functional: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    is_reporting: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("tenant_id", "currency", name="uq_tenant_currencies_tenant_currency"),
    )


class TenantFxRate(Base):
    """A point-in-time exchange rate between two currencies for a tenant.

    Tenants may enter rates manually or import them. Multiple rate types
    can coexist for the same currency pair on the same date (e.g. SPOT
    for transactions, CLOSING for period-end translations).

    Args:
        from_currency: Source currency ISO 4217 code.
        to_currency: Target currency ISO 4217 code.
        rate: Exchange rate (1 unit of from_currency = rate units of to_currency).
        rate_type: SPOT | CLOSING | AVERAGE | BUDGET.
        effective_date: The date this rate is valid for.
        source: MANUAL | API (future: auto-fetched from CBN / ECB etc.).
    """

    __tablename__ = "tenant_fx_rates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    from_currency: Mapped[str] = mapped_column(String(3), nullable=False)
    to_currency: Mapped[str] = mapped_column(String(3), nullable=False)
    rate: Mapped[Decimal] = mapped_column(Numeric(20, 6), nullable=False)
    rate_type: Mapped[str] = mapped_column(String(20), nullable=False, server_default="SPOT")
    effective_date: Mapped[date] = mapped_column(Date, nullable=False)
    source: Mapped[str] = mapped_column(String(50), nullable=False, server_default="MANUAL")
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        CheckConstraint("rate_type IN ('SPOT','CLOSING','AVERAGE','BUDGET')", name="chk_fx_rate_type"),
        CheckConstraint("rate > 0", name="chk_fx_rate_positive"),
    )


class FxRevaluationRule(Base):
    """Period-end FX revaluation rule for a specific GL account type.

    Defines which rate type (CLOSING, AVERAGE, etc.) to use when revaluing
    monetary assets/liabilities at period end, and which GL accounts
    to credit/debit for the resulting FX gain or loss.

    Args:
        account_type: GL account type code subject to revaluation
                      (e.g. MONETARY_ASSET, MONETARY_LIABILITY).
        rate_type: FX rate type to use — CLOSING | AVERAGE | BUDGET | SPOT.
        gain_account_id: GL account for FX gains (credit).
        loss_account_id: GL account for FX losses (debit).
        is_active: False = rule exists but is currently disabled.
    """

    __tablename__ = "fx_revaluation_rules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    account_type: Mapped[str] = mapped_column(String(50), nullable=False)
    rate_type: Mapped[str] = mapped_column(String(20), nullable=False, server_default="CLOSING")
    gain_account_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("chart_of_accounts.id", ondelete="SET NULL"), nullable=True)
    loss_account_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("chart_of_accounts.id", ondelete="SET NULL"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("rate_type IN ('SPOT','CLOSING','AVERAGE','BUDGET')", name="chk_rev_rule_rate_type"),
        UniqueConstraint("tenant_id", "account_type", name="uq_rev_rule_tenant_account_type"),
    )


class BdcEntry(Base):
    """A Bureau de Change (BDC) or parallel-market exchange rate entry.

    Companies operating in dual-rate environments (e.g. Nigeria) must
    record rates obtained from BDC operators for disclosure and
    reconciliation against the official rate.

    Args:
        from_currency: Currency being sold (ISO 4217).
        to_currency: Currency being bought (ISO 4217).
        rate: BDC rate (1 unit of from_currency = rate units of to_currency).
        quote_date: Date the BDC quote was obtained.
        bdc_name: Name of the Bureau de Change or market source.
        reference: Internal reference or transaction number.
        notes: Free-text notes for this entry.
        created_by: User who recorded this entry.
    """

    __tablename__ = "bdc_register"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    from_currency: Mapped[str] = mapped_column(String(3), nullable=False)
    to_currency: Mapped[str] = mapped_column(String(3), nullable=False)
    rate: Mapped[Decimal] = mapped_column(Numeric(20, 6), nullable=False)
    quote_date: Mapped[date] = mapped_column(Date, nullable=False)
    bdc_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    reference: Mapped[str | None] = mapped_column(String(200), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        CheckConstraint("rate > 0", name="chk_bdc_rate_positive"),
    )
