"""Add tenant_permission_matrix table

Revision ID: a1b2c3d4e5f6
Revises: z6a7b8c9d0e1
Create Date: 2026-07-03

Stores per-tenant overrides for the role permission matrix.
Missing rows fall back to hardcoded defaults in the GET endpoint.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "a1b2c3d4e5f6"
down_revision = "z6a7b8c9d0e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tenant_permission_matrix",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("section", sa.String(120), nullable=False),
        sa.Column("role_tier", sa.String(50), nullable=False),
        sa.Column("access_level", sa.String(50), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "tenant_id", "section", "role_tier",
            name="uq_perm_matrix_tenant_section_tier",
        ),
    )


def downgrade() -> None:
    op.drop_table("tenant_permission_matrix")
