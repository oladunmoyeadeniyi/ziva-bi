"""Q1b: Add cf_category and cf_sub_category to chart_of_accounts for Cash Flow Statement.

Revision ID: c1d2e3f4g5h6
Revises: b0c1d2e3f4g5
Create Date: 2026-07-27

Why this migration exists:
    The indirect method Cash Flow Statement (Q1b) needs each GL account to declare
    which section of the cash flow statement it belongs to.  Two nullable columns are
    added to chart_of_accounts:

    cf_category     VARCHAR(20) NULL
        'cash'       — cash & cash equivalents (computes opening/closing balance)
        'operating'  — working capital BS accounts, or non-cash PL items (depreciation)
        'investing'  — long-term asset / investment movements
        'financing'  — debt, equity, dividend movements
        NULL         — not mapped (excluded from cash flow; triggers warning banner)

    cf_sub_category VARCHAR(100) NULL
        Free-text grouping label shown as a sub-header within each section.
        Examples: 'Non-cash adjustments', 'Working capital changes', 'Capital expenditure'
        Defaults to 'Other' in the service layer when NULL.

    Both columns are nullable so that:
    1.  Existing tenants are not broken — their CoA works as before.
    2.  Accounts are tagged incrementally via the CoA edit modal.

No existing data is modified.
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic
revision: str = "c1d2e3f4g5h6"
down_revision: str = "b0c1d2e3f4g5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add cf_category and cf_sub_category columns to chart_of_accounts."""
    op.add_column(
        "chart_of_accounts",
        sa.Column(
            "cf_category",
            sa.String(20),
            nullable=True,
            comment="Cash flow category: 'cash', 'operating', 'investing', 'financing', or NULL",
        ),
    )
    op.add_column(
        "chart_of_accounts",
        sa.Column(
            "cf_sub_category",
            sa.String(100),
            nullable=True,
            comment="Cash flow sub-group label within the section (e.g. 'Non-cash adjustments')",
        ),
    )


def downgrade() -> None:
    """Remove cf_category and cf_sub_category columns from chart_of_accounts."""
    op.drop_column("chart_of_accounts", "cf_sub_category")
    op.drop_column("chart_of_accounts", "cf_category")
