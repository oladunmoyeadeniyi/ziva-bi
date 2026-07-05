"""approval_roles.permission_tier — role-based permission inheritance

Revision ID: a1b2c3d4e5f6
Revises: z6a7b8c9d0e1
Create Date: 2026-07-05

Adds a nullable permission_tier column to approval_roles.
When set to 'power_admin' or 'functional_admin', every employee who holds
that org role inherits the corresponding permission tier (union rule at login).
Fully reversible — drop the column on downgrade.
"""

from alembic import op
import sqlalchemy as sa

revision = "a1b2c3d4e5f6"
down_revision = "z6a7b8c9d0e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "approval_roles",
        sa.Column(
            "permission_tier",
            sa.String(30),
            nullable=True,
            comment="NULL=no special tier; power_admin; functional_admin — every occupant inherits this tier",
        ),
    )


def downgrade() -> None:
    op.drop_column("approval_roles", "permission_tier")
