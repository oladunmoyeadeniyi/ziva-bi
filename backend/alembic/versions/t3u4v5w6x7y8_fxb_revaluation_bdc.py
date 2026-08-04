"""FX-b — Revaluation Rules and BDC Register tables.

Adds two tables to support period-end FX revaluation and
Bureau de Change (parallel market) rate tracking:

  fx_revaluation_rules  — per-tenant rules that control which account types
                          are revalued at period-end and which FX rate type
                          is used (CLOSING, AVERAGE, etc.).

  bdc_register          — log of BDC/parallel-market rate quotes that can be
                          referenced alongside official rates for disclosure
                          and reconciliation.

Revision ID: t3u4v5w6x7y8
Revises: s2t3u4v5w6x7
Create Date: 2026-08-01
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "t3u4v5w6x7y8"
down_revision = "s2t3u4v5w6x7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── fx_revaluation_rules ──────────────────────────────────────────────────
    op.create_table(
        "fx_revaluation_rules",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("account_type", sa.String(50), nullable=False,
                  comment="GL account type subject to revaluation (e.g. MONETARY_ASSET, MONETARY_LIABILITY)"),
        sa.Column("rate_type", sa.String(20), nullable=False, server_default="CLOSING",
                  comment="FX rate type to use at revaluation (CLOSING | AVERAGE | BUDGET | SPOT)"),
        sa.Column("gain_account_id", UUID(as_uuid=True), sa.ForeignKey("chart_of_accounts.id", ondelete="SET NULL"), nullable=True,
                  comment="GL account to post FX gain"),
        sa.Column("loss_account_id", UUID(as_uuid=True), sa.ForeignKey("chart_of_accounts.id", ondelete="SET NULL"), nullable=True,
                  comment="GL account to post FX loss"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint(
            "rate_type IN ('SPOT','CLOSING','AVERAGE','BUDGET')",
            name="chk_rev_rule_rate_type",
        ),
        sa.UniqueConstraint("tenant_id", "account_type", name="uq_rev_rule_tenant_account_type"),
    )

    # ── bdc_register ─────────────────────────────────────────────────────────
    op.create_table(
        "bdc_register",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("from_currency", sa.String(3), nullable=False),
        sa.Column("to_currency", sa.String(3), nullable=False),
        sa.Column("rate", sa.Numeric(20, 6), nullable=False),
        sa.Column("quote_date", sa.Date(), nullable=False),
        sa.Column("bdc_name", sa.String(200), nullable=True,
                  comment="Name of the Bureau de Change or parallel market source"),
        sa.Column("reference", sa.String(200), nullable=True,
                  comment="Internal reference or transaction number"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("rate > 0", name="chk_bdc_rate_positive"),
    )

    op.create_index("ix_bdc_register_tenant_date", "bdc_register", ["tenant_id", "quote_date"])


def downgrade() -> None:
    op.drop_index("ix_bdc_register_tenant_date", table_name="bdc_register")
    op.drop_table("bdc_register")
    op.drop_table("fx_revaluation_rules")
