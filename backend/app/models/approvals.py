"""
ZivaBI — approval workflow ORM models (Milestones 4–5 + Approval Engine).

Tables:
    approval_matrix          Legacy per-tenant fixed-level config (kept for backward compat).
    approval_roles           Org-level approver role registry (e.g. "Line Manager", "CFO").
    approval_policies        Per-tenant per-module policy: routing mode, finance chain, vacant-seat behaviour.
    approval_role_thresholds Per-policy amount cap per approval role (org_tree traversal stops when role's
                             max_amount >= report total, or max_amount is None = ceiling/final approver).
    approval_delegations     Time-bounded delegation of approval authority from one user to another.
    expense_approvals        One row per (report x level); tracks each approver's action on a report.

Status flow: PENDING -> APPROVED | REJECTED | REFERRED_BACK

Routing modes (approval_policies.routing_mode):
    org_tree          -- auto-walk employee.line_manager_id chain up to ceiling role.
    requestor_selects -- requestor picks approver; system validates they are above in hierarchy.
    direct_to_hod     -- skip intermediate managers, route straight to Head of Department.

Chain types (expense_approvals.chain_type):
    management -- org-tree / management-level approval step.
    finance    -- finance-review step that follows all management approvals.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    NUMERIC,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ApprovalMatrix(Base):
    """
    Approval configuration for one tenant (legacy).

    Defines how many sequential approval levels are required and the role label
    displayed to employees at each level. Level 2 and 3 are optional.
    amount_threshold_l2/l3 allow skipping a level when the report total is below
    the threshold; None means the level is always required.

    Superseded by ApprovalPolicy when a tenant has configured one. Kept for
    backward compatibility with existing tenants and submitted reports.

    UNIQUE on tenant_id -- one row per tenant, upserted on save.
    """

    __tablename__ = "approval_matrix"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    levels: Mapped[int] = mapped_column(Integer, nullable=False)
    level1_role: Mapped[str] = mapped_column(String(100), nullable=False)
    level2_role: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    level3_role: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    amount_threshold_l2: Mapped[Optional[Decimal]] = mapped_column(NUMERIC(15, 2), nullable=True)
    amount_threshold_l3: Mapped[Optional[Decimal]] = mapped_column(NUMERIC(15, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class ApprovalRole(Base):
    """
    Org-level approver role registry for one tenant.

    Defines the named roles that can appear as approvers across any module
    (Expense, AP, AR, Payroll, etc.). Each module's approval config references
    these roles by name. Roles are tenant-scoped and ordered for display.

    parent_role_id: self-referential FK that builds the org-chart hierarchy
      (e.g. "Chief Accountant" reports to "Finance Manager").
    max_occupants:  None = unlimited headcount; 1 = solo role (GM, CFO, etc.);
      any positive integer = fixed cap.

    Examples: "Line Manager", "Department Head", "Finance Director", "CFO", "Board".
    """

    __tablename__ = "approval_roles"

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
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    display_order: Mapped[int] = mapped_colum