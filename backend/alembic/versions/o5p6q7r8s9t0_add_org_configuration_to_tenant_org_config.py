"""add org_configuration to tenant_org_config

Revision ID: o5p6q7r8s9t0
Revises: n4o5p6q7r8s9
Create Date: 2026-05-27

Adds org_configuration JSONB column to tenant_org_config.
Stores the Configuration tab state: financial features (dimensions, multi-currency,
intercompany), operations & costing, tax applicability, and governance settings.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "o5p6q7r8s9t0"
down_revision = "n4o5p6q7r8s9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tenant_org_config",
        sa.Column("org_configuration", postgresql.JSONB, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("tenant_org_config", "org_configuration")
