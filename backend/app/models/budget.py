"""
Budget & Planning ORM models — M16.

Defines two core tables:
  BudgetPeriod  — the budget envelope (annual / quarterly / custom date range)
  BudgetLine    — per-GL-account allocation within a budget period, with optional
                  monthly breakdowns stored as JSONB.

Variance reporting queries these tables against GL actuals, posting_batches,
or AP/AR exports depending on the tenant's posting_mode.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
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
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base

if TYPE_CHECKING:
    from app.models.auth import User
    from app.models.master_data import ChartOfAccount
    from app.models.setup import OrgStructureNode


class BudgetPeriod(Base):
    """
    A named budget envelope (e.g., "FY 2025 Annual Budget", "Q3 2025 Capex Budget").

    Status lifecycle:  DRAFT → ACTIVE → LOCKED.
    Only ACTIVE periods are used in variance reports.  LOCKED periods are
    read-only; no lines may be added or edited.

    Attributes:
        name:         Human label, e.g. "FY 2025 Annual Budget".
        fiscal_year:  Integer year for grouping and filtering.
        period_start/period_end: Inclusive date range for this budget.
        status:       DRAFT | ACTIVE | LOCKED.
        description:  Optional narrative.
        created_by_id / approved_by_id: Audit trail.
    """

    __tablename__ = "budget_periods"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    fiscal_year: Mapped[int] = mapped_column(Integer, nullable=False)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="DRAFT")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    approved_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        CheckConstraint("status IN ('DRAFT','ACTIVE','LOCKED')", name="ck_budget_period_status"),
    )

    # Relationships
    lines: Mapped[list[BudgetLine]] = relationship(
        "BudgetLine", back_populates="period", cascade="all, delete-orphan"
    )


class BudgetLine(Base):
    """
    A single GL-account allocation within a BudgetPeriod.

    One row per (budget_period, gl_account, department) combination.

    Attributes:
        gl_account_id:       FK to chart_of_accounts (nullable for high-level lines).
        department_id:       FK to org_structure (nullable for entity-level lines).
        annual_amount:       Total budget for this GL account / department combo.
        monthly_allocations: JSONB dict mapping month number ("01"…"12") to Decimal
                             allocation.  If null, the annual_amount is spread evenly.
                             Example: {"01": 500000, "02": 450000, ...}
        notes:               Free-text rationale.
    """

    __tablename__ = "budget_lines"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    budget_period_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("budget_periods.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    gl_account_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chart_of_accounts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    department_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("org_structure.id", ondelete="SET NULL"),
        nullable=True,
    )
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    annual_amount: Mapped[Decimal] = mapped_column(
        Numeric(18, 2), nullable=False, default=Decimal("0")
    )
    monthly_allocations: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint(
            "budget_period_id", "gl_account_id", "department_id",
            name="uq_budget_line_gl_dept",
        ),
    )

    # Relationships
    period: Mapped[BudgetPeriod] = relationship("BudgetPeriod", back_populates="lines")
