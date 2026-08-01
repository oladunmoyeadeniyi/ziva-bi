"""FX service — currency management and exchange rate operations.

Provides CRUD for tenant_currencies and tenant_fx_rates tables, plus
utility functions for rate lookups and conversions.

Design:
  - Each tenant may enable multiple currencies.
  - Exactly one functional currency and one reporting currency allowed.
  - FX rates are stored per (tenant, from, to, date, rate_type).
  - Lookup falls back to inverse rate if direct rate not found.
  - JSONB migration: import_from_jsonb() migrates legacy org_setup data.

Args (most functions):
    db: AsyncSession — caller-supplied database session.
    tenant_id: UUID of the calling tenant.
"""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.fx import TenantCurrency, TenantFxRate
from app.schemas.fx import TenantCurrencyCreate, TenantCurrencyUpdate, TenantFxRateCreate


# ── Currencies ────────────────────────────────────────────────────────────────

async def list_currencies(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    enabled_only: bool = False,
) -> list[TenantCurrency]:
    """Return all currencies enabled for *tenant_id*.

    Args:
        enabled_only: If True, only return currencies where is_enabled=True.
    """
    q = select(TenantCurrency).where(TenantCurrency.tenant_id == tenant_id)
    if enabled_only:
        q = q.where(TenantCurrency.is_enabled.is_(True))
    result = await db.execute(q.order_by(TenantCurrency.currency))
    return list(result.scalars().all())


async def add_currency(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    payload: TenantCurrencyCreate,
) -> TenantCurrency:
    """Enable a new currency for the tenant.

    Enforces uniqueness of functional and reporting designations.

    Args:
        payload: Currency creation payload.

    Returns:
        The new TenantCurrency row.

    Raises:
        ValueError: If the currency is already added, or functional/reporting
                    designation conflicts with an existing designation.
    """
    currency_code = payload.currency.upper()

    # Check for duplicate
    existing = await db.execute(
        select(TenantCurrency).where(
            TenantCurrency.tenant_id == tenant_id,
            TenantCurrency.currency == currency_code,
        )
    )
    if existing.scalar_one_or_none():
        raise ValueError(f"Currency {currency_code} is already added for this tenant")

    # Enforce single functional and reporting currency
    if payload.is_functional:
        func_check = await db.execute(
            select(TenantCurrency).where(
                TenantCurrency.tenant_id == tenant_id,
                TenantCurrency.is_functional.is_(True),
            )
        )
        if func_check.scalar_one_or_none():
            raise ValueError("A functional currency is already designated. Update it instead.")

    if payload.is_reporting:
        rep_check = await db.execute(
            select(TenantCurrency).where(
                TenantCurrency.tenant_id == tenant_id,
                TenantCurrency.is_reporting.is_(True),
            )
        )
        if rep_check.scalar_one_or_none():
            raise ValueError("A reporting currency is already designated. Update it instead.")

    tc = TenantCurrency(
        tenant_id=tenant_id,
        currency=currency_code,
        is_functional=payload.is_functional,
        is_reporting=payload.is_reporting,
        is_enabled=payload.is_enabled,
    )
    db.add(tc)
    await db.flush()
    await db.refresh(tc)
    return tc


async def update_currency(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    currency_id: uuid.UUID,
    payload: TenantCurrencyUpdate,
) -> TenantCurrency | None:
    """Update functional/reporting/enabled flags for a currency.

    Enforces uniqueness of functional and reporting designations when
    promoting a currency to one of those roles.
    """
    result = await db.execute(
        select(TenantCurrency).where(
            TenantCurrency.id == currency_id,
            TenantCurrency.tenant_id == tenant_id,
        )
    )
    tc = result.scalar_one_or_none()
    if not tc:
        return None

    if payload.is_functional and not tc.is_functional:
        # Strip existing functional flag
        await db.execute(
            select(TenantCurrency)
            .where(
                TenantCurrency.tenant_id == tenant_id,
                TenantCurrency.is_functional.is_(True),
                TenantCurrency.id != currency_id,
            )
        )
        # Unflag existing functional currencies
        existing_func = await db.execute(
            select(TenantCurrency).where(
                TenantCurrency.tenant_id == tenant_id,
                TenantCurrency.is_functional.is_(True),
                TenantCurrency.id != currency_id,
            )
        )
        for curr in existing_func.scalars().all():
            curr.is_functional = False

    if payload.is_reporting and not tc.is_reporting:
        existing_rep = await db.execute(
            select(TenantCurrency).where(
                TenantCurrency.tenant_id == tenant_id,
                TenantCurrency.is_reporting.is_(True),
                TenantCurrency.id != currency_id,
            )
        )
        for curr in existing_rep.scalars().all():
            curr.is_reporting = False

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(tc, field, value)

    await db.flush()
    await db.refresh(tc)
    return tc


