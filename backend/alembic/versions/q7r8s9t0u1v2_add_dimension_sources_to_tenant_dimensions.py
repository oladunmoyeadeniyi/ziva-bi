"""add dimension_sources JSONB to tenant_dimensions

Revision ID: q7r8s9t0u1v2
Revises: p6q7r8s9t0u1
Create Date: 2026-05-28

Adds dimension_sources JSONB column to tenant_dimensions.
Stores a list of connected source dicts, each with source_type and optional filter.
Example: [{"source_type": "org_structure", "filter": {"parent_code": "N22341SA"}}]
Manual values are always available and are NOT stored as a source.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "q7r8s9t0u1v2"
down_revision = "p6q7r8s9t0u1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tenant_dimensions",
        sa.Column(
            "dimension_sources",
            postgresql.JSONB,
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("tenant_dimensions", "dimension_sources")
