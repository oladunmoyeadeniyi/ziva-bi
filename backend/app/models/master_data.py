"""
ZivaBI — M8 / M8.1 master data ORM models.

Tables:
    tenant_dimensions           — financial dimensions a tenant has configured
    dimension_values            — master data list of valid codes for each dimension
    chart_of_accounts           — the company's GL accounts (P&L and Balance Sheet)
    gl_dimension_requirements   — per GL account, per dimension: required / optional / na
    category_gl_mappings        — maps a subcategory to one or more GL accounts

M8.1 additions:
    employees                   — employee master data
    employee_code_history       — tracks code changes (retrospective / progressive)
    employee_transfers          — tracks cost center transfers
    cost_center_config          — cost center head assignment
    finance_review_config       — finance reviewer configuration per module

All tables are tenant-scoped via tenant_id FK → tenants(id).
"""

import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, func
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
    # M8.1: comma-separated list of accepted value_type strings for this dimension
    accepted_value_types: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    values: Mapped[list["DimensionValue"]] = relationship(
        "DimensionValue",
        back_populates="dimension",
        cascade="all, delete-orphan",
        order_by="DimensionValue.sort_order",
        foreign_keys="DimensionValue.dimension_id",
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

    M8.1 fields:
    - value_type: free-text category for filtering (e.g. "cost_center", "trading_partner")
    - cascade_dimension_id / cascade_value_id: when this value is selected, auto-fill
      another dimension's value on the expense form
    - valid_from / valid_to: date range during which this value is shown on expense forms
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

    # M8.1: value type for filtering
    value_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # M8.1: cascading — when this value is selected, auto-fill another dimension
    cascade_dimension_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenant_dimensions.id", ondelete="SET NULL"),
        nullable=True,
    )
    cascade_value_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("dimension_values.id", ondelete="SET NULL"),
        nullable=True,
    )

    # M8.1: period activation
    valid_from: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    valid_to: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    dimension: Mapped["TenantDimension"] = relationship(
        "TenantDimension",
        back_populates="values",
        foreign_keys=[dimension_id],
    )


class ChartOfAccount(Base):
    """
    A GL account within a tenant's Chart of Accounts.

    gl_number must be unique per tenant (alphanumeric, max 50 chars).
    account_type: 'PL' = P&L / SOCI account, 'BS' = Balance Sheet / SOFP account.
    Dimension requirements per GL account are stored in GLDimensionRequirement.

    M8.1 fields add full enterprise CoA hierarchy: GL Group/Subgroup/Sub-subgroup,
    FS mappings (FS Head, FS Note, TB Mapping), Group reporting fields, and
    Category/Subcategory/Default mappings embedded for template use.
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

    # M8.1: GL hierarchy
    gl_group: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    gl_subgroup: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    gl_sub_subgroup: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # M8.1: Financial statement mappings
    fs_head: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    fs_note: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    tb_mapping: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # M8.1: Group reporting
    group_account_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    group_account_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

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


# ── M8.1: Employee Master Data ────────────────────────────────────────────────

class Employee(Base):
    """
    Employee master data record for a tenant.

    employee_code is unique per tenant (auto-generated or manually assigned).
    email is unique per tenant. cost_center_id links to a DimensionValue of
    the cost center dimension. line_manager_id is a self-referential FK.
    """

    __tablename__ = "employees"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    employee_code: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    other_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    preferred_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    cost_center_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("dimension_values.id", ondelete="SET NULL"),
        nullable=True,
    )
    line_manager_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("employees.id", ondelete="SET NULL"),
        nullable=True,
    )
    resumption_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    employee_code_auto_generated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class EmployeeCodeHistory(Base):
    """
    Tracks retrospective and progressive employee code changes.

    change_type: 'retrospective' (applies to past) or 'progressive' (applies from effective_date).
    """

    __tablename__ = "employee_code_history"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    old_code: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    new_code: Mapped[str] = mapped_column(String(100), nullable=False)
    change_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # 'retrospective' or 'progressive'
    effective_date: Mapped[date] = mapped_column(Date, nullable=False)
    changed_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class EmployeeTransfer(Base):
    """
    Tracks cost center transfers for employees.

    Records the from/to cost center, effective date, and who performed the transfer.
    """

    __tablename__ = "employee_transfers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    from_cost_center_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("dimension_values.id", ondelete="SET NULL"),
        nullable=True,
    )
    to_cost_center_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("dimension_values.id", ondelete="SET NULL"),
        nullable=True,
    )
    effective_date: Mapped[date] = mapped_column(Date, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    transferred_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class CostCenterConfig(Base):
    """
    Cost center head assignment.

    Links a cost center (dimension value) to a head employee and optionally
    to a Ziva BI user account.
    Unique per (tenant_id, cost_center_id).
    """

    __tablename__ = "cost_center_config"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    cost_center_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("dimension_values.id", ondelete="CASCADE"),
        nullable=False,
    )
    head_employee_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("employees.id", ondelete="SET NULL"),
        nullable=True,
    )
    head_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class FinanceReviewConfig(Base):
    """
    Finance reviewer configuration per module.

    reviewer_user_id: the Ziva BI user assigned as finance reviewer.
    module: 'expense_retirement' or 'accounts_payable'.
    cost_center_id: NULL means applies to all cost centers.
    review_level: integer ordering of the review queue (1 = first).
    """

    __tablename__ = "finance_review_config"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    module: Mapped[str] = mapped_column(String(50), nullable=False)  # 'expense_retirement' | 'accounts_payable'
    reviewer_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    review_level: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    cost_center_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("dimension_values.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
