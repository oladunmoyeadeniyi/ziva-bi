"""Add parent_role_id, max_occupants, updated_at to approval_roles

Revision ID: f3g4h5i6j7k8
Revises: e6f7a8b9c0d1
Create Date: 2026-07-04

Adds org-chart hierarchy fields to the existing approval_roles table:
  - parent_role_id: self-referential FK for building the reporting hierarchy
  - max_occupants: capacity cap per role (NULL=unlimited, 1=solo, N=capped)
  - updated_at: standard audit timestamp
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "f3g4h5i6j7k8"
down_revision = "e6f7a8b9c0d1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "approval_roles",
        sa.Column(
            "parent_role_id",
            UUID(as_uuid=True),
            sa.ForeignKey("approval_roles.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "approval_roles",
        sa.Column(
            "max_occupants",
            sa.Integer,
            nullable=True,
            comment="NULL=unlimited; 1=solo role; N=capped headcount",
        ),
    )
    op.add_column(
        "approval_roles",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_approval_roles_parent_role_id",
        "approval_roles",
        ["parent_role_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_approval_roles_parent_role_id", table_name="approval_roles")
    op.drop_column("approval_roles", "updated_at")
    op.drop_column("approval_roles", "max_occupants")
    op.drop_column("approval_roles", "parent_role_id")
