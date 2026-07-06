"""merge_heads

Revision ID: d2e3f4a5b6c7
Revises: a1b2c3d4e5f7, c1d2e3f4a5b6, d3e4f5a6b7c8
Create Date: 2026-07-06 00:00:00.000000

Merges the three divergent heads into a single linear chain:
  a1b2c3d4e5f7  (approval_designation_based_routing)
  c1d2e3f4a5b6  (system_function_mapping)
  d3e4f5a6b7c8  (approval_role_scopes)
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "d2e3f4a5b6c7"
down_revision = ("a1b2c3d4e5f7", "c1d2e3f4a5b6", "d3e4f5a6b7c8")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
