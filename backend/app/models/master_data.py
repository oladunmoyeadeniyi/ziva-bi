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

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
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
    # M8.2: consultant can lock this dimension from being modified by Power Admin
    locked_by_implementation: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # M8.2 rebuild: value source controls how dimension values are populated
    value_source: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, default="manual")
    # M8.2 source redesign: list of connected source dicts e.g. [{"source_type": "org_structure", "filter": None}]
    dimension_sources: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    # Tenant-facing rename — overrides name in UI while preserving code for system logic
    display_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    icon: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
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

    # M8.3: account classification (drives Tax Engine, AP, AR, Payroll, Fixed Assets, Reporting)
    account_classification: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True
    )
    # M8.3: foreign currency fields
    is_foreign_currency: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=True
    )
    foreign_currency_code: Mapped[Optional[str]] = mapped_column(
        String(10), nullable=True
    )
    revalue_at_period_end: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=True
    )

    # M8.2: consultant can lock this GL account from Power Admin modification
    locked_by_implementation: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # CoA Remap: once a code is retired via remap, is_retired=True AND is_active=False.
    # Retired accounts remain in the DB for historical integrity (journal lines still point to them)
    # but are excluded from all posting pickers.  is_active alone cannot distinguish retired
    # from plain-deactivated, hence this separate flag.
    is_retired: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")

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


class GlCodeRemap(Base):
    """
    Audit record of a GL account code retirement remap (many old codes → one new code).

    One row per old→new pair.  If accounts 5010 and 5011 are both remapped to 5015,
    two rows are created, both with new_account_id pointing at 5015.

    The old accounts are simultaneously marked is_retired=True / is_active=False by the
    remap endpoint.  Historical journal lines continue to reference the old account ID —
    this table provides the mapping needed to roll them up under the new code in reports.

    Design: NO CASCADE on old_account_id / new_account_id FKs — retired accounts must
    never be deleted, so FK integrity is guaranteed by the retirement + no-delete policy.
    """

    __tablename__ = "gl_code_remaps"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    old_account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chart_of_accounts.id", ondelete="NO ACTION"),
        nullable=False,
    )
    new_account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chart_of_accounts.id", ondelete="NO ACTION"),
        nullable=False,
    )
    remapped_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    remapped_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    reason: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    old_account: Mapped["ChartOfAccount"] = relationship(
        "ChartOfAccount", foreign_keys=[old_account_id]
    )
    new_account: Mapped["ChartOfAccount"] = relationship(
        "ChartOfAccount", foreign_keys=[new_account_id]
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
        ForeignKey("org_structure.id", ondelete="SET NULL"),
        nullable=True,
    )
    line_manager_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("employees.id", ondelete="SET NULL"),
        nullable=True,
    )
    # approval_role_id: links this employee to an org-level approval role (e.g. "Finance Director").
    # Used by the approval routing engine to determine their position in the approval chain
    # and apply the correct amount threshold. Nullable — not all employees hold an approval role.
    approval_role_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("approval_roles.id", ondelete="SET NULL"),
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

    # Relationships — read-only convenience for selectinload in hr.py.
    # No back_populates: one-directional is sufficient for eager-loading in GET routes.
    cost_center: Mapped[Optional["OrgStructureNode"]] = relationship(
        "OrgStructureNode",
        foreign_keys=[cost_center_id],
    )
    # Self-referential: remote_side points to the PK (the "one" side of many-to-one).
    line_manager: Mapped[Optional["Employee"]] = relationship(
        "Employee",
        foreign_keys=[line_manager_id],
        remote_side=[id],
    )
    approval_role: Mapped[Optional["ApprovalRole"]] = relationship(  # type: ignore[name-defined]
        "ApprovalRole",
        foreign_keys=[approval_role_id],
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
        ForeignKey("org_structure.id", ondelete="SET NULL"),
        nullable=True,
    )
    to_cost_center_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("org_structure.id", ondelete="SET NULL"),
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

    from_cost_center: Mapped[Optional["OrgStructureNode"]] = relationship(
        "OrgStructureNode",
        foreign_keys=[from_cost_center_id],
    )
    to_cost_center: Mapped[Optional["OrgStructureNode"]] = relationship(
        "OrgStructureNode",
        foreign_keys=[to_cost_center_id],
    )



