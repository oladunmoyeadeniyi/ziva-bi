"""add value_source description icon to tenant_dimensions

Revision ID: p6q7r8s9t0u1
Revises: o5p6q7r8s9t0
Create Date: 2026-05-27

Adds value_source, description, and icon columns to tenant_dimensions.
value_source controls how dimension values are populated:
  manual | org_structure | employee_master | customer_category | hybrid | product_master
"""

from alembic import op
import sqlalchemy as sa

revision = "p6q7r8s9t0u1"
down_revision = "o5p6q7r8s9t0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tenant_dimensions",
        sa.Column("value_source", sa.String(50), nullable=True, server_default="manual"))
    op.add_column("tenant_dimensions",
        sa.Column("description", sa.String(500), nullable=True))
    op.add_column("tenant_dimensions",
        sa.Column("icon", sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column("tenant_dimensions", "value_source")
    op.drop_column("tenant_dimensions", "description")
    op.drop_column("tenant_dimensions", "icon")
