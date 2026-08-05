"""Store Requisitions & Consumables Tracking.

Revision: y8z9a0b1c2d3
Down-revision: x7y8z9a0b1c2

Why this exists:
  Organisations maintain internal stores of consumable items (stationery, spare parts,
  cleaning supplies, etc.). This migration extends inventory_items with store-specific
  fields and adds two new tables for keeper-managed issuance and returns.

  store_issues      — keeper records that an item was given to an employee/department
  store_returns     — keeper records items returned (full or partial), updates stock

  Each issue posts an OUT movement; each return posts an IN movement on the existing
  stock_movements table so current_stock on inventory_items stays accurate.

Migration chain: ... → x7y8z9a0b1c2 → y8z9a0b1c2d3
"""

from alembic import op
import sqlalchemy as sa

revision = "y8z9a0b1c2d3"
down_revision = "x7y8z9a0b1c2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Extend inventory_items with store fields ──────────────────────────────
    # NOTE: reorder_quantity already exists (Numeric 18,4) from the M17 inventory
    # milestone — do NOT add it again. Only add the two new store-specific columns.
    op.add_column("inventory_items", sa.Column("is_store_item", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("inventory_items", sa.Column("minimum_stock_level", sa.Numeric(18, 4), nullable=True))

    # ── store_issues ──────────────────────────────────────────────────────────
    op.create_table(
        "store_issues",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", sa.UUID(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("inventory_item_id", sa.UUID(), sa.ForeignKey("inventory_items.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("employee_id", sa.UUID(), sa.ForeignKey("employees.id", ondelete="SET NULL"), nullable=True),
        sa.Column("department", sa.String(200), nullable=True),
        sa.Column("location_name", sa.String(200), nullable=True),
        sa.Column("quantity_issued", sa.Numeric(18, 4), nullable=False),
        sa.Column("unit_of_measure", sa.String(50), nullable=True),
        sa.Column("issue_date", sa.Date(), nullable=False),
        sa.Column("purpose", sa.String(500), nullable=True),
        sa.Column("reference", sa.String(100), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("issued_by", sa.UUID(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("stock_movement_id", sa.UUID(), nullable=True),  # loose ref — no FK to avoid circular dep
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("NOW()"), nullable=False),
    )
    op.create_index("ix_store_issues_tenant_id", "store_issues", ["tenant_id"])
    op.create_index("ix_store_issues_item_id", "store_issues", ["inventory_item_id"])
    op.create_index("ix_store_issues_issue_date", "store_issues", ["issue_date"])

    # ── store_returns ─────────────────────────────────────────────────────────
    op.create_table(
        "store_returns",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", sa.UUID(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("store_issue_id", sa.UUID(), sa.ForeignKey("store_issues.id", ondelete="SET NULL"), nullable=True),
        sa.Column("inventory_item_id", sa.UUID(), sa.ForeignKey("inventory_items.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("employee_id", sa.UUID(), sa.ForeignKey("employees.id", ondelete="SET NULL"), nullable=True),
        sa.Column("quantity_returned", sa.Numeric(18, 4), nullable=False),
        sa.Column("return_date", sa.Date(), nullable=False),
        sa.Column("condition", sa.String(20), nullable=False, server_default="GOOD"),  # GOOD / DAMAGED / PARTIAL
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("received_by", sa.UUID(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("stock_movement_id", sa.UUID(), nullable=True),  # loose ref — no FK to avoid circular dep
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("NOW()"), nullable=False),
    )
    op.create_index("ix_store_returns_tenant_id", "store_returns", ["tenant_id"])
    op.create_index("ix_store_returns_item_id", "store_returns", ["inventory_item_id"])


def downgrade() -> None:
    op.drop_table("store_returns")
    op.drop_table("store_issues")
    # reorder_quantity was NOT added in upgrade — do not drop it
    op.drop_column("inventory_items", "minimum_stock_level")
    op.drop_column("inventory_items", "is_store_item")
