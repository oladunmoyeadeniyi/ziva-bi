"""Schema drift cleanup — drop stale gl_account_suggestion column.

Revision ID: t2u3v4w5x6y7
Revises: s1t2u3v4w5x6
Create Date: 2026-07-21

The expense_categories.gl_account_suggestion column was an early M7 approach
for linking a category to a GL account by free-text suggestion. In M8 this was
superseded by the category_gl_mappings table (one-to-many, with is_default flag).

The ORM model correctly removed the field at M8 time. The column was never
dropped from the database, leaving it as dead weight. This migration removes it.

Down: recreates the column as nullable text so rollback is safe (data is gone,
but the column structure is restored for schema consistency).
"""

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision = "t2u3v4w5x6y7"
down_revision = "s1t2u3v4w5x6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Drop the stale gl_account_suggestion column from expense_categories."""
    op.drop_column("expense_categories", "gl_account_suggestion")


def downgrade() -> None:
    """Restore the column as nullable text (data is not restored)."""
    op.add_column(
        "expense_categories",
        sa.Column(
            "gl_account_suggestion",
            sa.Text(),
            nullable=True,
            comment="DEPRECATED — superseded by category_gl_mappings table in M8",
        ),
    )
