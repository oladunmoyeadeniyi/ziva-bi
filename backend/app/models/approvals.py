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
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # Org-chart hierarchy fields
    parent_role_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("approval_roles.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    cost_center_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("org_structure.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Which cost centre / department this role belongs to",
    )
    entity_node_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("org_structure.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Which legal entity this role belongs to",
    )
    max_occupants: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, comment="None=unlimited; 1=solo; N=capped"
    )
    designation: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True, comment="NULL=regular; head_of_department; head_of_entity"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="uq_approval_role_tenant_name"),
    )

    # Self-referential relationship for org chart
    parent_role: Mapped[Optional["ApprovalRole"]] = relationship(
        "ApprovalRole",
        foreign_keys=[parent_role_id],
        remote_side="ApprovalRole.id",
        back_populates="child_roles",
    )
    child_roles: Mapped[list["ApprovalRole"]] = relationship(
        "ApprovalRole",
        foreign_keys="ApprovalRole.parent_role_id",
        back_populates="parent_role",
    )
    cost_center: Mapped[Optional["OrgStructureNode"]] = relationship(  # type: ignore[name-defined]
        "OrgStructureNode",
        foreign_keys=[cost_center_id],
        lazy="select",
    )
    entity_node: Mapped[Optional["OrgStructureNode"]] = relationship(  # type: ignore[name-defined]
        "OrgStructureNode",
        foreign_keys=[entity_node_id],
        lazy="select",
    )


class ApprovalPolicy(Base):
    """
    Per-tenant per-module approval routing configuration.

    routing_mode controls how the management approval chain is built:
      org_tree          -- walk employee.line_manager_id chain up to ceiling_role.
      requestor_selects -- requestor picks approver, system validates hierarchy.
      direct_to_hod     -- skip intermediate managers, go straight to HOD.

    ceiling_role_id: the approval role at which org_tree traversal stops.
    Anyone holding this role is always the last management approver.

    Finance review runs AFTER the management chain clears.
    finance_levels 0 = no finance review required.

    vacant_seat_behavior: what happens when the next approver has no active user:
        skip                  -- bypass that step, go to next.
        hold                  -- pause the chain (alert generated).
        escalate_to_fallback  -- route to fallback_approver_id instead.

    UNIQUE on (tenant_id, module) -- one policy per module per tenant.
    """

    __tablename__ = "approval_policies"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    module: Mapped[str] = mapped_column(String(50), nullable=False)
    routing_mode: Mapped[str] = mapped_column(String(30), nullable=False, default="org_tree")
    ceiling_role_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("approval_roles.id", ondelete="SET NULL"),
        nullable=True,
    )
    vacant_seat_behavior: Mapped[str] = mapped_column(String(30), nullable=False, default="skip")
    fallback_approver_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    requires_finance_review: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    finance_levels: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    finance_l1_role_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("approval_roles.id", ondelete="SET NULL"),
        nullable=True,
    )
    finance_l2_role_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("approval_roles.id", ondelete="SET NULL"),
        nullable=True,
    )
    finance_l3_role_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("approval_roles.id", ondelete="SET NULL"),
        nullable=True,
    )
    finance_amount_threshold_l2: Mapped[Optional[Decimal]] = mapped_column(NUMERIC(15, 2), nullable=True)
    finance_amount_threshold_l3: Mapped[Optional[Decimal]] = mapped_column(NUMERIC(15, 2), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("tenant_id", "module", name="uq_approval_policy_tenant_module"),
    )

    ceiling_role: Mapped[Optional["ApprovalRole"]] = relationship(
        "ApprovalRole", foreign_keys=[ceiling_role_id],
    )
    thresholds: Mapped[list["ApprovalRoleThreshold"]] = relationship(
        "ApprovalRoleThreshold", back_populates="policy", cascade="all, delete-orphan",
    )


class ApprovalRoleThreshold(Base):
    """
    Per-policy amount cap for each approval role, used during org_tree traversal.

    max_amount: the maximum report total this role can be the final approver for.
      None means no limit -- this role is always the ceiling for the chain.

    During traversal: if the current manager's approval role has max_amount >= report total
    (or max_amount is None), they are the last management approver. Otherwise, escalate up.

    UNIQUE on (policy_id, approval_role_id).
    """

    __tablename__ = "approval_role_thresholds"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    policy_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("approval_policies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    approval_role_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("approval_roles.id", ondelete="CASCADE"),
        nullable=False,
    )
    max_amount: Mapped[Optional[Decimal]] = mapped_column(NUMERIC(15, 2), nullable=True)

    __table_args__ = (
        UniqueConstraint("policy_id", "approval_role_id", name="uq_threshold_policy_role"),
    )

    policy: Mapped["ApprovalPolicy"] = relationship("ApprovalPolicy", back_populates="thresholds")
    role: Mapped["ApprovalRole"] = relationship(
        "ApprovalRole", foreign_keys=[approval_role_id]
    )


class ApprovalDelegation(Base):
    """
    Time-bounded delegation of approval authority from one user to another.

    When the routing engine places delegator_id in the chain, it checks for an
    active delegation and substitutes delegate_id instead. The audit trail records
    both: "approved by <delegate> on behalf of <delegator>".

    end_date=None means the delegation is open-ended (until explicitly deactivated).
    is_active=False can be used to revoke a delegation before end_date.
    """

    __tablename__ = "approval_delegations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    delegator_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    delegate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    reason: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    created_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )


class ExpenseApproval(Base):
    """
    One approval record per (expense report x level).

    Created at submit time for each applicable approval level. The status
    starts as PENDING. The queue query activates only the record whose level
    matches expense_reports.current_approval_level, enforcing sequential approval.

    approver_id: the specific user assigned to this step (by engine or manual selection).
    delegated_from_id: set when this step was created via a delegation (original approver).
    chain_type: "management" or "finance" -- which phase of the chain this step belongs to.
    role_label: display label shown in the approval trail (e.g. "Line Manager").
    comment: required on rejection; optional on approval.
    actioned_at: set when the approver takes action.
    """

    __tablename__ = "expense_approvals"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    report_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("expense_reports.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    level: Mapped[int] = mapped_column(Integer, nullable=False)
    approver_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Delegation: if fulfilled via delegation, original approver stored here
    delegated_from_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    # Chain metadata (nullable for backward compat with pre-engine records)
    chain_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    role_label: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="PENDING")
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # For REFERRED_BACK records: whether the requestor can see the referral comment
    visible_to_requestor: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Referred approver's reply back to the referring approver
    response_comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    actioned_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
