"""approval_unique_constraint

Revision ID: a2b3c4d5e6f7
Revises: f1e2d3c4b5a6
Create Date: 2026-05-19 00:01:00.000000

Adds a UNIQUE constraint on (report_id, level) in expense_approvals to prevent
duplicate approval records caused by concurrent double-submit race conditions.

Before adding the constraint, removes any existing duplicates by keeping the
latest record per (report_id, level) based on created_at.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a2b3c4d5e6f7'
down_revision: Union[str, None] = 'f1e2d3c4b5a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Remove duplicate (report_id, level) rows, keeping only the latest per pair.
    # DISTINCT ON is PostgreSQL-specific and is safe here since we target Render/PostgreSQL.
    op.execute("""
        DELETE FROM expense_approvals
        WHERE id NOT IN (
            SELECT DISTINCT ON (report_id, level) id
            FROM expense_approvals
            ORDER BY report_id, level, created_at DESC
        )
    """)

    op.create_unique_constraint(
        "uq_expense_approvals_report_level",
        "expense_approvals",
        ["report_id", "level"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_expense_approvals_report_level",
        "expense_approvals",
        type_="unique",
    )