async def delete_currency(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    currency_id: uuid.UUID,
) -> bool:
    """Remove a currency (hard delete). Returns True if found and deleted.

    Raises:
        ValueError: If the currency is the functional or reporting currency
                    (those cannot be deleted without reassigning the role).
    """
    result = await db.execute(
        select(TenantCurrency).where(
            TenantCurrency.id == currency_id,
            TenantCurrency.tenant_id == tenant_id,
        )
    )
    tc = result.scalar_one_or_none()
    if not tc:
        return False
    if tc.is_functional:
        raise ValueError("Cannot delete the functional currency. Reassign the role first.")
    if tc.is_reporting:
        raise ValueError("Cannot delete the reporting currency. Reassign the role first.")
    await db.delete(tc)
    await db.flush()
    return True


# ── FX Rates ──────────────────────────────────────────────────────────────────

async def list_fx_rates(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    from_currency: str | None = None,
    to_currency: str | None = None,
    rate_type: str | None = None,
    effective_date: date | None = None,
) -> list[TenantFxRate]:
    """List FX rates for a tenant with optional filters."""
    q = select(TenantFxRate).where(TenantFxRate.tenant_id == tenant_id)
    if from_currency:
        q = q.where(TenantFxRate.from_currency == from_currency.upper())
    if to_currency:
        q = q.where(TenantFxRate.to_currency == to_currency.upper())
    if rate_type:
        q = q.where(TenantFxRate.rate_type == rate_type)
    if effective_date:
        q = q.where(TenantFxRate.effective_date == effective_date)
    result = await db.execute(q.order_by(TenantFxRate.effective_date.desc()))
    return list(result.scalars().all())


async def upsert_fx_rate(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    payload: TenantFxRateCreate,
) -> TenantFxRate:
    """Create or update an FX rate for a given date and rate type.

    If an existing rate exists for (tenant, from, to, date, rate_type),
    it is updated rather than duplicated.

    Args:
        payload: FX rate creation payload.

    Returns:
        The created or updated TenantFxRate.
    """
    from_curr = payload.from_currency.upper()
    to_curr = payload.to_currency.upper()

    existing = await db.execute(
        select(TenantFxRate).where(
            TenantFxRate.tenant_id == tenant_id,
            TenantFxRate.from_currency == from_curr,
            TenantFxRate.to_currency == to_curr,
            TenantFxRate.rate_type == payload.rate_type,
            TenantFxRate.effective_date == payload.effective_date,
        )
    )
    rate = existing.scalar_one_or_none()

    if rate:
        rate.rate = payload.rate
        rate.source = payload.source
    else:
        rate = TenantFxRate(
            tenant_id=tenant_id,
            from_currency=from_curr,
            to_currency=to_curr,
            rate=payload.rate,
            rate_type=payload.rate_type,
            effective_date=payload.effective_date,
            source=payload.source,
        )
        db.add(rate)

    await db.flush()
    await db.refresh(rate)
    return rate


async def delete_fx_rate(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    rate_id: uuid.UUID,
) -> bool:
    """Delete an FX rate by ID. Returns True if found and deleted."""
    result = await db.execute(
        select(TenantFxRate).where(
            TenantFxRate.id == rate_id,
            TenantFxRate.tenant_id == tenant_id,
        )
    )
    rate = result.scalar_one_or_none()
    if rate:
        await db.delete(rate)
        await db.flush()
        return True
    return False


