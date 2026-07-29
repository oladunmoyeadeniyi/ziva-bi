"""
Fixed Assets ORM models — M18.

Four tables:
  AssetCategory                — depreciation template (useful life, method, GL accounts)
  Asset                        — individual asset register entry
  AssetDepreciationSchedule    — monthly depreciation schedule row per asset
  AssetDisposal                — disposal / write-off record

Depreciation methods:
  SL  (Straight-Line):      monthly_dep = (cost − residual) / useful_life_months
  RB  (Reducing Balance):   monthly_dep = current_book_value × monthly_rate
                            where monthly_rate = 1 − (residual/cost)^(1/useful_life_months)

Three-mode GL posting on run_monthly_depreciation():
  Full ERP  → journal_entries (DR dep expense / CR accumulated depreciation)
  Connected → posting_batches
  Lite      → update accumulated_depreciation + book_value on asset only
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base


class AssetCategory(Base):
    """
    Depreciation template for a class of assets.

    Defines useful life, depreciation method, residual %, and GL account pointers.
    Individual assets inherit these defaults but can override them.

    Attributes:
        useful_life_months: Total depreciable life in calendar months.
        depreciation_method: SL | RB.
        residual_pct:        Residual value as fraction of cost (e.g. 0.10 = 10%).
        gl_asset_account_id:      Asset at cost GL.
        gl_accumulated_dep_id:    Accumulated depreciation GL (contra asset).
        gl_dep_expense_id:        Depreciation expense GL.
    """

    __tablename__ = "asset_categories"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    useful_life_months: Mapped[int] = mapped_column(Integer, nullable=False)
    depreciation_method: Mapped[str] = mapped_column(String(5), nullable=False, default="SL")
    residual_pct: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False, default=Decimal("0"))
    gl_asset_account_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("chart_of_accounts.id", ondelete="SET NULL"), nullable=True)
    gl_accumulated_dep_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("chart_of_accounts.id", ondelete="SET NULL"), nullable=True)
    gl_dep_expense_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("chart_of_accounts.id", ondelete="SET NULL"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("depreciation_method IN ('SL','RB')", name="ck_asset_cat_dep_method"),
        UniqueConstraint("tenant_id", "code", name="uq_asset_category_code"),
    )

    assets: Mapped[list[Asset]] = relationship("Asset", back_populates="category")


class Asset(Base):
    """
    Individual asset register entry.

    Attributes:
        asset_code:             Auto-generated e.g. FA-0001.
        acquisition_date:       Purchase date (depreciation starts here).
        acquisition_cost:       Cost of acquisition (excludes installation if not capitalised).
        useful_life_months:     Remaining useful life (can differ from category default).
        residual_value:         Absolute residual value (derived from cost × category.residual_pct).
        accumulated_depreciation: Running total of depreciation charged.
        current_book_value:     cost − accumulated_depreciation.
        status:                 ACTIVE | DISPOSED | IMPAIRED | FULLY_DEPRECIATED.
    """

    __tablename__ = "assets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("asset_categories.id", ondelete="RESTRICT"), nullable=False, index=True)
    asset_code: Mapped[str] = mapped_column(String(30), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    serial_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    acquisition_date: Mapped[date] = mapped_column(Date, nullable=False)
    acquisition_cost: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    useful_life_months: Mapped[int] = mapped_column(Integer, nullable=False)
    depreciation_method: Mapped[str] = mapped_column(String(5), nullable=False, default="SL")
    residual_value: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    accumulated_depreciation: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    current_book_value: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE")
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="NGN")
    vendor_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("vendors.id", ondelete="SET NULL"), nullable=True)
    ap_invoice_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("ap_invoices.id", ondelete="SET NULL"), nullable=True)
    department_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("org_structure.id", ondelete="SET NULL"), nullable=True)
    created_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("status IN ('ACTIVE','DISPOSED','IMPAIRED','FULLY_DEPRECIATED')", name="ck_asset_status"),
        CheckConstraint("depreciation_method IN ('SL','RB')", name="ck_asset_dep_method"),
        UniqueConstraint("tenant_id", "asset_code", name="uq_asset_code"),
    )

    category: Mapped[AssetCategory] = relationship("AssetCategory", back_populates="assets")
    depreciation_schedules: Mapped[list[AssetDepreciationSchedule]] = relationship(
        "AssetDepreciationSchedule", back_populates="asset", cascade="all, delete-orphan"
    )
    disposal: Mapped[Optional[AssetDisposal]] = relationship("AssetDisposal", back_populates="asset", uselist=False)


class AssetDepreciationSchedule(Base):
    """
    One monthly depreciation entry for an asset.

    Generated in bulk by run_monthly_depreciation().
    is_posted flips True when GL journal is created (Full ERP / Connected).

    Attributes:
        schedule_date:          First day of the month this row covers.
        depreciation_amount:    Monthly charge.
        accumulated_depreciation: Cumulative total after this month.
        book_value_after:       Net book value after this month's charge.
        is_posted:              True when journal entry has been created.
        journal_entry_id:       FK to journal entry if Full ERP.
    """

    __tablename__ = "asset_depreciation_schedules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, index=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    schedule_date: Mapped[date] = mapped_column(Date, nullable=False)
    depreciation_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    accumulated_depreciation: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    book_value_after: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    is_posted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    journal_entry_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("journal_entries.id", ondelete="SET NULL"), nullable=True)
    posted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("asset_id", "schedule_date", name="uq_dep_schedule_month"),
    )

    asset: Mapped[Asset] = relationship("Asset", back_populates="depreciation_schedules")


class AssetDisposal(Base):
    """
    Disposal / write-off record for a fully disposed asset.

    One row per asset (unique constraint on asset_id).

    Attributes:
        disposal_type:         SALE | WRITE_OFF | DONATION | SCRAPPED.
        disposal_proceeds:     Cash received (0 for write-offs).
        book_value_at_disposal: NBV at the time of disposal.
        gain_loss:             disposal_proceeds − book_value_at_disposal.
        journal_entry_id:      GL journal for the disposal (Full ERP).
    """

    __tablename__ = "asset_disposals"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("assets.id", ondelete="RESTRICT"), nullable=False, unique=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    disposal_date: Mapped[date] = mapped_column(Date, nullable=False)
    disposal_type: Mapped[str] = mapped_column(String(20), nullable=False)
    disposal_proceeds: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    book_value_at_disposal: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    gain_loss: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    journal_entry_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("journal_entries.id", ondelete="SET NULL"), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    disposed_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("disposal_type IN ('SALE','WRITE_OFF','DONATION','SCRAPPED')", name="ck_disposal_type"),
    )

    asset: Mapped[Asset] = relationship("Asset", back_populates="disposal")
