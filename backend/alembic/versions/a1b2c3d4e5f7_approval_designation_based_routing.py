"""approval_designation_based_routing

Add ceiling_designation, finance_l*_designation to approval_policies.
Add designation column to approval_role_thresholds (makes approval_role_id nullable).
Drop old unique constraint on (policy_id, approval_role_id), add new one on (policy_id, designation).

Revision ID: a1b2c3d4e5f7
Revises: 423f009c637b
Create Date: 2026-07-05 18:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f7"
down_revision: Union[str, None] = "423f009c637b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -- approval_policies: add designation-based columns --
    op.add_column("approval_policies", sa.Column("ceiling_designation", sa.String(50), nullable=True,
        comment="Designation level at which org_tree traversal stops"))
    op.add_column("approval_policies", sa.Column("finance_l1_designation", sa.String(50), nullable=True))
    op.add_column("approval_policies", sa.Column("finance_l2_designation", sa.String(50), nullable=True))
    op.add_column("approval_policies", sa.Column("finance_l3_designation", sa.String(50), nullable=True))

    # -- approval_role_thresholds: add designation, make approval_role_id nullable --
    op.add_column("approval_role_thresholds", sa.Column("designation", sa.String(50), nullable=True,
        comment="Designation level this threshold applies to"))
    # Make approval_role_id nullable (was NOT NULL)
    op.alter_column("approval_role_thresholds", "approval_role_id", nullable=True)
    # Drop old unique constraint, add new one keyed on designation
    op.drop_constraint("uq_threshold_policy_role", "approval_role_thresholds", type_="unique")
    op.create_unique_constraint(
        "uq_threshold_policy_designation",
        "approval_role_thresholds",
        ["policy_id", "designation"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_threshold_policy_designation", "approval_role_thresholds", type_="unique")
    op.create_unique_constraint(
        "uq_threshold_policy_role", "approval_role_thresholds", ["policy_id", "approval_role_id"]
    )
    op.alter_column("approval_role_thresholds", "approval_role_id", nullable=False)
    op.drop_column("approval_role_thresholds", "designation")
    op.drop_column("approval_policies", "finance_l3_designation")
    op.drop_column("approval_policies", "finance_l2_designation")
    op.drop_column("approval_policies", "finance_l1_designation")
    op.drop_column("approval_policies", "ceiling_designation")
