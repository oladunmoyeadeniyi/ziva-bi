"""SA-B-lite: add plan + paid_since billing fields to tenants

Revision ID: x6y7z8a9b0c1
Revises: w5x6y7z8a9b0
Create Date: 2026-07-24

Adds two nullable columns to the tenants table:

  plan       — String(30): billing tier set manually by a Super Admin.
                Values: free | starter | growth | enterprise.
                Defaults to NULL (treated as 'free' in the SA portal).
                This is a manual flag only — no payment provider integration.
                Full billing automation is SA-B (TIER 2).

  paid_since — Date: the date on which the tenant first paid (or the start
                of their current paid period). NULL means not yet a paying
                customer. Set manually by the SA alongside the plan tier.

Both columns are additive and fully reversible. No NOT NULL constraint —
existing rows stay NULL and the portal shows them as "Free / Not paid".
"""

from alembic import op
import sqlalchemy as sa


revision = "x6y7z8a9b0c1"
down_revision = "w5x6y7z8a9b0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add plan and paid_since to tenants."""
    op.add_column(
        "tenants",
        sa.Column("plan", sa.String(30), nullable=True),
    )
    op.add_column(
        "tenants",
        sa.Column("paid_since", sa.Date(), nullable=True),
    )


def downgrade() -> None:
    """Remove plan and paid_since from tenants."""
    op.drop_column("tenants", "paid_since")
    op.drop_column("tenants", "plan")
