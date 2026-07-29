"""m17_inventory

Revision ID: j8k9l0m1n2o3
Revises: i7j8k9l0m1n2
Create Date: 2026-07-28 14:30:00.000000

M17 — Inventory & Warehouse.

Creates:
  inventory_categories  — product/SKU categories
  inventory_items       — stock-keeping units with costing
  inventory_locations   — warehouse locations (bin/shelf/zone)
  stock_movements       — append-only ledger of stock in/out with COGS

Costing methods: FIFO | WACC (Weighted Average Cost).
COGS posting:
  Full ERP  → DR COGS / CR Inventory GL
  Connected → posting_batches
  Lite      → stock quantity tracking only
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "j8k9l0m1n2o3"
down_revision = "i7j8k9l0m1n2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── inventory_categories ──────────────────────────────────────────────
    op.create_table(
        "inventory_categories",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("code", sa.String(20), nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("tenant_id", "code", name="uq_inv_category_code"),
    )
    op.create_index("ix_inv_categories_tenant_id", "inventory_categories", ["tenant_id"])

    # ── inventory_locations ───────────────────────────────────────────────
    op.create_table(
        "inventory_locations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("code", sa.String(20), nullable=False),
        sa.Column("parent_id", UUID(as_uuid=True), sa.ForeignKey("inventory_locations.id", ondelete="SET NULL"), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("tenant_id", "code", name="uq_inv_location_code"),
    )
    op.create_index("ix_inv_locations_tenant_id", "inventory_locations", ["tenant_id"])

    # ── inventory_items ───────────────────────────────────────────────────
    op.create_table(
        "inventory_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category_id", UUID(as_uuid=True), sa.ForeignKey("inventory_categories.id", ondelete="SET NULL"), nullable=True),
        sa.Column("item_code", sa.String(30), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("unit_of_measure", sa.String(20), nullable=False, server_default="PCS"),
        sa.Column("current_quantity", sa.Numeric(18, 4), nullable=False, server_default="0"),
        sa.Column("reorder_point", sa.Numeric(18, 4), nullable=True),
        sa.Column("reorder_quantity", sa.Numeric(18, 4), nullable=True),
        sa.Column("standard_cost", sa.Numeric(18, 4), nullable=False, server_default="0"),
        sa.Column("moving_average_cost", sa.Numeric(18, 4), nullable=False, server_default="0"),
        sa.Column("valuation_method", sa.String(5), nullable=False, server_default="WACC"),
        sa.Column("gl_inventory_id", UUID(as_uuid=True), sa.ForeignKey("chart_of_accounts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("gl_cogs_id", UUID(as_uuid=True), sa.ForeignKey("chart_of_accounts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("gl_revenue_id", UUID(as_uuid=True), sa.ForeignKey("chart_of_accounts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("valuation_method IN ('FIFO','WACC')", name="ck_inv_item_valuation"),
        sa.UniqueConstraint("tenant_id", "item_code", name="uq_inv_item_code"),
    )
    op.create_index("ix_inv_items_tenant_id", "inventory_items", ["tenant_id"])

    # ── stock_movements ───────────────────────────────────────────────────
    op.create_table(
        "stock_movements",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("item_id", UUID(as_uuid=True), sa.ForeignKey("inventory_items.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("location_id", UUID(as_uuid=True), sa.ForeignKey("inventory_locations.id", ondelete="SET NULL"), nullable=True),
        sa.Column("movement_type", sa.String(20), nullable=False),  # RECEIPT | ISSUE | ADJUSTMENT | TRANSFER
        sa.Column("movement_date", sa.Date, nullable=False),
        sa.Column("reference", sa.String(100), nullable=True),
        sa.Column("quantity", sa.Numeric(18, 4), nullable=False),   # positive = in, negative = out
        sa.Column("unit_cost", sa.Numeric(18, 4), nullable=False, server_default="0"),
        sa.Column("total_cost", sa.Numeric(18, 4), nullable=False, server_default="0"),
        sa.Column("quantity_after", sa.Numeric(18, 4), nullable=False, server_default="0"),
        sa.Column("moving_average_cost_after", sa.Numeric(18, 4), nullable=False, server_default="0"),
        sa.Column("journal_entry_id", UUID(as_uuid=True), sa.ForeignKey("journal_entries.id", ondelete="SET NULL"), nullable=True),
        sa.Column("ap_invoice_id", UUID(as_uuid=True), sa.ForeignKey("ap_invoices.id", ondelete="SET NULL"), nullable=True),
        sa.Column("ar_invoice_id", UUID(as_uuid=True), sa.ForeignKey("ar_invoices.id", ondelete="SET NULL"), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_by_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("movement_type IN ('RECEIPT','ISSUE','ADJUSTMENT','TRANSFER')", name="ck_stock_movement_type"),
    )
    op.create_index("ix_stock_movements_tenant_id", "stock_movements", ["tenant_id"])
    op.create_index("ix_stock_movements_item_id", "stock_movements", ["item_id"])
    op.create_index("ix_stock_movements_date", "stock_movements", ["tenant_id", "movement_date"])


def downgrade() -> None:
    op.drop_table("stock_movements")
    op.drop_table("inventory_items")
    op.drop_table("inventory_locations")
    op.drop_table("inventory_categories")
