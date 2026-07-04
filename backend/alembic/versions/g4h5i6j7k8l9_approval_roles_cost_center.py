"""Add cost_center_id to approval_roles

Revision ID: g4h5i6j7k8l9
Revises: f3g4h5i6j7k8
Create Date: 2026-07-04

Links each approval role to an org-structure cost centre node.
NULL means the role is cross-functional / not tied to a specific department.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "g4h5i6j7k8l9"
down_revision = "f3g4h5i6j7k8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "approval_roles",
        sa.Column(
            "cost_center_id",
            UUID(as_uuid=True),
            sa.ForeignKey("org_structure.id", ondelete="SET NULL"),
            nullable=True,
            comment="Which cost centre / department this role belongs to",
        ),
    )
    op.create_index(
        "ix_approval_roles_cost_center_id",
        "approval_roles",
        ["cost_center_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_approval_roles_cost_center_id", table_name="approval_roles")
    op.drop_column("approval_roles", "cost_center_id")
