"""M8.3 Brief 4 — fiscal year state + period audit log

Revision ID: w3x4y5z6a7b8
Revises: v2w3x4y5z6a7
Create Date: 2026-06-17

Additive migration:
  - Adds default_audit_grace_months (int, default 3) to tenant_org_config
  - Creates fiscal_year_states table (two-stage year-end close state machine)
  - Creates period_audit_logs table (append-only audit trail for period actions)
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = "w3x4y5z6a7b8"
down_revision = "v2w3x4y5z6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── tenant_org_config: default audit grace ────────────────────────────────
    op.add_column(
        "tenant_org_config",
        sa.Column(
            "default_audit_grace_months",
            sa.Integer(),
            nullable=False,
            server_default="3",
        ),
    )

    # ── fiscal_year_states ────────────────────────────────────────────────────
    op.create_table(
        "fiscal_year_states",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("fiscal_year", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="OPEN"),
        sa.Column("management_closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("management_closed_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("audit_grace_months", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("audit_grace_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("statutory_closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("statutory_closed_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("retained_earnings_rolled", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "tenant_id", "fiscal_year",
            name="uq_fiscal_year_states_tenant_year",
        ),
    )
    op.create_index(
        "ix_fiscal_year_states_tenant_id",
        "fiscal_year_states",
        ["tenant_id"],
    )

    # ── period_audit_logs ─────────────────────────────────────────────────────
    op.create_table(
        "period_audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("fiscal_year", sa.String(20), nullable=True),
        sa.Column("period_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("action", sa.String(30), nullable=False),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_period_audit_logs_tenant_id",
        "period_audit_logs",
        ["tenant_id"],
    )


def downgrade() -> None:
    op.drop_table("period_audit_logs")
    op.drop_table("fiscal_year_states")
    op.drop_column("tenant_org_config", "default_audit_grace_months")
