"""
Inventory & Warehouse ORM models — M17.

Tables:
  inventory_categories  — product/SKU groupings
  inventory_locations   — warehouse locations (zone/shelf/bin), self-referencing hierarchy
  inventory_items       — stock-keeping units with FIFO or WACC costing and GL linkage
  stock_movements       — append-only ledger; every in/out updates the item balance

Three-mode behaviour:
  Full ERP  — stock_movements.journal_entry_id populated on ISSUE (COGS journal)
  Connected — stock_movements.posting_batch_id would carry the COGS batch (future)
  Lite      — quantity updates only; no GL posting
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

    Costing:
      FIFO — cost flows in order of purchase; unit_cost on StockMovement
             carries the purchase-lot cost.
      WACC — moving_average_cost is updated on each RECEIPT.
             moving_average_cost = (old_qty × old_mac + receipt_qty × receipt_cost)
                                   / (old_qty + receipt_qty)
    """

    __tablename__ = "inventory_items"
    __table_args__ = (
        UniqueConstraint("tenant_id", "item_code", name="uq_inv_item_code"),
        CheckConstraint("valuation_method IN ('FIFO','WACC')", name="ck_inv_item_valuation"),
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
    valuation_method: Mapped[str] = mapped_column(String(5), nullable=False, server_default="WACC")
    gl_inventory_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("chart_of_accounts.id", ondelete="SET NULL"), nullable=True)
    gl_cogs_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("chart_of_accounts.id", ondelete="SET NULL"), nullable=True)
    gl_revenue_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("chart_of_accounts.id", ondelete="SET NULL"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    category: Mapped[Optional[InventoryCategory]] = relationship("InventoryCategory", back_populates="items")
    movements: Mapped[List["StockMovement"]] = relationship("StockMovement", back_populates="item", cascade="all, delete-orphan")


class StockMovement(Base):
    """
    Append-only stock ledger.

    movement_type values:
      RECEIPT     — goods in (purchase, production, return from customer)
      ISSUE       — goods out (sale, production consumption, write-off)
      ADJUSTMENT  — manual quantity correction (stock-take variance)
      TRANSFER    — move between locations (no net quantity change at tenant level)

    quantity is ALWAYS POSITIVE; sign is implied by movement_type:
      RECEIPT / positive ADJUSTMENT → adds to stock
      ISSUE / negative ADJUSTMENT   → reduces stock

    quantity_after and moving_average_cost_after are computed and stored at write
    time for fast reporting without re-traversing the ledger.
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
