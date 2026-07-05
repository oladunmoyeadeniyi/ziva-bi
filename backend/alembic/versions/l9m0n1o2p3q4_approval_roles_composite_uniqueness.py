"""Drop name-only unique constraint on approval_roles

Revision ID: l9m0n1o2p3q4
Revises: k8l9m0n1o2p3
Create Date: 2026-07-05

The original uq_approval_role_tenant_name constraint blocked creating two
roles with the same title in the same tenant (e.g. five "DPM" nodes each
covering a different area).  Uniqueness is now enforced in application code
across the full set of descriptor fields:
    (tenant_id, name, cost_center_id, entity_node_id, area, sub_area, employment_type)
Two roles are considered duplicates only when ALL of these match.
"""

from alembic import op

revision = "l9m0n1o2p3q4"
down_revision = "k8l9m0n1o2p3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("uq_approval_role_tenant_name", "approval_roles", type_="unique")


def downgrade() -> None:
    # Restore the old name-only constraint (may fail if duplicates now exist)
    op.create_unique_constraint(
        "uq_approval_role_tenant_name", "approval_roles", ["tenant_id", "name"]
    )
