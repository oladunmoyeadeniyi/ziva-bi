"""Pydantic schemas for Asset Issuance & Tracking endpoints.

Used by: routers/asset_issuance.py
Models:  app.models.asset_issuance (AssetIssuance, AssetMaintenanceCost)
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


# ── Asset Issuance ─────────────────────────────────────────────────────────────

class AssetIssuanceCreate(BaseModel):
    """Issue an asset to a staff member or location."""
    asset_id: uuid.UUID
    employee_id: Optional[uuid.UUID] = None
    location_name: Optional[str] = Field(None, max_length=200)
    issue_date: date
    expected_return_date: Optional[date] = None
    condition_at_issue: Optional[str] = Field(None, max_length=50)
    notes: Optional[str] = None


class AssetIssuanceReturn(BaseModel):
    """Record a return for an active issuance."""
    returned_at: date
    condition_at_return: Optional[str] = Field(None, max_length=50)
    notes: Optional[str] = None


class AssetIssuanceRead(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    asset_id: uuid.UUID
    employee_id: Optional[uuid.UUID]
    location_name: Optional[str]
    issue_date: date
    expected_return_date: Optional[date]
    returned_at: Optional[date]
    status: str
    condition_at_issue: Optional[str]
    condition_at_return: Optional[str]
    notes: Optional[str]
    issued_by: Optional[uuid.UUID]
    returned_by: Optional[uuid.UUID]
    created_at: datetime
    updated_at: datetime

    # Joined display fields (populated by router query)
    asset_name: Optional[str] = None
    asset_code: Optional[str] = None
    employee_name: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Asset Maintenance Cost ─────────────────────────────────────────────────────

VALID_MAINTENANCE_TYPES = ["REPAIR", "PREVENTIVE", "INSPECTION", "UPGRADE", "OTHER"]

class AssetMaintenanceCostCreate(BaseModel):
    asset_id: uuid.UUID
    maintenance_date: date
    description: str = Field(..., max_length=500)
    cost: Decimal = Field(..., gt=0)
    currency_code: str = Field("NGN", max_length=3)
    maintenance_type: Optional[str] = Field(None, max_length=50)
    vendor_name: Optional[str] = Field(None, max_length=200)
    reference: Optional[str] = Field(None, max_length=100)
    gl_account_id: Optional[uuid.UUID] = None


class AssetMaintenanceCostRead(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    asset_id: uuid.UUID
    maintenance_date: date
    description: str
    cost: Decimal
    currency_code: str
    maintenance_type: Optional[str]
    journal_entry_id: Optional[uuid.UUID]
    gl_account_id: Optional[uuid.UUID]
    vendor_name: Optional[str]
    reference: Optional[str]
    recorded_by: Optional[uuid.UUID]
    created_at: datetime

    # Joined display fields
    asset_name: Optional[str] = None

    model_config = {"from_attributes": True}
