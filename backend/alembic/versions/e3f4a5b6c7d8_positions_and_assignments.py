"""positions_and_assignments

Revision ID: e3f4a5b6c7d8
Revises: d2e3f4a5b6c7
Create Date: 2026-07-06 00:00:00.000000

People v1 — position-based org model.

New tables:
  positions                     — job slots in the org chart (durable, survives attrition)
  position_history              — immutable log of every position move / restructure
  employee_position_assignments — temporal employee→position bridge (who occupies what, when)

Altered tables:
  employee_transfers — adds change_type VARCHAR(50) and is_retrospective BOOL
  org_roles          — adds position_id UUID NULL FK → positions (links approval authority to slot)
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers
revision = "e3f4a5b6c7d8"
down_revision = "d2e3f4a5b6c7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. positions ──────────────────────────────────────────────────────────
    op.create_table(
        "positions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", UUID(as_uuid=True),
                  sa.ForeignKey("tenants.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("position_code", sa.String(50), nullable=True),
        sa.Column("cost_center_id", UUID(as_uuid=True),
                  sa.ForeignKey("org_structure.id", ondelete="SET NULL"), nullable=True),
        sa.Column("parent_position_id", UUID(as_uuid=True),
                  sa.ForeignKey("positions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("org_role_id", UUID(as_uuid=True),
                  sa.ForeignKey("approval_roles.id", ondelete="SET NULL"), nullable=True),
        sa.Column("function_code", sa.String(50), nullable=True),
        sa.Column("grade", sa.String(50), nullable=True),
        sa.Column("is_head_of_cost_center", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("max_occupants", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("tenant_id", "position_code", name="uq_positions_tenant_code"),
    )

    # ── 2. position_history ───────────────────────────────────────────────────
    op.create_table(
        "position_history",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("position_id", UUID(as_uuid=True),
                  sa.ForeignKey("positions.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("old_cost_center_id", UUID(as_uuid=True), nullable=True),
        sa.Column("new_cost_center_id", UUID(as_uuid=True), nullable=True),
        sa.Column("old_parent_position_id", UUID(as_uuid=True), nullable=True),
        sa.Column("new_parent_position_id", UUID(as_uuid=True), nullable=True),
        sa.Column("old_title", sa.String(200), nullable=True),
        sa.Column("new_title", sa.String(200), nullable=True),
        sa.Column("old_org_role_id", UUID(as_uuid=True), nullable=True),
        sa.Column("new_org_role_id", UUID(as_uuid=True), nullable=True),
        sa.Column("effective_date", sa.Date(), nullable=False),
        sa.Column("change_type", sa.String(50), nullable=False),
        sa.Column("change_reason", sa.Text(), nullable=True),
        sa.Column("is_retrospective", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("changed_by", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── 3. employee_position_assignments ─────────────────────────────────────
    op.create_table(
        "employee_position_assignments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", UUID(as_uuid=True),
                  sa.ForeignKey("tenants.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("employee_id", UUID(as_uuid=True),
                  sa.ForeignKey("employees.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("position_id", UUID(as_uuid=True),
                  sa.ForeignKey("positions.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("effective_from", sa.Date(), nullable=False),
        sa.Column("effective_to", sa.Date(), nullable=True),
        sa.Column("assignment_type", sa.String(50), nullable=False, server_default="substantive"),
        sa.Column("transfer_reason", sa.String(100), nullable=True),
        sa.Column("is_retrospective", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("approved_by", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_by", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── 4. employee_transfers — add change_type + is_retrospective ────────────
    op.add_column("employee_transfers",
                  sa.Column("change_type", sa.String(50), nullable=True))
    op.add_column("employee_transfers",
                  sa.Column("is_retrospective", sa.Boolean(), nullable=False, server_default="false"))

    # ── 5. org_roles — add position_id (nullable) ────────────────────────────
    op.add_column("approval_roles",
                  sa.Column("position_id", UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_approval_roles_position_id",
        "approval_roles", "positions",
        ["position_id"], ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_approval_roles_position_id", "approval_roles", type_="foreignkey")
    op.drop_column("approval_roles", "position_id")
    op.drop_column("employee_transfers", "is_retrospective")
    op.drop_column("employee_transfers", "change_type")
    op.drop_table("employee_position_assignments")
    op.drop_table("position_history")
    op.drop_table("positions")
