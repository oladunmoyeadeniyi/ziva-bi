"""add entity_code to org_structure

Revision ID: n4o5p6q7r8s9
Revises: m3n4o5p6q7r8
Create Date: 2026-05-26

Adds entity_code (nullable String 100) to the org_structure table.
Used for Legal entity nodes to store the ERP profit centre / entity code
(e.g. Sage X3 profit centre N22341 for Red Bull Nigeria).
"""

from alembic import op
import sqlalchemy as sa

revision = "n4o5p6q7r8s9"
down_revision = "m3n4o5p6q7r8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "org_structure",
        sa.Column("entity_code", sa.String(100), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("org_structure", "entity_code")
