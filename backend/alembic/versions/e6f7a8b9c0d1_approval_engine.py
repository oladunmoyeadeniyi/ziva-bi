"""Approval engine — policies, thresholds, delegations + employee/approval column additions

Revision ID: e6f7a8b9c0d1
Revises: 5d5e730f42ac, d5e6f7a8b9c0
Create Date: 2026-07-04

Merges the GL/impersonation branch (5d5e730f42ac) and the permission/scope/approval-roles
branch (d5e6f7a8b9c0) into a single head, then adds:

New tables:
    approval_policies        — per-tenant per-module routing config + finance chain
    approval_role_thresholds — amount cap per role per policy (for org_tree traversal)
    approval_delegations     — time-bounded delegation of approval authority

New columns:
    employees.approval_role_id          — links employee to their approval role
    expense_approvals.delegated_from_id — original approver when delegation was used
    expense_approvals.chain_type        — "management" | "finance"
    expense_approvals.role_label        — display label for the approval step
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "e6f7a8b9c0d1"
down_revision = ("5d5e730f42ac", "d5e6f7a8b9c0")
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── approval_policies ────────────────────────────────────────────────────
    op.create_table(
        "approval_policies",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id", UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False, index=True,
        ),
        sa.Column("module", sa.String(50), nullable=False),
        sa.Column("routing_mode", sa.String(30), nullable=False, server_default="org_tree"),
        sa.Column(
            "ceiling_role_id", UUID(as_uuid=True),
            sa.ForeignKey("approval_roles.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("vacant_seat_behavior", sa.String(30), nullable=False, server_default="skip"),
        sa.Column(
            "fallback_approver_id", UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("requires_finance_review", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("finance_levels", sa.Integer, nullable=False, server_default="0"),
        sa.Column(
            "finance_l1_role_id", UUID(as_uuid=True),
            sa.ForeignKey("approval_roles.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "finance_l2_role_id", UUID(as_uuid=True),
            sa.ForeignKey("approval_roles.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "finance_l3_role_id", UUID(as_uuid=True),
            sa.ForeignKey("approval_roles.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("finance_amount_threshold_l2", sa.Numeric(15, 2), nullable=True),
        sa.Column("finance_amount_threshold_l3", sa.Numeric(15, 2), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("tenant_id", "module", name="uq_approval_policy_tenant_module"),
    )

    # ── approval_role_thresholds ─────────────────────────────────────────────
    op.create_table(
        "approval_role_thresholds",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "policy_id", UUID(as_uuid=True),
            sa.ForeignKey("approval_policies.id", ondelete="CASCADE"),
            nullable=False, index=True,
        ),
        sa.Column(
            "approval_role_id", UUID(as_uuid=True),
            sa.ForeignKey("approval_roles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("max_amount", sa.Numeric(15, 2), nullable=True),
        sa.UniqueConstraint("policy_id", "approval_role_id", name="uq_threshold_policy_role"),
    )

    # ── approval_delegations ─────────────────────────────────────────────────
    op.create_table(
        "approval_delegations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id", UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False, index=True,
        ),
        sa.Column(
            "delegator_id", UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False, index=True,
        ),
        sa.Column(
            "delegate_id", UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("start_date", sa.Date, nullable=False),
        sa.Column("end_date", sa.Date, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("reason", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column(
            "created_by_id", UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )

    # ── employees: add approval_role_id ──────────────────────────────────────
    op.add_column(
        "employees",
        sa.Column(
            "approval_role_id", UUID(as_uuid=True),
            sa.ForeignKey("approval_roles.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )

    # ── expense_approvals: add delegation + chain metadata columns ────────────
    op.add_column(
        "expense_approvals",
        sa.Column(
            "delegated_from_id", UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column("expense_approvals", sa.Column("chain_type", sa.String(20), nullable=True))
    op.add_column("expense_approvals", sa.Column("role_label", sa.String(100), nullable=True))


def downgrade() -> None:
    op.drop_column("expense_approvals", "role_label")
    op.drop_column("expense_approvals", "chain_type")
    op.drop_column("expense_approvals", "delegated_from_id")
    op.drop_column("employees", "approval_role_id")
    op.drop_table("approval_delegations")
    op.drop_table("approval_role_thresholds")
    op.drop_table("approval_policies")
