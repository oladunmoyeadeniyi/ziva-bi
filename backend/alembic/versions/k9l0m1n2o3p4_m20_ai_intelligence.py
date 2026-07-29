"""m20_ai_intelligence

Revision ID: k9l0m1n2o3p4
Revises: j8k9l0m1n2o3
Create Date: 2026-07-28 15:00:00.000000

M20 — AI Intelligence Layer.

Adds:
  ai_insights — structured output from anomaly detection, spending analysis,
                cash-flow forecasting, and auto-categorisation runs.
                These are human-reviewable insights generated on demand or
                scheduled; they are separate from ai_predictions which are
                per-request OCR / classify audit rows.

The ai_predictions and ai_learning_overrides tables already exist (M10).
This migration only adds the ai_insights table.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "k9l0m1n2o3p4"
down_revision = "j8k9l0m1n2o3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_insights",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "insight_type", sa.String(30), nullable=False
        ),  # ANOMALY | CATEGORY_SUGGESTION | CASH_FLOW_FORECAST | SPENDING_PATTERN
        sa.Column("entity_type", sa.String(30), nullable=True),   # expense_report | ap_invoice | ar_invoice | payroll_run | etc.
        sa.Column("entity_id", UUID(as_uuid=True), nullable=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("summary", sa.Text, nullable=False),
        sa.Column("detail", JSONB, nullable=True),                 # full structured payload
        sa.Column("severity", sa.String(10), nullable=False, server_default="INFO"),  # INFO | WARNING | CRITICAL
        sa.Column(
            "status", sa.String(10), nullable=False, server_default="PENDING"
        ),  # PENDING | REVIEWED | DISMISSED | ACTIONED
        sa.Column("reviewed_by_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reviewed_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("expires_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "insight_type IN ('ANOMALY','CATEGORY_SUGGESTION','CASH_FLOW_FORECAST','SPENDING_PATTERN')",
            name="ck_ai_insight_type",
        ),
        sa.CheckConstraint(
            "severity IN ('INFO','WARNING','CRITICAL')",
            name="ck_ai_insight_severity",
        ),
        sa.CheckConstraint(
            "status IN ('PENDING','REVIEWED','DISMISSED','ACTIONED')",
            name="ck_ai_insight_status",
        ),
    )
    op.create_index("ix_ai_insights_tenant_id", "ai_insights", ["tenant_id"])
    op.create_index("ix_ai_insights_tenant_status", "ai_insights", ["tenant_id", "status"])


def downgrade() -> None:
    op.drop_table("ai_insights")
