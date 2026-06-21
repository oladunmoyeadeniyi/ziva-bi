"""coa_remap_golive_gate

Revision ID: h4i5j6k7l8m9
Revises: g3h4i5j6k7l8
Create Date: 2026-06-21

Supports Brief: BRIEF_coa_remap_golive_gate.md

Changes:
1. chart_of_accounts: add is_retired BOOLEAN NOT NULL DEFAULT false.
   Retired accounts have is_active=false AND is_retired=true.
   is_active=false alone means plain-deactivated (remap was not involved).

2. gl_code_remaps: new table recording GL account retirement remap history.
   one row per old→new account pair.  Multiple rows can share the same
   new_account_id (many-to-one remap).  FKs to chart_of_accounts are
   NO ACTION because retired accounts must never be deleted.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "h4i5j6k7l8m9"
down_revision = "g3h4i5j6k7l8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. is_retired flag on chart_of_accounts
    op.add_column(
        "chart_of_accounts",
        sa.Column(
            "is_retired",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )

    # 2. gl_code_remaps audit/mapping table
    op.create_table(
        "gl_code_remaps",
        sa.Column("id",             postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id",      postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id",          ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("old_account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("chart_of_accounts.id", ondelete="NO ACTION"), nullable=False),
        sa.Column("new_account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("chart_of_accounts.id", ondelete="NO ACTION"), nullable=False),
        sa.Column("remapped_by",    postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id",             ondelete="SET NULL"), nullable=True),
        sa.Column("remapped_at",    sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("reason",         sa.String(500), nullable=True),
    )
    op.create_index("ix_gl_code_remaps_old_account_id", "gl_code_remaps", ["old_account_id"])
    op.create_index("ix_gl_code_remaps_new_account_id", "gl_code_remaps", ["new_account_id"])


def downgrade() -> None:
    op.drop_table("gl_code_remaps")
    op.drop_column("chart_of_accounts", "is_retired")
