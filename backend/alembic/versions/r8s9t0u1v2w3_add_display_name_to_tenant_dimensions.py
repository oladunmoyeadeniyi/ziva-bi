"""add display_name to tenant_dimensions

Revision ID: r8s9t0u1v2w3
Revises: q7r8s9t0u1v2
Create Date: 2026-05-28

Adds display_name column to tenant_dimensions so tenants can rename standard
dimensions (e.g. "Statistical internal order" → "Staff code") without changing
the system code used for internal logic.
"""

from alembic import op
import sqlalchemy as sa

revision = "r8s9t0u1v2w3"
down_revision = "q7r8s9t0u1v2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tenant_dimensions",
        sa.Column("display_name", sa.String(255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("tenant_dimensions", "display_name")
