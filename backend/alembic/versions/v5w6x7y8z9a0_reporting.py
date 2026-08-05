"""Reporting & Analytics — saved_reports table.

Allows users to save custom report definitions (module + filters + date range)
so they can be re-run on demand without re-specifying parameters each time.
Pre-built report execution is stateless (no table needed); only saved user
report definitions require persistence.

Revision ID: v5w6x7y8z9a0
Revises: u4v5w6x7y8z9
Create Date: 2026-08-04
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "v5w6x7y8z9a0"
down_revision = "u4v5w6x7y8z9"
branch_labels = None
depends_on = None

# Valid module keys for report scoping
_REPORT_MODULES = [
    "expense", "ar", "ap", "payroll", "budget", "tax", "inventory",
    "fixed_assets", "gl", "consolidation",
]

# Valid built-in report types
_REPORT_TYPES = [
    "expense_summary", "expense_by_category", "expense_by_department",
    "ar_aging", "ar_invoice_summary",
    "ap_aging", "ap_invoice_summary",
    "budget_variance", "budget_summary",
    "payroll_summary", "payroll_by_department",
    "tax_summary", "wht_summary",
    "inventory_valuation", "inventory_movement",
    "asset_register", "asset_depreciation",
    "gl_activity", "trial_balance_trend",
    "cash_flow_summary",
]


def upgrade() -> None:
    op.create_table(
        "saved_reports",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "tenant_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "name",
            sa.String(200),
            nullable=False,
            comment="User-provided display name for this saved report.",
        ),
        sa.Column(
            "description",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "report_type",
            sa.String(60),
            nullable=False,
            comment="One of the built-in report type slugs (see _REPORT_TYPES).",
        ),
        sa.Column(
            "module",
            sa.String(40),
            nullable=False,
            comment="Module this report belongs to (expense, ar, ap, etc.).",
        ),
        sa.Column(
            "filters",
            JSONB(),
            nullable=False,
            server_default="{}",
            comment=(
                "JSONB blob of user-supplied filters: "
                "date_from, date_to, period_id, department_id, category_id, "
                "employee_id, cost_center_id, currency_code, comparison_period, etc."
            ),
        ),
        sa.Column(
            "is_shared",
            sa.Boolean(),
            nullable=False,
            server_default="false",
            comment="True = visible to all admin users in this tenant.",
        ),
        sa.Column(
            "created_by",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
            comment="User who saved this report definition.",
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "last_run_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
            comment="Last time this saved report was executed.",
        ),
    )


def downgrade() -> None:
    op.drop_table("saved_reports")
