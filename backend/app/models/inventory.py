"""
Inventory & Warehouse ORM models — M17 / M17b.

Tables:
  inventory_categories    — product/SKU groupings
  inventory_locations     — warehouse locations (zone/shelf/bin), self-referencing hierarchy
  inventory_items         — stock-keeping units with FIFO, WACC, or STANDARD costing + GL linkage
  inventory_cost_layers   — FIFO cost layers: one row per RECEIPT batch; consumed FIFO on ISSUE
  stock_movements         — append-only stock ledger; every in/out updates the item balance

Three costing methods:
  WACC     — moving average cost; updated on every RECEIPT.
             MAC = (old_qty × old_mac + receipt_qty × receipt_cost) / (old_qty + receipt_qty)
  FIFO     — cost flows in purchase order; inventory_cost_layers tracks each receipt batch.
             ISSUE consumes layers oldest-first; COGS = sum(layer_qty_consumed × layer_unit_cost).
  STANDARD — a fixed standard cost per unit is set on the item.
             RECEIPT: inventory valued at standard_cost; variance between actual purchase price
             and standard is posted to a Purchase Price Variance (PPV) GL account (Full ERP).
             ISSUE: COGS always = qty × standard_cost, regardless of actual receipt cost.

Three-mode GL behaviour:
  Full ERP   — ISSUE: DR COGS / CR Inventory journal.  STANDARD RECEIPT: PPV journal if configured.
  Connected  — ISSUE: PostingBatch created for export to external ERP.
  Lite       — quantity updates only; no GL posting.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import (
    Boolean, CheckConstraint, Date, DateTime, ForeignKey, Index,
    Numeric, String, Text, UniqueConstraint, func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class InventoryCategory(Base):
    """Groups inventory items by type (e.g., Raw Materials, Finished Goods)."""

    __tablename__ = "inventory_categories"
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_inv_category_code"),
        Index("ix_inv_categories_tenant_id", "tenant_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    items: Mapped[List["InventoryItem"]] = relationship("InventoryItem", back_populates="category", cascade="all, delete-orphan")


class InventoryLocation(Base):
    """Physical warehouse location (zone → aisle → shelf → bin). Self-referencing tree."""

    __tablename__ = "inventory_locations"
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_inv_location_code"),
        Index("ix_inv_locations_tenant_id", "tenant_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_locations.id", ondelete="SET NULL"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    children: Mapped[List["InventoryLocation"]] = relationship("InventoryLocation", backref="parent", remote_side="InventoryLocation.id")
    movements: Mapped[List["StockMovement"]] = relationship("StockMovement", back_populates="location")


class InventoryItem(Base):
    """
    A stock-keeping unit (SKU).

    Costing method is set at item level and cannot be changed once movements exist.

    WACC     — moving_average_cost tracks the weighted average; updated on every RECEIPT.
    FIFO     — cost layers track each receipt lot; moving_average_cost is the last RECEIPT
               unit cost (informational only for FIFO items).
    STANDARD — standard_cost is the budgeted/target cost per unit.  moving_average_cost
               is kept equal to standard_cost.  Purchase Price Variance is posted to
               gl_ppv_id when actual receipt cost differs from standard.

    GL fields:
      gl_inventory_id — Balance Sheet: Inventory Asset account
      gl_cogs_id      — P&L: Cost of Goods Sold account (used on ISSUE)
      gl_revenue_id   — P&L: Revenue account (informational; used by AR module)
      gl_ppv_id       — P&L: Purchase Price Variance account (STANDARD costing only)
    """

    __tablename__ = "inventory_items"
    __table_args__ = (
        UniqueConstraint("tenant_id", "item_code", name="uq_inv_item_code"),
        CheckConstraint("valuation_method IN ('FIFO','WACC','STANDARD')", name="ck_inv_item_valuation"),
        Index("ix_inv_items_tenant_id", "tenant_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    category_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_categories.id", ondelete="SET NULL"), nullable=True)
    item_code: Mapped[str] = mapped_column(String(30), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    unit_of_measure: Mapped[str] = mapped_column(String(20), nullable=False, server_default="PCS")
    current_quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, server_default="0")
    reorder_point: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4), nullable=True)
    reorder_quantity: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4), nullable=True)
    standard_cost: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, server_default="0")
    moving_average_cost: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, server_default="0")
    valuation_method: Mapped[str] = mapped_column(String(8), nullable=False, server_default="WACC")
    gl_inventory_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("chart_of_accounts.id", ondelete="SET NULL"), nullable=True)
    gl_cogs_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("chart_of_accounts.id", ondelete="SET NULL"), nullable=True)
    gl_revenue_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("chart_of_accounts.id", ondelete="SET NULL"), nullable=True)
    gl_ppv_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("chart_of_accounts.id", ondelete="SET NULL"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    category: Mapped[Optional[InventoryCategory]] = relationship("InventoryCategory", back_populates="items")
    movements: Mapped[List["StockMovement"]] = relationship("StockMovement", back_populates="item", cascade="all, delete-orphan")
    cost_layers: Mapped[List["InventoryCostLayer"]] = relationship("InventoryCostLayer", back_populates="item", cascade="all, delete-orphan")


class InventoryCostLayer(Base):
    """
    FIFO cost layer — one row per RECEIPT for FIFO-method items.

    Each RECEIPT creates a layer with quantity_remaining = quantity_received.
    Each ISSUE consumes layers in ascending received_date / id order, decrementing
    quantity_remaining until the issue qty is satisfied.  An exhausted layer has
    quantity_remaining = 0 and is never deleted (audit trail).

    Only used for valuation_method = 'FIFO'.  WACC and STANDARD items do not
    create layers.

    Attributes:
        item_id              — FK to inventory_items
        receipt_movement_id  — FK to stock_movements (the RECEIPT that created this layer)
        received_date        — movement_date of the RECEIPT; defines FIFO consumption order
        unit_cost            — per-unit cost at time of receipt
        quantity_received    — original receipt quantity
        quantity_remaining   — remaining unconsumed quantity (0 = exhausted)
    """

    __tablename__ = "inventory_cost_layers"
    __table_args__ = (
        Index("ix_inv_cost_layers_tenant_id", "tenant_id"),
        Index("ix_inv_cost_layers_item_id", "item_id"),
        Index("ix_inv_cost_layers_item_date", "item_id", "received_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    item_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_items.id", ondelete="CASCADE"), nullable=False)
    receipt_movement_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("stock_movements.id", ondelete="SET NULL"), nullable=True)
    received_date: Mapped[date] = mapped_column(Date, nullable=False)
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    quantity_received: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    quantity_remaining: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    item: Mapped[InventoryItem] = relationship("InventoryItem", back_populates="cost_layers")


class StockMovement(Base):
    """
    Append-only stock ledger.

    movement_type values:
      RECEIPT     — goods in (purchase, production, return from customer)
      ISSUE       — goods out (sale, production consumption, write-off)
      ADJUSTMENT  — manual quantity correction (stock-take variance)
      TRANSFER    — move between locations (no net quantity change at tenant level)

    quantity is ALWAYS POSITIVE; sign is implied by movement_type.

    Costing per movement_type / valuation_method:
      RECEIPT:
        WACC     — unit_cost = actual; total_cost = qty × actual; MAC updated
        FIFO     — unit_cost = actual; total_cost = qty × actual; cost layer created
        STANDARD — unit_cost = standard_cost; total_cost = qty × standard_cost;
                   PPV journal posted if actual ≠ standard (Full ERP + gl_ppv_id set)
      ISSUE:
        WACC     — unit_cost = MAC at time of issue; total_cost = qty × MAC
        FIFO     — unit_cost = weighted avg of consumed layers; total_cost = sum of consumed
        STANDARD — unit_cost = standard_cost; total_cost = qty × standard_cost

    quantity_after and moving_average_cost_after are stored at write time for
    fast reporting without replaying the full ledger.
    """

    __tablename__ = "stock_movements"
    __table_args__ = (
        CheckConstraint("movement_type IN ('RECEIPT','ISSUE','ADJUSTMENT','TRANSFER')", name="ck_stock_movement_type"),
        Index("ix_stock_movements_tenant_id", "tenant_id"),
        Index("ix_stock_movements_item_id", "item_id"),
        Index("ix_stock_movements_date", "tenant_id", "movement_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    item_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_items.id", ondelete="RESTRICT"), nullable=False)
    location_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_locations.id", ondelete="SET NULL"), nullable=True)
    movement_type: Mapped[str] = mapped_column(String(20), nullable=False)
    movement_date: Mapped[date] = mapped_column(Date, nullable=False)
    reference: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, server_default="0")
    total_cost: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, server_default="0")
    quantity_after: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, server_default="0")
    moving_average_cost_after: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, server_default="0")
    journal_entry_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("journal_entries.id", ondelete="SET NULL"), nullable=True)
    ap_invoice_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("ap_invoices.id", ondelete="SET NULL"), nullable=True)
    ar_invoice_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("ar_invoices.id", ondelete="SET NULL"), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    item: Mapped[InventoryItem] = relationship("InventoryItem", back_populates="movements")
    location: Mapped[Optional[InventoryLocation]] = relationship("InventoryLocation", back_populates="movements")
