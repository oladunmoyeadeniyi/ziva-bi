"""Pydantic schemas for the Store Issuance & Returns module.

What this module does:
  Defines request/response shapes for the /api/stores/* endpoints.
  StoreItemConfig  — update is_store_item, min_stock, reorder_qty on an inventory item
  StoreIssueCreate — body for recording a new issue
  StoreIssueRead   — response including item_name, employee_name
  StoreReturnCreate — body for recording a return
  StoreReturnRead  — response including item_name, employee_name, issue reference
  StoreAnalyticsItem — per-item usage analytics (avg consumption, days of stock, etc.)
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, field_validator


class StoreItemConfig(BaseModel):
    """PATCH /api/stores/items/{item_id}/config — mark an item as a store item."""
    is_store_item: bool
    minimum_stock_level: Optional[int] = None
    reorder_quantity: Optional[int] = None


class StoreIssueCreate(BaseModel):
    """POST /api/stores/issues — record a new issuance."""
    inventory_item_id: str
    employee_id: Optional[str] = None
    department: Optional[str] = None
    location_name: Optional[str] = None
    quantity_issued: Decimal
    issue_date: date
    purpose: Optional[str] = None
    reference: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("quantity_issued")
    @classmethod
    def qty_positive(cls, v: Decimal) -> Decimal:
        """Ensure quantity is greater than zero."""
        if v <= 0:
            raise ValueError("quantity_issued must be greater than zero")
        return v


class StoreIssueRead(BaseModel):
    """Response for a store issue record."""
    id: str
    inventory_item_id: str
    item_name: str
    item_code: str
    employee_id: Optional[str]
    employee_name: Optional[str]
    department: Optional[str]
    location_name: Optional[str]
    quantity_issued: Decimal
    unit_of_measure: Optional[str]
    issue_date: date
    purpose: Optional[str]
    reference: Optional[str]
    notes: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class StoreReturnCreate(BaseModel):
    """POST /api/stores/issues/{id}/return or POST /api/stores/returns — record a return."""
    inventory_item_id: str
    store_issue_id: Optional[str] = None
    employee_id: Optional[str] = None
    quantity_returned: Decimal
    return_date: date
    condition: str = "GOOD"
    notes: Optional[str] = None

    @field_validator("quantity_returned")
    @classmethod
    def qty_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("quantity_returned must be greater than zero")
        return v

    @field_validator("condition")
    @classmethod
    def valid_condition(cls, v: str) -> str:
        if v not in ("GOOD", "DAMAGED", "PARTIAL"):
            raise ValueError("condition must be GOOD, DAMAGED, or PARTIAL")
        return v


class StoreReturnRead(BaseModel):
    """Response for a store return record."""
    id: str
    inventory_item_id: str
    item_name: str
    store_issue_id: Optional[str]
    employee_id: Optional[str]
    employee_name: Optional[str]
    quantity_returned: Decimal
    return_date: date
    condition: str
    notes: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class StoreAnalyticsItem(BaseModel):
    """Usage analytics for a single store item."""
    inventory_item_id: str
    item_name: str
    item_code: str
    unit_of_measure: Optional[str]
    current_stock: Decimal
    minimum_stock_level: Optional[int]
    reorder_quantity: Optional[int]
    total_issued_30d: Decimal        # total quantity issued in last 30 days
    total_issued_90d: Decimal        # total quantity issued in last 90 days
    avg_daily_usage: Decimal         # avg units issued per day (90-day window)
    avg_monthly_usage: Decimal       # avg units issued per month (90-day window)
    days_of_stock_remaining: Optional[Decimal]   # current_stock / avg_daily_usage; None if avg=0
    below_minimum: bool              # current_stock < minimum_stock_level
    reorder_recommended: bool        # days_of_stock_remaining < 14 or below_minimum
    last_issue_date: Optional[date]
    last_return_date: Optional[date]
