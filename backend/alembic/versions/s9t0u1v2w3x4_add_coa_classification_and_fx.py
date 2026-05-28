"""add account_classification and foreign currency fields to chart_of_accounts

Revision ID: s9t0u1v2w3x4
Revises: r8s9t0u1v2w3
Create Date: 2026-05-28

Adds account_classification (drives Tax Engine, AP, AR, Payroll, Fixed Assets,
Reporting behaviour) and three foreign currency fields to chart_of_accounts.
"""

from alembic import op
import sqlalchemy as sa

revision = "s9t0u1v2w3x4"
down_revision = "r8s9t0u1v2w3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("chart_of_accounts",
        sa.Column("account_classification", sa.String(100), nullable=True))
    op.add_column("chart_of_accounts",
        sa.Column("is_foreign_currency", sa.Boolean, nullable=True,
                  server_default="false"))
    op.add_column("chart_of_accounts",
        sa.Column("foreign_currency_code", sa.String(10), nullable=True))
    op.add_column("chart_of_accounts",
        sa.Column("revalue_at_period_end", sa.Boolean, nullable=True,
                  server_default="false"))


def downgrade() -> None:
    op.drop_column("chart_of_accounts", "account_classification")
    op.drop_column("chart_of_accounts", "is_foreign_currency")
    op.drop_column("chart_of_accounts", "foreign_currency_code")
    op.drop_column("chart_of_accounts", "revalue_at_period_end")
