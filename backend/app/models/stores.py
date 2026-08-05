"""Store Issuance & Returns ORM models.

What this module does:
  Defines the SQLAlchemy models for the internal stores module.
  StoreIssue — a keeper-recorded issuance of a consumable item to an employee/department.
  StoreReturn — a return of previously issued items back to the store.

  Both tables post corresponding stock_movements so inventory_items.current_stock stays
  accurate without any additional joins.

How it connects:
  inventory_items    ← is the source item (must be is_store_item=True)
  employees          ← optional recipient
  users              ← issued_by / received_by (store keeper)
  stock_movements    ← foreign reference stored as plain string (not FK) to avoid circular deps
"""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import DateTime, Date, ForeignKey, Index, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class StoreIssue(Base):
    """Records a single issuance of a consumable item from the store.

    Parameters:
        tenant_id          — scopes to a tenant
        inventory_item_id  — the item being issued (should be is_store_item=True)
        employee_id        — recipient employee (nullable if issued to a department/location)
        department         — department or cost centre name (free text)
        location_name      — outlet, site, or location name
        quantity_issued    — quantity dispensed (uses item's unit_of_measure)
        unit_of_measure    — override or inherited from item
        issue_date         — date of physical issue
        purpose            — brief reason for issuance
        reference          — any internal reference number
        issued_by          — user (store keeper) recording the issue
        stock_movement_id  — ID of the OUT movement posted to stock_movements (loose UUID, no FK)
    """

    __tablename__ = "store_issues"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    inventory_item_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_items.id", ondelete="RESTRICT"), nullable=False)
    employee_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)
    department: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    location_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    quantity_issued: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    unit_of_measure: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    issue_date: Mapped[date] = mapped_column(Date(), nullable=False)
    purpose: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    reference: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text(), nullable=True)
    issued_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    stock_movement_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(), server_default=func.now(), nullable=False)

    # Relationships
    returns: Mapped[list["StoreReturn"]] = relationship("StoreReturn", back_populates="issue", lazy="select")

    __table_args__ = (
        Index("ix_store_issues_tenant_id", "tenant_id"),
        Index("ix_store_issues_item_id", "inventory_item_id"),
        Index("ix_store_issues_issue_date", "issue_date"),
    )


class StoreReturn(Base):
    """Records items returned to the store by an employee.

    Parameters:
        store_issue_id     — the original issue this return relates to (nullable: can return without ref)
        inventory_item_id  — item being returned
        employee_id        — who is returning (nullable if unknown)
        quantity_returned  — how many units returned
        return_date        — date of physical return
        condition          — GOOD / DAMAGED / PARTIAL
        received_by        — store keeper receiving the return
        stock_movement_id  — ID of the IN movement posted to stock_movements (loose UUID, no FK)
    """

    __tablename__ = "store_returns"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    store_issue_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("store_issues.id", ondelete="SET NULL"), nullable=True)
    inventory_item_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_items.id", ondelete="RESTRICT"), nullable=False)
    employee_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)
    quantity_returned: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    return_date: Mapped[date] = mapped_column(Date(), nullable=False)
    condition: Mapped[str] = mapped_column(String(20), nullable=False, default="GOOD")
    notes: Mapped[Optional[str]] = mapped_column(Text(), nullable=True)
    received_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    stock_movement_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(), server_default=func.now(), nullable=False)

    # Relationships
    issue: Mapped[Optional["StoreIssue"]] = relationship("StoreIssue", back_populates="returns", lazy="select")

    __table_args__ = (
        Index("ix_store_returns_tenant_id", "tenant_id"),
        Index("ix_store_returns_item_id", "inventory_item_id"),
    )
