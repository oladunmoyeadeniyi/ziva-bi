"""M8.3 Brief 1 — replace fiscal_periods with accounting_periods period state machine

Revision ID: t0u1v2w3x4y5
Revises: s9t0u1v2w3x4
Create Date: 2026-06-16

Drops the old fiscal_periods table (stub; no backfill required — test data only)
and creates the new accounting_periods table with the full period state machine
schema (FUTURE / OPEN / SOFT_CLOSED / OVERDUE / HARD_CLOSED) plus columns
reserved for Brief 2 (grace_expires_at), Brief 3 (checklist), and Brief 4 (reopen).
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "t0u1v2w3x4y5"
down_revision = "s9t0u1v2w3x4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Drop the old fiscal_periods stub table ────────────────────────────────
    op.drop_table("fiscal_periods")

    # ── Create the new accounting_periods table ───────────────────────────────
    op.create_table(
        "accounting_periods",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("fiscal_year", sa.String(20), nullable=False),
        sa.Column("period_no", sa.Integer(), nullable=False),
        sa.Column("period_name", sa.String(50), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        # Status: FUTURE | OPEN | SOFT_CLOSED | OVERDUE | HARD_CLOSED
        sa.Column("status", sa.String(20), nullable=False, server_default="FUTURE"),
        # Hard-close metadata
        sa.Column("hard_closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("hard_closed_by", postgresql.UUID(as_uuid=True), nullable=True),
        # Brief 2 extension point: grace table will populate grace_expires_at
        sa.Column("soft_closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("grace_expires_at", sa.DateTime(timezone=True), nullable=True),
        # Brief 4 extension point: reopen audit
        sa.Column("reopened_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id"], ["tenants.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "tenant_id", "fiscal_year", "period_no",
            name="uq_accounting_periods_tenant_year_no",
        ),
    )
    op.create_index(
        "ix_accounting_periods_tenant_id",
        "accounting_periods",
        ["tenant_id"],
        unique=False,
    )


def downgrade() -> None:
    # ── Drop accounting_periods ───────────────────────────────────────────────
    op.drop_index("ix_accounting_periods_tenant_id", table_name="accounting_periods")
    op.drop_table("accounting_periods")

    # ── Recreate the old fiscal_periods stub table ────────────────────────────
    op.create_table(
        "fiscal_periods",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("fiscal_year", sa.String(20), nullable=False),
        sa.Column("period_name", sa.String(50), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id"], ["tenants.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "tenant_id", "fiscal_year", "period_name",
            name="uq_fiscal_periods_tenant_year_period",
        ),
    )
    op.create_index(
        "ix_fiscal_periods_tenant_id",
        "fiscal_periods",
        ["tenant_id"],
        unique=False,
    )
