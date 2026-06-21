"""
ZivaBI — Account Determination ORM models (redesigned in catalogue-redesign brief).

Tables:
    posting_roles                — System-level catalogue with 2-level taxonomy.
    tenant_account_mappings      — Per-tenant: role → GL account.
    tenant_posting_role_settings — Per-tenant: control-account override (independent of mapping).

Taxonomy hierarchy: statement (BS/PL) → group → subgroup → roles.

Per-tenant control override storage:
    Kept separate from TenantAccountMapping because control-account status is a
    financial setting independent of which GL is assigned. A super admin may want to
    mark a role as non-control before a GL has been mapped (or vice versa).
    tenant_posting_role_settings holds the override; NULL = use catalogue default.
"""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PostingRole(Base):
    """
    System-level posting role catalogue with financial-statement taxonomy.

    Taxonomy: statement → group → subgroup → role.
      statement: 'BS' (balance sheet) | 'PL' (income statement).
      group:     statement-level grouping (e.g. current_assets, current_liabilities, equity).
      subgroup:  finer collapsible grouping (e.g. receivables, payables, tax, cash_bank).

    expected_account_type: abstract "BS" | "PL" | None.
    is_control_account: CATALOGUE DEFAULT — whether this role carries a sub-ledger balance.
                        Overridable per-tenant via TenantPostingRoleSettings.
    display_order: ordering within the subgroup for consistent UI rendering.
    """

    __tablename__ = "posting_roles"

    role_key: Mapped[str] = mapped_column(String(60), primary_key=True)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    statement: Mapped[str] = mapped_column(String(5), nullable=False)   # 'BS' | 'PL'
    group: Mapped[str] = mapped_column(String(60), nullable=False)      # statement-level
    subgroup: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    expected_account_type: Mapped[Optional[str]] = mapped_column(
        String(10), nullable=True  # "BS" | "PL" | NULL = either
    )
    expected_nature: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True  # reserved; NULL for all v1 rows
    )
    is_control_account: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    tenant_mappings: Mapped[list["TenantAccountMapping"]] = relationship(
        "TenantAccountMapping", back_populates="role"
    )
    tenant_settings: Mapped[list["TenantPostingRoleSettings"]] = relationship(
        "TenantPostingRoleSettings", back_populates="role"
    )


class TenantAccountMapping(Base):
    """
    Per-tenant binding: a posting role → a specific GL account.

    Unique per (tenant_id, role_key): one GL per role per tenant for v1.
    Per-expense-type / per-dimension overrides are FUTURE.
    """

    __tablename__ = "tenant_account_mappings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role_key: Mapped[str] = mapped_column(
        String(60),
        ForeignKey("posting_roles.role_key", ondelete="CASCADE"),
        nullable=False,
    )
    gl_account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chart_of_accounts.id"),
        nullable=False,
        index=True,
    )
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    role: Mapped["PostingRole"] = relationship("PostingRole", back_populates="tenant_mappings")

    __table_args__ = (
        UniqueConstraint("tenant_id", "role_key", name="uq_tam_tenant_role"),
    )


class TenantPostingRoleSettings(Base):
    """
    Per-tenant overrides for posting-role catalogue settings.

    Currently stores only the control-account override; extend with additional
    per-tenant role settings as needed.

    is_control_account_override:
      NULL   → use the catalogue default (PostingRole.is_control_account)
      True   → this tenant treats the role as a control account
      False  → this tenant treats the role as a non-control account

    Rows exist only when an override has been explicitly set. Absence = use default.
    """

    __tablename__ = "tenant_posting_role_settings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role_key: Mapped[str] = mapped_column(
        String(60),
        ForeignKey("posting_roles.role_key", ondelete="CASCADE"),
        nullable=False,
    )
    is_control_account_override: Mapped[Optional[bool]] = mapped_column(
        Boolean, nullable=True  # NULL = use catalogue default
    )
    is_relevant: Mapped[Optional[bool]] = mapped_column(
        Boolean, nullable=True
        # NULL / True = role is relevant (shown in setup UI).
        # False = tenant has explicitly hidden this role (not applicable to them).
        # IMPORTANT: relevance is COSMETIC for setup only. It does NOT affect
        # resolve_account() or posting behaviour — a module that needs a role
        # will still resolve it regardless of this flag.
    )

    role: Mapped["PostingRole"] = relationship("PostingRole", back_populates="tenant_settings")

    __table_args__ = (
        UniqueConstraint("tenant_id", "role_key", name="uq_tprs_tenant_role"),
    )
