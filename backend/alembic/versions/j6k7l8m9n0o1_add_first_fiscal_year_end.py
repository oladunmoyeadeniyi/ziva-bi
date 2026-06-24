"""add first_fiscal_year_end to tenant_org_config

Revision ID: j6k7l8m9n0o1
Revises: i5j6k7l8m9n0
Create Date: 2026-06-24

Adds the first_fiscal_year_end nullable Date column to tenant_org_config.
When set, this date represents the last day of the company's very first
accounting year. The backend derives fiscal_year_start_month and
fiscal_year_start_day automatically from this date on every PATCH /api/setup/org
call that includes this field. Existing rows are unaffected (column is nullable).
"""

from alembic import op
import sqlalchemy as sa

revision = "j6k7l8m9n0o1"
down_revision = "i5j6k7l8m9n0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tenant_org_config",
        sa.Column("first_fiscal_year_end", sa.Date(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("tenant_org_config", "first_fiscal_year_end")
