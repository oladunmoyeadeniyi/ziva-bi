"""user_tenant: add must_change_password column

Revision ID: o3p4q5r6s7t8
Revises: n2o3p4q5r6s7
Create Date: 2026-07-12

Adds must_change_password (boolean, default False) to user_tenants.
Set to True by SA-initiated tenant creation so the admin is forced to
change the system-generated password before accessing any routes.
"""

from alembic import op
import sqlalchemy as sa

revision: str = "o3p4q5r6s7t8"
down_revision: str = "n2o3p4q5r6s7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user_tenants",
        sa.Column(
            "must_change_password",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("user_tenants", "must_change_password")
