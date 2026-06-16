"""M8.3 Brief 2 — grace overrides, manual-journal block, future-dated exception

Revision ID: u1v2w3x4y5z6
Revises: t0u1v2w3x4y5
Create Date: 2026-06-16

Additive migration:
  - Adds block_journal_into_open_prior (bool, default True) to tenant_org_config
  - Creates period_grace_overrides table
  - Creates future_posting_exceptions table
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "u1v2w3x4y5z6"
down_revision = "t0u1v2w3x4y5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── block_journal_into_open_prior on tenant_org_config ────────────────────
    op.add_column(
        "tenant_org_config",
        sa.Column(
            "block_journal_into_open_prior",
            sa.Boolean(),
            nullable=False,
            server_default="true",
        ),
    )

    # ── period_grace_overrides ────────────────────────────────────────────────
    op.create_table(
        "period_grace_overrides",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("module", sa.String(50), nullable=False),
        sa.Column("applies_to_type", sa.String(20), nullable=False),
        sa.Column("applies_to_role", sa.String(50), nullable=True),
        sa.Column("applies_to_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("period_type", sa.String(20), nullable=False),
        sa.Column("grace_value", sa.Integer(), nullable=False),
        sa.Column("grace_unit", sa.String(20), nullable=False),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_period_grace_overrides_tenant_id",
        "period_grace_overrides",
        ["tenant_id"],
        unique=False,
    )

    # ── future_posting_exceptions ─────────────────────────────────────────────
    op.create_table(
        "future_posting_exceptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("target_date", sa.Date(), nullable=False),
        sa.Column("module", sa.String(50), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_future_posting_exceptions_tenant_id",
        "future_posting_exceptions",
        ["tenant_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_future_posting_exceptions_tenant_id", table_name="future_posting_exceptions")
    op.drop_table("future_posting_exceptions")

    op.drop_index("ix_period_grace_overrides_tenant_id", table_name="period_grace_overrides")
    op.drop_table("period_grace_overrides")

    op.drop_column("tenant_org_config", "block_journal_into_open_prior")