async def lookup_rate(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    from_currency: str,
    to_currency: str,
    effective_date: date,
    rate_type: str = "SPOT",
) -> dict | None:
    """Find the most recent rate on or before *effective_date*.

    Falls back to the inverse rate if a direct rate is not found.

    Returns:
        Dict with rate, effective_date, rate_type, is_inverse; or None if no rate found.
    """
    from_curr = from_currency.upper()
    to_curr = to_currency.upper()

    if from_curr == to_curr:
        return {
            "from_currency": from_curr,
            "to_currency": to_curr,
            "rate": Decimal("1"),
            "rate_type": "SPOT",
            "effective_date": effective_date,
            "is_inverse": False,
        }

    # Direct lookup
    result = await db.execute(
        select(TenantFxRate)
        .where(
            TenantFxRate.tenant_id == tenant_id,
            TenantFxRate.from_currency == from_curr,
            TenantFxRate.to_currency == to_curr,
            TenantFxRate.rate_type == rate_type,
            TenantFxRate.effective_date <= effective_date,
        )
        .order_by(TenantFxRate.effective_date.desc())
        .limit(1)
    )
    rate = result.scalar_one_or_none()
    if rate:
        return {
            "from_currency": from_curr,
            "to_currency": to_curr,
            "rate": rate.rate,
            "rate_type": rate.rate_type,
            "effective_date": rate.effective_date,
            "is_inverse": False,
        }

    # Inverse lookup
    inv_result = await db.execute(
        select(TenantFxRate)
        .where(
            TenantFxRate.tenant_id == tenant_id,
            TenantFxRate.from_currency == to_curr,
            TenantFxRate.to_currency == from_curr,
            TenantFxRate.rate_type == rate_type,
            TenantFxRate.effective_date <= effective_date,
        )
        .order_by(TenantFxRate.effective_date.desc())
        .limit(1)
    )
    inv_rate = inv_result.scalar_one_or_none()
    if inv_rate:
        return {
            "from_currency": from_curr,
            "to_currency": to_curr,
            "rate": Decimal("1") / inv_rate.rate,
            "rate_type": inv_rate.rate_type,
            "effective_date": inv_rate.effective_date,
            "is_inverse": True,
        }

    return None


async def import_from_jsonb(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    jsonb_currencies: list[str],
    jsonb_fx_rates: list[dict],
    functional_currency: str = "NGN",
) -> dict[str, int]:
    """Migrate legacy JSONB currency data to the dedicated tables.

    Args:
        jsonb_currencies: List of currency codes from org_setup.enabled_currencies JSONB.
        jsonb_fx_rates: List of rate dicts [{from, to, rate, date, rate_type}] from org_setup.fx_rates.
        functional_currency: The tenant's functional currency code.

    Returns:
        Dict with counts: {currencies_created, rates_created}.
    """
    currencies_created = 0
    rates_created = 0

    for code in jsonb_currencies:
        code = code.upper()
        existing = await db.execute(
            select(TenantCurrency).where(
                TenantCurrency.tenant_id == tenant_id,
                TenantCurrency.currency == code,
            )
        )
        if not existing.scalar_one_or_none():
            tc = TenantCurrency(
                tenant_id=tenant_id,
                currency=code,
                is_functional=(code == functional_currency.upper()),
                is_reporting=(code == functional_currency.upper()),
                is_enabled=True,
            )
            db.add(tc)
            currencies_created += 1

    for rate_data in jsonb_fx_rates:
        try:
            payload = TenantFxRateCreate(
                from_currency=rate_data.get("from", ""),
                to_currency=rate_data.get("to", ""),
                rate=Decimal(str(rate_data.get("rate", 1))),
                rate_type=rate_data.get("rate_type", "SPOT"),
                effective_date=date.fromisoformat(rate_data.get("date", str(date.today()))),
                source="JSONB_MIGRATION",
            )
            await upsert_fx_rate(db, tenant_id, payload)
            rates_created += 1
        except Exception:
            continue  # Skip malformed entries

    await db.flush()
    return {"currencies_created": currencies_created, "rates_created": rates_created}
