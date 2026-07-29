"""Pydantic schemas for Fixed Assets — M18."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict


class AssetCategoryCreate(BaseModel):
    name: str
    code: str
    useful_life_months: int
    depreciation_method: str = "SL"
    residual_pct: Decimal = Decimal("0")
    gl_asset_account_id: Optional[uuid.UUID] = None
    gl_accumulated_dep_id: Optional[uuid.UUID] = None
    gl_dep_expense_id: Optional[uuid.UUID] = None


class AssetCategoryResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    code: str
    useful_life_months: int
    depreciation_method: str
    residual_pct: Decimal
    gl_asset_account_id: Optional[uuid.UUID]
    gl_accumulated_dep_id: Optional[uuid.UUID]
    gl_dep_expense_id: Optional[uuid.UUID]
    is_active: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class AssetCreate(BaseModel):
    category_id: uuid.UUID
    name: str
    description: Optional[str] = None
    serial_number: Optional[str] = None
    location: Optional[str] = None
    acquisition_date: date
    acquisition_cost: Decimal
    useful_life_months: Optional[int] = None    # defaults from category
    depreciation_method: Optional[str] = None   # defaults from category
    residual_pct: Optional[Decimal] = None      # defaults from category
    currency: str = "NGN"
    vendor_id: Optional[uuid.UUID] = None
    ap_invoice_id: Optional[uuid.UUID] = None
    department_id: Optional[uuid.UUID] = None


class AssetResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    category_id: uuid.UUID
    category_name: Optional[str] = None
    asset_code: str
    name: str
    description: Optional[str]
    serial_number: Optional[str]
    location: Optional[str]
    acquisition_date: date
    acquisition_cost: Decimal
    useful_life_months: int
    depreciation_method: str
    residual_value: Decimal
    accumulated_depreciation: Decimal
    current_book_value: Decimal
    status: str
    currency: str
    vendor_id: Optional[uuid.UUID]
    ap_invoice_id: Optional[uuid.UUID]
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class DepreciationScheduleResponse(BaseModel):
    id: uuid.UUID
    asset_id: uuid.UUID
    schedule_date: date
    depreciation_amount: Decimal
    accumulated_depreciation: Decimal
    book_value_after: Decimal
    is_posted: bool
    journal_entry_id: Optional[uuid.UUID]
    posted_at: Optional[datetime]
    model_config = ConfigDict(from_attributes=True)


class DisposalCreate(BaseModel):
    disposal_date: date
    disposal_type: str
    disposal_proceeds: Decimal = Decimal("0")
    notes: Optional[str] = None


class DisposalResponse(BaseModel):
    id: uuid.UUID
    asset_id: uuid.UUID
    disposal_date: date
    disposal_type: str
    disposal_proceeds: Decimal
    book_value_at_disposal: Decimal
    gain_loss: Decimal
    journal_entry_id: Optional[uuid.UUID]
    notes: Optional[str]
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
