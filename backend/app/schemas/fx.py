"""Pydantic schemas for FX — dedicated currency and exchange-rate tables.

Replaces the JSONB-based currency/rate endpoints with proper typed schemas
backed by tenant_currencies and tenant_fx_rates tables.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


# ── Currencies ────────────────────────────────────────────────────────────────

class TenantCurrencyCreate(BaseModel):
    """Enable a new currency for the tenant.

    Args:
        currency: ISO 4217 alpha-3 code (e.g. "USD", "GBP").
        is_functional: Mark as functional currency (only one allowed).
        is_reporting: Mark as reporting currency (only one allowed).
    """

    currency: str = Field(..., min_length=3, max_length=3)
    is_functional: bool = False
    is_reporting: bool = False
    is_enabled: bool = True


class TenantCurrencyUpdate(BaseModel):
    is_functional: bool | None = None
    is_reporting: bool | None = None
    is_enabled: bool | None = None


class TenantCurrencyResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    currency: str
    is_functional: bool
    is_reporting: bool
    is_enabled: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── FX Rates ──────────────────────────────────────────────────────────────────

class TenantFxRateCreate(BaseModel):
    """Create or upsert an exchange rate.

    Args:
        from_currency: Source currency ISO 4217 code.
        to_currency: Target currency ISO 4217 code.
        rate: 1 unit of from_currency in to_currency terms (must be > 0).
        rate_type: SPOT | CLOSING | AVERAGE | BUDGET.
        effective_date: Date the rate applies to.
    """

    from_currency: str = Field(..., min_length=3, max_length=3)
    to_currency: str = Field(..., min_length=3, max_length=3)
    rate: Decimal = Field(..., gt=0)
    rate_type: Literal["SPOT", "CLOSING", "AVERAGE", "BUDGET"] = "SPOT"
    effective_date: date
    source: str = "MANUAL"


class TenantFxRateResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    from_currency: str
    to_currency: str
    rate: Decimal
    rate_type: str
    effective_date: date
    source: str
    created_at: datetime

    model_config = {"from_attributes": True}


class FxRateLookupResponse(BaseModel):
    """Response for a single rate lookup.

    Args:
        rate: Exchange rate for 1 unit of from_currency → to_currency.
        effective_date: The date this rate was effective.
        is_inverse: True if the rate was found in the inverse direction and inverted.
    """

    from_currency: str
    to_currency: str
    rate: Decimal
    rate_type: str
    effective_date: date
    is_inverse: bool = False


# ── Revaluation Rules (FX-b) ──────────────────────────────────────────────────

class FxRevaluationRuleCreate(BaseModel):
    """Create or update a period-end FX revaluation rule.

    Args:
        account_type: GL account type subject to revaluation
                      (e.g. MONETARY_ASSET, MONETARY_LIABILITY).
        rate_type: Which FX rate to use at revaluation — CLOSING | AVERAGE | BUDGET | SPOT.
        gain_account_id: GL account UUID for recording FX gains.
        loss_account_id: GL account UUID for recording FX losses.
        is_active: Whether the rule is currently in effect.
    """

    account_type: str = Field(..., min_length=1, max_length=50)
    rate_type: Literal["SPOT", "CLOSING", "AVERAGE", "BUDGET"] = "CLOSING"
    gain_account_id: uuid.UUID | None = None
    loss_account_id: uuid.UUID | None = None
    is_active: bool = True


class FxRevaluationRuleUpdate(BaseModel):
    rate_type: Literal["SPOT", "CLOSING", "AVERAGE", "BUDGET"] | None = None
    gain_account_id: uuid.UUID | None = None
    loss_account_id: uuid.UUID | None = None
    is_active: bool | None = None


class FxRevaluationRuleResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    account_type: str
    rate_type: str
    gain_account_id: uuid.UUID | None
    loss_account_id: uuid.UUID | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── BDC Register (FX-b) ───────────────────────────────────────────────────────

class BdcEntryCreate(BaseModel):
    """Record a Bureau de Change or parallel-market rate quote.

    Args:
        from_currency: Currency being sold (ISO 4217, e.g. "NGN").
        to_currency: Currency being bought (ISO 4217, e.g. "USD").
        rate: BDC rate — 1 unit of from_currency in to_currency terms.
        quote_date: Date the quote was obtained.
        bdc_name: Name of the Bureau de Change or market source.
        reference: Internal reference or transaction number.
        notes: Free-text notes for this entry.
    """

    from_currency: str = Field(..., min_length=3, max_length=3)
    to_currency: str = Field(..., min_length=3, max_length=3)
    rate: Decimal = Field(..., gt=0)
    quote_date: date
    bdc_name: str | None = Field(None, max_length=200)
    reference: str | None = Field(None, max_length=200)
    notes: str | None = None


class BdcEntryResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    from_currency: str
    to_currency: str
    rate: Decimal
    quote_date: date
    bdc_name: str | None
    reference: str | None
    notes: str | None
    created_by: uuid.UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}
