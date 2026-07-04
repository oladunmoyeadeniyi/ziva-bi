"""Add designation to approval_roles

Revision ID: i6j7k8l9m0n1
Revises: h5i6j7k8l9m0
Create Date: 2026-07-04

Marks a role as a department head or entity head so the approval routing
engine can auto-resolve direct_to_hod and ceiling-role lookups.

Values: NULL / '' = regular role
        'head_of_department' = Head of Department (HOD)
        'head_of_entity'     = Head of Entity (GM / CEO / MD / ED)
"""

from alembic import op
import sqlalchemy as sa

revision = "i6j7k8l9m0n1"
down_revision = "h5i6j7k8l9m0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "approval_roles",
        sa.Column(
            "designation",
            sa.String(50),
            nullable=True,
            comment="NULL=regular; head_of_department; head_of_entity",
        ),
    )


def downgrade() -> None:
    op.drop_column("approval_roles", "designation")
