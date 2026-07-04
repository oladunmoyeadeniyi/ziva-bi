"""Add entity_node_id to approval_roles

Revision ID: h5i6j7k8l9m0
Revises: g4h5i6j7k8l9
Create Date: 2026-07-04

Links each approval role to an org-structure Legal entity node.
NULL means the role is not restricted to a specific legal entity.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "h5i6j7k8l9m0"
down_revision = "g4h5i6j7k8l9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "approval_roles",
        sa.Column(
            "entity_node_id",
            UUID(as_uuid=True),
            sa.ForeignKey("org_structure.id", ondelete="SET NULL"),
            nullable=True,
            comment="Which legal entity this role belongs to (org_structure node)",
        ),
    )
    op.create_index(
        "ix_approval_roles_entity_node_id",
        "approval_roles",
        ["entity_node_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_approval_roles_entity_node_id", table_name="approval_roles")
    op.drop_column("approval_roles", "entity_node_id")
