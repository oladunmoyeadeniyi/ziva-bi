"""
ZivaBI — M8 master data ORM models (Milestone 8: Intelligent Expense Form Foundation).

Tables:
    tenant_dimensions          — financial dimensions a tenant has configured
    dimension_values           — master data list of valid codes for each dimension
    chart_of_accounts          — the company's GL accounts (P&L and Balance Sheet)
    gl_dimension_requirements  — per GL account, per dimension: required / optional / na
    category_gl_mappings       — maps a subcategory to one or more GL accounts

All tables are tenant-scoped via tenant_id FK → tenants(id).

Relationships:
    TenantDimension → DimensionValue (one-to-many)
    TenantDimension → GLDimensionRequirement (one-to-many)
    ChartOfAccount  → GLDimensionRequirement (one-to-many)
    ChartOfAccount  → CategoryGLMapping (one-to-many)
    ExpenseCategory → CategoryGLMapping (one-to-many, FK to expense_categories table)
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TenantDimension(Base):
    """
    A financial dimension configured by a tenant (e.g. Cost Center, IO, Project Code).

    Dimensions are entirely variable per company — there is no fixed global list.
    code is auto-generated from name (lowercase, underscores) and must be unique per tenant.
    sort_order controls the display order in the expense form and dimension dropdowns.
    is_required: if True, this dimension is required on all expense lines by default.
    """

    __tablename__ = "tenant_dimensions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    is_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    values: Mapped[list["DimensionValue"]] = relationship(
        "DimensionValue",
        back_populates="dimension",
        cascade="all, delete-orphan",
        order_by="DimensionValue.sort_order",
    )
    gl_requirements: Mapped[list["GLDimensionRequirement"]] = relationship(
        "GLDimensionRequirement",
        back_populates="dimension",
        cascade="all, delete-orphan",
    )


class DimensionValue(Base):
    """
    A single master data entry for a tenant dimension.

    Example: for the "Cost Center" dimension, a value might be code="NG_FI", name="Nigeria Finance".
    code must be unique within (tenant, dimension). sort_order controls dropdown ordering.
    """

    __tablename__ = "dimension_values"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    dimension_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenant_dimensions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    code: Mapped[str] = mapped_column(String(100), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    dimension: Mapped["TenantDimension"] = relationship(
        "TenantDimension", back_populates="values"
    )


class ChartOfAccount(Base):
    """
    A GL account within a tenant's Chart of Accounts.

    gl_number must be unique per tenant (alphanumeric, max 50 chars).
    account_type: 'PL' = P&L account, 'BS' = Balance Sheet account.
    Dimension requirements per GL account are stored in GLDimensionRequirement.
    """

    __tablename__ = "chart_of_accounts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    gl_number: Mapped[str] = mapped_column(String(50), nullable=False)
    gl_name: Mapped[str] = mapped_column(String(255), nullable=False)
    account_type: Mapped[str] = mapped_column(String(20), nullable=False)  # 'PL' or 'BS'
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    dimension_requirements: Mapped[list["GLDimensionRequirement"]] = relationship(
        "GLDimensionRequirement",
        back_populates="gl_account",
        cascade="all, delete-orphan",
    )
    category_mappings: Mapped[list["CategoryGLMapping"]] = relationship(
        "CategoryGLMapping",
        back_populates="gl_account",
        cascade="all, delete-orphan",
    )


class GLDimensionRequirement(Base):
    """
    Per GL account, per dimension: whether this dimension is required, optional, or N/A.

    requirement values: 'required', 'optional', 'na'
    Unique per (gl_id, dimension_id) — only one requirement row per GL-dimension pair.
    """

    __tablename__ = "gl_dimension_requirements"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    gl_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chart_of_accounts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    dimension_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenant_dimensions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    requirement: Mapped[str] = mapped_column(
        String(20), nullable=False  # 'required', 'optional', 'na'
    )

    gl_account: Mapped["ChartOfAccount"] = relationship(
        "ChartOfAccount", back_populates="dimension_requirements"
    )
    dimension: Mapped["TenantDimension"] = relationship(
        "TenantDimension", back_populates="gl_requirements"
    )


class CategoryGLMapping(Base):
    """
    Maps a subcategory (expense_categories.id) to one or more GL accounts.

    Only one mapping per category can have is_default=True (enforced in the router).
    The default GL is pre-selected when the employee picks the subcategory.
    Can only map to active GL accounts within the same tenant's CoA.
    """

    __tablename__ = "category_gl_mappings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("expense_categories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    gl_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chart_of_accounts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    gl_account: Mapped["ChartOfAccount"] = relationship(
        "ChartOfAccount", back_populates="category_mappings"
    )
