"""m18_fixed_assets

Revision ID: i7j8k9l0m1n2
Revises: h6i7j8k9l0m1
Create Date: 2026-07-28 14:00:00.000000

M18 — Fixed Assets.

Creates:
  asset_categories           — depreciation templates (useful life, method)
  assets                     — individual asset register entries
  asset_depreciation_schedules — monthly depreciation schedule per asset
  asset_disposals            — disposal/write-off records

Depreciation methods: SL (Straight-Line), RB (Reducing Balance).

Three-mode:
  Lite     — asset register only, no GL posting
  Connected — monthly depreciation → posting_batches
  Full ERP  — monthly depreciation → journal_entries (DR dep expense / CR acc dep)
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "i7j8k9l0m1n2"
down_revision = "h6i7j8k9l0m1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── asset_categories ──────────────────────────────────────────────────
    op.create_table(
        "asset_categories",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("code", sa.String(20), nullable=False),
        sa.Column("useful_life_months", sa.Integer, nullable=False),
        sa.Column("depreciation_method", sa.String(5), nullable=False, server_default="SL"),
        sa.Column("residual_pct", sa.Numeric(5, 4), nullable=False, server_default="0"),
        sa.Column("gl_asset_account_id", UUID(as_uuid=True), sa.ForeignKey("chart_of_accounts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("gl_accumulated_dep_id", UUID(as_uuid=True), sa.ForeignKey("chart_of_accounts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("gl_dep_expense_id", UUID(as_uuid=True), sa.ForeignKey("chart_of_accounts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("depreciation_method IN ('SL','RB')", name="ck_asset_cat_dep_method"),
        sa.UniqueConstraint("tenant_id", "code", name="uq_asset_category_code"),
    )
    op.create_index("ix_asset_categories_tenant_id", "asset_categories", ["tenant_id"])

    # ── assets ────────────────────────────────────────────────────────────
    op.create_table(
        "assets",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category_id", UUID(as_uuid=True), sa.ForeignKey("asset_categories.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("asset_code", sa.String(30), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("serial_number", sa.String(100), nullable=True),
        sa.Column("location", sa.String(200), nullable=True),
        sa.Column("acquisition_date", sa.Date, nullable=False),
        sa.Column("acquisition_cost", sa.Numeric(18, 2), nullable=False),
        sa.Column("useful_life_months", sa.Integer, nullable=False),
        sa.Column("depreciation_method", sa.String(5), nullable=False, server_default="SL"),
        sa.Column("residual_value", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("accumulated_depreciation", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("current_book_value", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("status", sa.String(20), nullable=False, server_default="ACTIVE"),
        sa.Column("currency", sa.String(3), nullable=False, server_default="NGN"),
        sa.Column("vendor_id", UUID(as_uuid=True), sa.ForeignKey("vendors.id", ondelete="SET NULL"), nullable=True),
        sa.Column("ap_invoice_id", UUID(as_uuid=True), sa.ForeignKey("ap_invoices.id", ondelete="SET NULL"), nullable=True),
        sa.Column("department_id", UUID(as_uuid=True), sa.ForeignKey("org_structure.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_by_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("status IN ('ACTIVE','DISPOSED','IMPAIRED','FULLY_DEPRECIATED')", name="ck_asset_status"),
        sa.CheckConstraint("depreciation_method IN ('SL','RB')", name="ck_asset_dep_method"),
        sa.UniqueConstraint("tenant_id", "asset_code", name="uq_asset_code"),
    )
    op.create_index("ix_assets_tenant_id", "assets", ["tenant_id"])
    op.create_index("ix_assets_category_id", "assets", ["category_id"])

    # ── asset_depreciation_schedules ──────────────────────────────────────
    op.create_table(
        "asset_depreciation_schedules",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("asset_id", UUID(as_uuid=True), sa.ForeignKey("assets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("schedule_date", sa.Date, nullable=False),            # first day of the month
        sa.Column("depreciation_amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("accumulated_depreciation", sa.Numeric(18, 2), nullable=False),
        sa.Column("book_value_after", sa.Numeric(18, 2), nullable=False),
        sa.Column("is_posted", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("journal_entry_id", UUID(as_uuid=True), sa.ForeignKey("journal_entries.id", ondelete="SET NULL"), nullable=True),
        sa.Column("posted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("asset_id", "schedule_date", name="uq_dep_schedule_month"),
    )
    op.create_index("ix_dep_schedule_asset_id", "asset_depreciation_schedules", ["asset_id"])
    op.create_index("ix_dep_schedule_date", "asset_depreciation_schedules", ["tenant_id", "schedule_date"])

    # ── asset_disposals ───────────────────────────────────────────────────
    op.create_table(
        "asset_disposals",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("asset_id", UUID(as_uuid=True), sa.ForeignKey("assets.id", ondelete="RESTRICT"), nullable=False, unique=True),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("disposal_date", sa.Date, nullable=False),
        sa.Column("disposal_type", sa.String(20), nullable=False),   # SALE | WRITE_OFF | DONATION | SCRAPPED
        sa.Column("disposal_proceeds", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("book_value_at_disposal", sa.Numeric(18, 2), nullable=False),
        sa.Column("gain_loss", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("journal_entry_id", UUID(as_uuid=True), sa.ForeignKey("journal_entries.id", ondelete="SET NULL"), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("disposed_by_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("disposal_type IN ('SALE','WRITE_OFF','DONATION','SCRAPPED')", name="ck_disposal_type"),
    )
    op.create_index("ix_asset_disposals_tenant_id", "asset_disposals", ["tenant_id"])


def downgrade() -> None:
    op.drop_table("asset_disposals")
    op.drop_table("asset_depreciation_schedules")
    op.drop_table("assets")
    op.drop_table("asset_categories")
