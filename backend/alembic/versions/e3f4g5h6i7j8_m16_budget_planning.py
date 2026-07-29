"""m16_budget_planning

Revision ID: e3f4g5h6i7j8
Revises: d2e3f4g5h6i7
Create Date: 2026-07-28 12:00:00.000000

M16 — Budget & Planning.

Creates two tables:
  budget_periods   — the budget envelope (annual / quarterly / custom)
  budget_lines     — per GL-account allocations with optional monthly breakdowns

Variance reporting is computed on-the-fly against GL actuals (Full ERP),
posting_batches (Connected), or expense/AP/AR exports (Lite).
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "e3f4g5h6i7j8"
down_revision = "d2e3f4g5h6i7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── budget_periods ────────────────────────────────────────────────────
    op.create_table(
        "budget_periods",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("fiscal_year", sa.Integer, nullable=False),
        sa.Column("period_start", sa.Date, nullable=False),
        sa.Column("period_end", sa.Date, nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="DRAFT"),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("created_by_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("approved_by_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("approved_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), onupdate=sa.text("now()"), nullable=False),
        sa.CheckConstraint("status IN ('DRAFT','ACTIVE','LOCKED')", name="ck_budget_period_status"),
    )
    op.create_index("ix_budget_periods_tenant_id", "budget_periods", ["tenant_id"])
    op.create_index("ix_budget_periods_fiscal_year", "budget_periods", ["tenant_id", "fiscal_year"])

    # ── budget_lines ──────────────────────────────────────────────────────
    op.create_table(
        "budget_lines",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("budget_period_id", UUID(as_uuid=True), sa.ForeignKey("budget_periods.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("gl_account_id", UUID(as_uuid=True), sa.ForeignKey("chart_of_accounts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("department_id", UUID(as_uuid=True), sa.ForeignKey("org_structure.id", ondelete="SET NULL"), nullable=True),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column("annual_amount", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("monthly_allocations", JSONB, nullable=True),  # {"01": 50000, "02": 45000, ...}
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), onupdate=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_budget_lines_period_id", "budget_lines", ["budget_period_id"])
    op.create_index("ix_budget_lines_tenant_id", "budget_lines", ["tenant_id"])
    op.create_index("ix_budget_lines_gl_account_id", "budget_lines", ["gl_account_id"])
    # Unique: one line per GL account per department per budget period
    op.create_unique_constraint(
        "uq_budget_line_gl_dept",
        "budget_lines",
        ["budget_period_id", "gl_account_id", "department_id"],
    )


def downgrade() -> None:
    op.drop_table("budget_lines")
    op.drop_table("budget_periods")