class EmployeePositionAssignment(Base):
    """
    Temporal bridge between employees and org-role slots (approval_roles).

    Single source of truth: approval_roles is both the Role Hierarchy and the
    Positions register. This table records WHO occupies a role/position and WHEN.

    assignment_type: 'substantive' | 'acting' | 'secondment'
    effective_to = None means the assignment is still open/current.
    Closing a substantive assignment and opening a new one is handled in hr.py.
    """

    __tablename__ = "employee_position_assignments"

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
    # approval_role_id — the role/position slot this employee occupies.
    # Was position_id in migration e3f4a5b6c7d8; retargeted to approval_roles
    # in migration f1g2h3i4j5k6 as part of the single-source-of-truth merge.
    approval_role_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("approval_roles.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    assignment_type: Mapped[str] = mapped_column(
        String(50), nullable=False, server_default="substantive"
    )
    transfer_reason: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_retrospective: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    approved_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    employee: Mapped[Optional["Employee"]] = relationship(
        "Employee",
        foreign_keys=[employee_id],
    )
    approval_role: Mapped[Optional["ApprovalRole"]] = relationship(  # type: ignore[name-defined]
        "ApprovalRole",
        foreign_keys=[approval_role_id],
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
        ForeignKey("org_structure.id", ondelete="CASCADE"),
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

    # Relationships — read-only convenience for selectinload in hr.py.
    # No back_populates: one-directional is sufficient for eager-loading in GET routes.
    cost_center: Mapped["OrgStructureNode"] = relationship(
        "OrgStructureNode",
        foreign_keys=[cost_center_id],
    )
    head_employee: Mapped[Optional["Employee"]] = relationship(
        "Employee",
        foreign_keys=[head_employee_id],
    )
    head_user: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[head_user_id],
    )


# ── Default CoA Templates (system-wide reference data, no tenant_id) ──────────

class CoaTemplate(Base):
    """
    System-wide default Chart of Accounts template seeded per industry.

    No tenant_id column — this is reference data shared across all tenants,
    the same way posting_roles is not owned by any tenant. Cross-tenant leakage
    is structurally impossible: there is no tenant column for any query to
    accidentally filter or join against.

    industry: exact match against the INDUSTRIES constant in organisation/page.tsx.
    NULL means Generic/Other — the fallback for any industry without a dedicated
    template.
    """

    __tablename__ = "coa_templates"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    industry: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, server_default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    accounts: Mapped[list["CoaTemplateAccount"]] = relationship(
        "CoaTemplateAccount",
        back_populates="template",
        cascade="all, delete-orphan",
        order_by="CoaTemplateAccount.sort_order",
    )


class CoaTemplateAccount(Base):
    """
    One GL account row within a default CoA template.

    No tenant_id — see CoaTemplate docstring for the leakage-safety argument.
    account_type stores 'PL' or 'BS' (current UI labels, same as ChartOfAccount).
    sort_order preserves the FS-bucket-then-numeric display order from the draft
    doc so adopted CoAs are immediately in a sensible sequence.
    """

    __tablename__ = "coa_template_accounts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    template_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("coa_templates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    gl_number: Mapped[str] = mapped_column(String(50), nullable=False)
    gl_name: Mapped[str] = mapped_column(String(255), nullable=False)
    account_type: Mapped[str] = mapped_column(String(20), nullable=False)  # 'PL' or 'BS'
    gl_group: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    gl_subgroup: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    gl_sub_subgroup: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    fs_head: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    fs_note: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    tb_mapping: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    account_classification: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_foreign_currency: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    foreign_currency_code: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    revalue_at_period_end: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    template: Mapped["CoaTemplate"] = relationship(
        "CoaTemplate", back_populates="accounts"
    )


# ── Finance review config ──────────────────────────────────────────────────────

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
        ForeignKey("org_structure.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


# ── Tenant Permission Matrix ──────────────────────────────────────────────────

class TenantPermissionMatrix(Base):
    """
    Per-tenant override for the role permission matrix.

    The default matrix (hardcoded) gives:
      consultant       → full on all sections
      power_admin      → full on all sections
      functional_admin → read_only on all sections

    Rows in this table override those defaults for a specific tenant.
    Missing rows fall back to the hardcoded defaults.
    access_level: 'full' | 'read_only' | 'none' | 'delegatable'
    """

    __tablename__ = "tenant_permission_matrix"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    section: Mapped[str] = mapped_column(String(120), nullable=False)
    role_tier: Mapped[str] = mapped_column(String(50), nullable=False)
    access_level: Mapped[str] = mapped_column(String(50), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("tenant_id", "section", "role_tier",
                         name="uq_perm_matrix_tenant_section_tier"),
    )


class UserFunctionalScope(Base):
    """Per-user scope for Functional Admins.

    Each row grants one section to a specific user within a tenant.
    Absence of rows means no config access. Used to tailor what each
    functional head (e.g. HR vs. Marketing) can see in the setup portal.
    """

    __tablename__ = "user_functional_scope"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    section: Mapped[str] = mapped_column(String(120), nullable=False)
    access_level: Mapped[str] = mapped_column(String(50), nullable=False, default="read_only")

    __table_args__ = (
        UniqueConstraint(
            "tenant_id", "user_tenant_id", "section",
            name="uq_user_functional_scope",
        ),
    )
