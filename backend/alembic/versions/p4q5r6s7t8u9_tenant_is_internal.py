"""Add is_internal flag to tenants table.

Distinguishes Ziva BI internal sandbox/demo tenants from real client tenants.
Shown as a badge in the SA portal; allows SA to filter or exclude internal
tenants from commercial reporting.

down_revision references both k2l3m4n5o6p7 and o3p4q5r6s7t8 as co-parents.
Note: k2l3m4n5o6p7 was already fully absorbed into the main chain before this
migration (there was effectively one real head: o3p4q5r6s7t8). The co-parent
declaration is harmless — alembic resolves to a single head (p4q5r6s7t8u9).

Revision ID: p4q5r6s7t8u9
Revises: k2l3m4n5o6p7, o3p4q5r6s7t8
Create Date: 2026-07-13
"""

from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "p4q5r6s7t8u9"
down_revision: Union[str, str] = ("k2l3m4n5o6p7", "o3p4q5r6s7t8")
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tenants",
        sa.Column(
            "is_internal",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )


def downgrade() -> None:
    op.drop_column("tenants", "is_internal")
