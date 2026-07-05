"""Add user_functional_scope table

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-07-03

Stores per-user section grants for Functional Admins.
Each row = one section granted to one user within a tenant.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "b2c3d4e5f6a7"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_functional_scope",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("user_tenant_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("section", sa.String(120), nullable=False),
        sa.Column("access_level", sa.String(50), nullable=False, server_default="read_only"),
        sa.UniqueConstraint(
            "tenant_id", "user_tenant_id", "section",
            name="uq_user_functional_scope",
        ),
    )


def downgrade() -> None:
    op.drop_table("user_functional_scope")
