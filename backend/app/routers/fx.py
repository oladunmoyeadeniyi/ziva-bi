"""Router — FX Currency & Exchange Rate Management.

Replaces the JSONB-backed currency/rate endpoints with proper
tenant_currencies and tenant_fx_rates table operations.

Route map:
  GET    /api/fx/currencies              — list enabled currencies
  POST   /api/fx/currencies              — enable a new currency
  PATCH  /api/fx/currencies/{id}         — update functional/reporting/enabled flags
  DELETE /api/fx/currencies/{id}         — remove a currency

  GET    /api/fx/rates                   — list FX rates (filterable)
  POST   /api/fx/rates                   — upsert a rate
  DELETE /api/fx/rates/{id}              — delete a rate

  GET    /api/fx/rates/lookup            — look up a specific rate for a date
  POST   /api/fx/migrate-from-jsonb      — import JSONB legacy data to new tables
"""

import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import CurrentUser, require_auth
from app.schemas.fx import (
    FxRateLookupResponse,
    TenantCurrencyCreate,
    TenantCurrencyResponse,
    TenantCurrencyUpdate,
    TenantFxRateCreate,
    TenantFxRateResponse,
)
from app.services import fx_service as svc

router = APIRouter(prefix="/api/fx", tags=["fx"])


# ── Currencies ────────────────────────────────────────────────────────────────

@router.get("/currencies", response_model=list[TenantCurrencyResponse])
async def list_currencies(
    enabled_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> list[TenantCurrencyResponse]:
    """List all currencies enabled for this tenant."""
    currencies = await svc.list_currencies(db, current_user.tenant_id, enabled_only)
    return [TenantCurrencyResponse.model_validate(c) for c in currencies]


@router.post("/currencies", response_model=TenantCurrencyResponse, status_code=status.HTTP_201_CREATED)
async def add_currency(
    payload: TenantCurrencyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> TenantCurrencyResponse:
    """Enable a new currency for this tenant."""
    try:
        currency = await svc.add_currency(db, current_user.tenant_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    await db.commit()
    return TenantCurrencyResponse.model_validate(currency)


@router.patch("/currencies/{currency_id}", response_model=TenantCurrencyResponse)
async def update_currency(
    currency_id: uuid.UUID,
    payload: TenantCurrencyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> TenantCurrencyResponse:
    """Update functional/reporting/enabled flags for a currency."""
    try:
        currency = await svc.update_currency(db, current_user.tenant_id, currency_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    if not currency:
        raise HTTPException(status_code=404, detail="Currency not found")
    await db.commit()
    return TenantCurrencyResponse.model_validate(currency)


@router.delete("/currencies/{currency_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_currency(
    currency_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> None:
    """Remove a currency from the tenant. Cannot delete functional or reporting currency."""
    try:
        deleted = await svc.delete_currency(db, current_user.tenant_id, currency_id)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    if not deleted:
        raise HTTPException(status_code=404, detail="Currency not found")
    await db.commit()


# ── FX Rates ──────────────────────────────────────────────────────────────────

@router.get("/rates", response_model=list[TenantFxRateResponse])
async def list_fx_rates(
    from_currency: str | None = Query(None),
    to_currency: str | None = Query(None),
    rate_type: str | None = Query(None),
    effective_date: date | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> list[TenantFxRateResponse]:
    """List FX rates for the tenant, with optional filters."""
    rates = await svc.list_fx_rates(
        db, current_user.tenant_id, from_currency, to_currency, rate_type, effective_date
    )
    return [TenantFxRateResponse.model_validate(r) for r in rates]


@router.post("/rates", response_model=TenantFxRateResponse, status_code=status.HTTP_201_CREATED)
async def upsert_fx_rate(
    payload: TenantFxRateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> TenantFxRateResponse:
    """Create or update an FX rate. Idempotent on (from, to, date, rate_type)."""
    rate = await svc.upsert_fx_rate(db, current_user.tenant_id, payload)
    await db.commit()
    return TenantFxRateResponse.model_validate(rate)


@router.delete("/rates/{rate_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_fx_rate(
    rate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> None:
    """Delete an FX rate by ID."""
    deleted = await svc.delete_fx_rate(db, current_user.tenant_id, rate_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="FX rate not found")
    await db.commit()


@router.get("/rates/lookup", response_model=FxRateLookupResponse)
async def lookup_rate(
    from_currency: str = Query(..., min_length=3, max_length=3),
    to_currency: str = Query(..., min_length=3, max_length=3),
    effective_date: date = Query(...),
    rate_type: str = Query("SPOT"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> FxRateLookupResponse:
    """Look up the exchange rate for a currency pair on a given date.

    Falls back to inverse rate if direct rate is not found.
    """
    result = await svc.lookup_rate(
        db, current_user.tenant_id, from_currency, to_currency, effective_date, rate_type
    )
    if not result:
        raise HTTPException(
            status_code=404,
            detail=f"No {rate_type} rate found for {from_currency}/{to_currency} on or before {effective_date}",
        )
    return FxRateLookupResponse(**result)


# ── JSONB migration ───────────────────────────────────────────────────────────

class JsonbMigratePayload(TenantCurrencyCreate):
    """Internal payload for migrating JSONB currency/rate data."""
    pass


@router.post("/migrate-from-jsonb", status_code=status.HTTP_200_OK)
async def migrate_from_jsonb(
    currencies: list[str],
    fx_rates: list[dict],
    functional_currency: str = "NGN",
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> dict:
    """Migrate legacy JSONB currency/rate data to the dedicated tables.

    This is a one-time migration endpoint. It is idempotent — running it
    multiple times will not create duplicates.

    Args:
        currencies: List of ISO 4217 currency codes from org_setup JSONB.
        fx_rates: List of rate dicts from org_setup JSONB.
        functional_currency: The tenant's functional currency code.
    """
    result = await svc.import_from_jsonb(
        db, current_user.tenant_id, currencies, fx_rates, functional_currency
    )
    await db.commit()
    return result
