"""Add sub_area to approval_roles

Revision ID: k8l9m0n1o2p3
Revises: j7k8l9m0n1o2
Create Date: 2026-07-05

sub_area  – A more granular territory within the parent's area.
            Example: area="Lagos Region", sub_area="Lagos Mainland".
            Used both for display on the org chart and to disambiguate
            parent-role matching in bulk uploads when multiple roles share
            the same title (e.g. several DPM nodes each covering a region).
"""

from alembic import op
import sqlalchemy as sa

revision = "k8l9m0n1o2p3"
down_revision = "j7k8l9m0n1o2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "approval_roles",
        sa.Column(
            "sub_area",
            sa.String(200),
            nullable=True,
            comment="Granular territory within parent area (e.g. Lagos Mainland within Lagos Region)",
        ),
    )


def downgrade() -> None:
    op.drop_column("approval_roles", "sub_area")
