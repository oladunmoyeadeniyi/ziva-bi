"""ORM models for Asset Issuance & Tracking.

Why this module exists:
  The existing `assets` table (models/fixed_assets.py) covers the financial asset register.
  This module adds tracking tables for *physical custody* of assets:

  AssetIssuance — who currently has an asset and the full issuance history.
    Supports both staff assignments (laptop → employee) and location assignments
    (POSM cooler → outlet). One asset can have many issuance records over its lifetime.

  AssetMaintenanceCost — records of maintenance or repair spend per asset.
    Used to track total cost of ownership beyond depreciation.

Both tables FK to assets.id — no changes to the Asset model itself.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Date, ForeignKey, Numeric, String, Text, TIMESTAMP, text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AssetIssuance(Base):
    """Tracks the physical custody of an asset over time.

    One active issuance record per asset at any given time (status=ACTIVE).
    When an asset is transferred, the old record is closed (TRANSFERRED) and
    a new ACTIVE record is created.

    Assignee is either an employee (employee_id) or a location (location_name),
    but not both. Both can be null for unassigned/returned-to-store state.
    """

    __tablename__ = "asset_issuances"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    asset_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("assets.id", ondelete="CASCADE"), nullable=False)

    # Assignee — one of employee_id or location_name is set
    employee_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)
    location_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    # Dates
    issue_date: Mapped[date] = mapped_column(Date(), nullable=False)
    expected_return_date: Mapped[Optional[date]] = mapped_column(Date(), nullable=True)
    returned_at: Mapped[Optional[date]] = mapped_column(Date(), nullable=True)

    # Status: ACTIVE | RETURNED | TRANSFERRED
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="ACTIVE")

    # Condition
    condition_at_issue: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    condition_at_return: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text(), nullable=True)

    # Audit
    issued_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    returned_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))


class AssetMaintenanceCost(Base):
    """Records maintenance or repair spend for an asset.

    Used to compute total cost of ownership (TCO) beyond book depreciation.
    Optionally linked to a GL journal entry in Full ERP mode.
    """

    __tablename__ = "asset_maintenance_costs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    asset_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("assets.id", ondelete="CASCADE"), nullable=False)

    # Cost details
    maintenance_date: Mapped[date] = mapped_column(Date(), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    cost: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    currency_code: Mapped[str] = mapped_column(String(3), nullable=False, server_default="NGN")
    maintenance_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    # REPAIR | PREVENTIVE | INSPECTION | UPGRADE | OTHER

    # GL (Full ERP mode)
    journal_entry_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("journal_entries.id", ondelete="SET NULL"), nullable=True)
    gl_account_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("chart_of_accounts.id", ondelete="SET NULL"), nullable=True)

    # Vendor
    vendor_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    reference: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Audit
    recorded_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))
