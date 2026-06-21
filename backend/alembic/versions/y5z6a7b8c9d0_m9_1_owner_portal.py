"""M9.1 — Owner portal backend (pre_suspension_status column)

Revision ID: y5z6a7b8c9d0
Revises: x4y5z6a7b8c9
Create Date: 2026-06-18

Additive, fully reversible migration. Adds one column to the tenants table:

  pre_suspension_status  — String(50), nullable. Stores the lifecycle_status
                           value that was active before suspension so that
                           POST /api/platform/tenants/{id}/reactivate can
                           restore the tenant to its prior state without guessing.
                           Null for tenants that have never been suspended.
"""

from alembic import op
import sqlalchemy as sa

revision = "y5z6a7b8c9d0"
down_revision = "x4y5z6a7b8c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tenants",
        sa.Column("pre_suspension_status", sa.String(50), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("tenants", "pre_suspension_status")
