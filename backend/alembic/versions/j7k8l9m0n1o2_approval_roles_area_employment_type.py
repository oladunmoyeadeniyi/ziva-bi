"""Add area and employment_type to approval_roles

Revision ID: j7k8l9m0n1o2
Revises: i6j7k8l9m0n1
Create Date: 2026-07-05

area            – Free-text geographic area / location / region of responsibility
                  (e.g. "Lagos Region", "South West", "On Premise National").
employment_type – Category of engagement: permanent | contract | outsourced.
                  Outsourced staff appear on the org chart but are excluded from
                  payroll runs; their cost is routed through a 3rd-party vendor bill.
"""

from alembic import op
import sqlalchemy as sa

revision = "j7k8l9m0n1o2"
down_revision = "i6j7k8l9m0n1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "approval_roles",
        sa.Column(
            "area",
            sa.String(200),
            nullable=True,
            comment="Geographic area / location / region of responsibility (free text)",
        ),
    )
    op.add_column(
        "approval_roles",
        sa.Column(
            "employment_type",
            sa.String(20),
            nullable=True,
            server_default="permanent",
            comment="permanent (default) | contract | outsourced",
        ),
    )


def downgrade() -> None:
    op.drop_column("approval_roles", "employment_type")
    op.drop_column("approval_roles", "area")
