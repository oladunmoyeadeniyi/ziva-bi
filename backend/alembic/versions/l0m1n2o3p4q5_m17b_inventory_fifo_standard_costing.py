"""m17b — Inventory FIFO and Standard Costing

Adds full FIFO cost-layer tracking and Standard costing (with PPV GL) to the
inventory module.  These are the two remaining costing methods alongside WACC
(which was already implemented in M17).

Changes:
  1. inventory_items.valuation_method — widened from String(5) to String(8)
     and check constraint extended to include 'STANDARD'.
  2. inventory_items.gl_ppv_id — new nullable UUID FK to chart_of_accounts.
     Used for posting Purchase Price Variance journals in Standard costing
     (Full ERP mode only).
  3. inventory_cost_layers — new table that tracks individual RECEIPT batches
     for FIFO items.  Each RECEIPT creates a layer; each ISSUE consumes layers
     oldest-first and reduces quantity_remaining until the layer is exhausted.

Revision: l0m1n2o3p4q5
Down revision: k9l0m1n2o3p4 (M20 AI Intelligence Layer)
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'l0m1n2o3p4q5'
down_revision = 'k9l0m1n2o3p4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. Widen valuation_method column (String 5 → 8) ──────────────────────
    op.alter_column(
        'inventory_items', 'valuation_method',
        existing_type=sa.String(5),
        type_=sa.String(8),
        nullable=False,
    )

    # ── 2. Replace valuation check constraint to include STANDARD ─────────────
    op.drop_constraint('ck_inv_item_valuation', 'inventory_items', type_='check')
    op.create_check_constraint(
        'ck_inv_item_valuation',
        'inventory_items',
        "valuation_method IN ('FIFO','WACC','STANDARD')",
    )

    # ── 3. Add Purchase Price Variance GL column ──────────────────────────────
    op.add_column('inventory_items', sa.Column(
        'gl_ppv_id',
        postgresql.UUID(as_uuid=True),
        nullable=True,
    ))
    op.create_foreign_key(
        'fk_inv_items_gl_ppv',
        'inventory_items', 'chart_of_accounts',
        ['gl_ppv_id'], ['id'],
        ondelete='SET NULL',
    )

    # ── 4. Create inventory_cost_layers (FIFO layer tracking) ─────────────────
    op.create_table(
        'inventory_cost_layers',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('item_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('inventory_items.id', ondelete='CASCADE'), nullable=False),
        # receipt_movement_id links the layer back to the RECEIPT stock_movement
        # for traceability; nullable because the movement is flushed first then
        # updated after the layer is created.
        sa.Column('receipt_movement_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('stock_movements.id', ondelete='SET NULL'), nullable=True),
        sa.Column('received_date', sa.Date, nullable=False),
        sa.Column('unit_cost', sa.Numeric(18, 4), nullable=False),
        sa.Column('quantity_received', sa.Numeric(18, 4), nullable=False),
        sa.Column('quantity_remaining', sa.Numeric(18, 4), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_inv_cost_layers_tenant_id',
                    'inventory_cost_layers', ['tenant_id'])
    op.create_index('ix_inv_cost_layers_item_id',
                    'inventory_cost_layers', ['item_id'])
    # Compound index for FIFO consumption query (item + date order)
    op.create_index('ix_inv_cost_layers_item_date',
                    'inventory_cost_layers', ['item_id', 'received_date'])


def downgrade() -> None:
    op.drop_table('inventory_cost_layers')
    op.drop_constraint('fk_inv_items_gl_ppv', 'inventory_items', type_='foreignkey')
    op.drop_column('inventory_items', 'gl_ppv_id')
    op.drop_constraint('ck_inv_item_valuation', 'inventory_items', type_='check')
    op.create_check_constraint(
        'ck_inv_item_valuation',
        'inventory_items',
        "valuation_method IN ('FIFO','WACC')",
    )
    op.alter_column(
        'inventory_items', 'valuation_method',
        existing_type=sa.String(8),
        type_=sa.String(5),
        nullable=False,
    )
