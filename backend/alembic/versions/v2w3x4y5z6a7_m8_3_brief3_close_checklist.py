"""M8.3 Brief 3 — close checklist template and per-period completion records

Revision ID: v2w3x4y5z6a7
Revises: u1v2w3x4y5z6
Create Date: 2026-06-17

Additive migration:
  - Creates close_checklist_items table (tenant checklist template, soft-deletable)
  - Creates period_checklist_completions table (per-period sign-off records)
    FK to close_checklist_items has NO cascade — completion history survives item changes.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = "v2w3x4y5z6a7"
down_revision = "u1v2w3x4y5z6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── close_checklist_items ─────────────────────────────────────────────────
    op.create_table(
        "close_checklist_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("label", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("applies_to", sa.String(20), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_close_checklist_items_tenant_id",
        "close_checklist_items",
        ["tenant_id"],
    )

    # ── period_checklist_completions ──────────────────────────────────────────
    op.create_table(
        "period_checklist_completions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "period_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("accounting_periods.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # No ondelete cascade — completion rows must survive item deactivation/edit.
        sa.Column(
            "checklist_item_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("close_checklist_items.id"),
            nullable=False,
        ),
        sa.Column("item_label_snapshot", sa.String(255), nullable=False),
        sa.Column("prepared_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("prepared_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("approved_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "period_id", "checklist_item_id",
            name="uq_period_checklist_period_item",
        ),
    )
    op.create_index(
        "ix_period_checklist_completions_tenant_id",
        "period_checklist_completions",
        ["tenant_id"],
    )
    op.create_index(
        "ix_period_checklist_completions_period_id",
        "period_checklist_completions",
        ["period_id"],
    )


def downgrade() -> None:
    op.drop_table("period_checklist_completions")
    op.drop_table("close_checklist_items")
