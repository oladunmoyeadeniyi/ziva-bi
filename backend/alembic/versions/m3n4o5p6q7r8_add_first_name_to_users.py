"""add_first_name_to_users

Revision ID: m3n4o5p6q7r8
Revises: l2m3n4o5p6q7
Create Date: 2026-05-26

Adds first_name (given name) column to users table.
Backfills from the first word of full_name for existing rows.
"""

from alembic import op
import sqlalchemy as sa

revision = "m3n4o5p6q7r8"
down_revision = "l2m3n4o5p6q7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("first_name", sa.String(100), nullable=True),
    )
    # Backfill: take the first space-delimited word of full_name
    op.execute(
        "UPDATE users SET first_name = split_part(full_name, ' ', 1) WHERE first_name IS NULL"
    )


def downgrade() -> None:
    op.drop_column("users", "first_name")
