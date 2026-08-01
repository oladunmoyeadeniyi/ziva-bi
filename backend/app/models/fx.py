"""FX models — dedicated currency and exchange-rate tables.

Replaces the JSONB `enabled_currencies` / `fx_rates` columns in `org_setup`
with proper relational tables. Enables efficient querying, audit trails,
and per-date rate lookups across all three posting modes.

Tables:
  tenant_currencies  — enabled currencies per tenant (functional, reporting, others)
  tenant_fx_rates    — historical exchange rates per tenant per date

Migration note: existing JSONB data must be migrated via a data migration
script (see docs/fx_migration_guide.md) before the org_setup JSONB columns
are dropped. The JSONB columns are left in place until all data is migrated.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean, CheckConstraint, Date, ForeignKey,
    Numeric, String, TIMESTAMP, UniqueConstraint,
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
