"""
Pydantic schemas for Inventory & Warehouse — M17 / M17b.

Covers categories, locations, items (with all three costing methods),
cost layers (FIFO), and stock movements.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator


# ── Categories ────────────────────────────────────────────────────────────────

class InventoryCategoryCreate(BaseModel):
    """Create a new inventory category."""
    name: str
    code: str
    is_active: bool = True


class InventoryCategoryUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None


class InventoryCategoryResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    code: str
    is_active: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ── Locations ─────────────────────────────────────────────────────────────────

class InventoryLocationCreate(BaseModel):
    """Create a warehouse location (zone/aisle/shelf/bin)."""
    name: str
    code: str
    parent_id: Optional[uuid.UUID] = None
    is_active: bool = True


class InventoryLocationUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None


class InventoryLocationResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    code: str
    parent_id: Optional[uuid.UUID]
    is_active: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ── Items ─────────────────────────────────────────────────────────────────────

VALID_VALUATION_METHODS = ("FIFO", "WACC", "STANDARD")


class InventoryItemCreate(BaseModel):
    """
    Create a stock-keeping unit (SKU).

    valuation_method choices:
      WACC     — moving average cost (default); best for high-volume, fungible goods
      FIFO     — first in, first out; suitable for perishables, batch-tracked goods,
                 or where older stock must be consumed first (pharma, food & beverage)
      STANDARD — fixed standard cost per unit; common in manufacturing and trading
                 subsidiaries (e.g. FMCG distributors) that set annual budgeted costs
                 and measure Purchase Price Variance against actuals

    For STANDARD items, set standard_cost to the budgeted unit cost and optionally
    supply gl_ppv_id (Purchase Price Variance GL account) to auto-post PPV journals
    in Full ERP mode when actual receipt price differs from standard.
    """
    category_id: Optional[uuid.UUID] = None
    item_code: str
    name: str
    description: Optional[str] = None
    unit_of_measure: str = "PCS"
    reorder_point: Optional[Decimal] = None
    reorder_quantity: Optional[Decimal] = None
    standard_cost: Decimal = Decimal("0")
    valuation_method: str = "WACC"
    gl_inventory_id: Optional[uuid.UUID] = None
    gl_cogs_id: Optional[uuid.UUID] = None
    gl_revenue_id: Optional[uuid.UUID] = None
    gl_ppv_id: Optional[uuid.UUID] = None
    is_active: bool = True

    @field_validator("valuation_method")
    @classmethod
    def validate_valuation(cls, v: str) -> str:
        if v not in VALID_VALUATION_METHODS:
            raise ValueError(f"valuation_method must be one of: {', '.join(VALID_VALUATION_METHODS)}")
        return v


class InventoryItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    unit_of_measure: Optional[str] = None
    reorder_point: Optional[Decimal] = None
    reorder_quantity: Optional[Decimal] = None
    standard_cost: Optional[Decimal] = None
    gl_inventory_id: Optional[uuid.UUID] = None
    gl_cogs_id: Optional[uuid.UUID] = None
    gl_revenue_id: Optional[uuid.UUID] = None
    gl_ppv_id: Optional[uuid.UUID] = None
    is_active: Optional[bool] = None


class InventoryItemResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    category_id: Optional[uuid.UUID]
    category_name: Optional[str] = None
    item_code: str
    name: str
    description: Optional[str]
    unit_of_measure: str
    current_quantity: Decimal
    reorder_point: Optional[Decimal]
    reorder_quantity: Optional[Decimal]
    standard_cost: Decimal
    moving_average_cost: Decimal
    valuation_method: str
    gl_inventory_id: Optional[uuid.UUID]
    gl_cogs_id: Optional[uuid.UUID]
    gl_revenue_id: Optional[uuid.UUID]
    gl_ppv_id: Optional[uuid.UUID]
    is_active: bool
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ── Cost Layers (FIFO) ────────────────────────────────────────────────────────

class InventoryCostLayerResponse(BaseModel):
    """
    A single FIFO cost layer for an item.  Returned by the cost-layers endpoint
    so users can inspect the lot structure of FIFO items.
    """
    id: uuid.UUID
    item_id: uuid.UUID
    receipt_movement_id: Optional[uuid.UUID]
    received_date: date
    unit_cost: Decimal
    quantity_received: Decimal
    quantity_remaining: Decimal
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ── Stock Movements ───────────────────────────────────────────────────────────

class StockMovementCreate(BaseModel):
    """
    Record a stock movement.

    quantity is always positive.
    For ISSUE and ADJUSTMENT (quantity reduction), the router applies the sign.

    unit_cost semantics depend on the item's valuation_method:
      WACC     — actual purchase cost per unit on RECEIPT; left 0 on ISSUE (MAC used)
      FIFO     — actual purchase cost per unit on RECEIPT; left 0 on ISSUE (layer cost used)
      STANDARD — actual purchase cost per unit on RECEIPT (used to compute PPV);
                 left 0 on ISSUE (standard_cost always used for COGS)
    """
    item_id: uuid.UUID
    location_id: Optional[uuid.UUID] = None
    movement_type: str
    movement_date: date
    reference: Optional[str] = None
    quantity: Decimal
    unit_cost: Decimal = Decimal("0")
    notes: Optional[str] = None
    ap_invoice_id: Optional[uuid.UUID] = None
    ar_invoice_id: Optional[uuid.UUID] = None

    @field_validator("movement_type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in ("RECEIPT", "ISSUE", "ADJUSTMENT", "TRANSFER"):
            raise ValueError("movement_type must be RECEIPT, ISSUE, ADJUSTMENT, or TRANSFER")
        return v

    @field_validator("quantity")
    @classmethod
    def validate_qty(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("quantity must be positive")
        return v


class StockMovementResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    item_id: uuid.UUID
    location_id: Optional[uuid.UUID]
    movement_type: str
    movement_date: date
    reference: Optional[str]
    quantity: Decimal
    unit_cost: Decimal
    total_cost: Decimal
    quantity_after: Decimal
    moving_average_cost_after: Decimal
    journal_entry_id: Optional[uuid.UUID]
    ap_invoice_id: Optional[uuid.UUID]
    ar_invoice_id: Optional[uuid.UUID]
    notes: Optional[str]
    created_by_id: Optional[uuid.UUID]
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ── Stock Valuation Report ────────────────────────────────────────────────────

class StockValuationRow(BaseModel):
    item_id: uuid.UUID
    item_code: str
    item_name: str
    category_name: Optional[str]
    unit_of_measure: str
    valuation_method: str
    current_quantity: Decimal
    unit_cost: Decimal          # method-appropriate: WACC=MAC, FIFO=layer-weighted-avg, STANDARD=standard_cost
    total_value: Decimal
    reorder_point: Optional[Decimal]
    below_reorder: bool


class StockValuationResponse(BaseModel):
    as_at: date
    rows: list[StockValuationRow]
    total_inventory_value: Decimal
