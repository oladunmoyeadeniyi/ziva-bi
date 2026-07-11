"""Create posting_batches table.

Revision ID: i2j3k4l5m6n7
Revises: h1i2j3k4l5m6
Create Date: 2026-07-11

Why this exists:
    Three-Mode Architecture — Connected Mode export queue
    (docs/BRIEF_three_mode_architecture.md §2-B).

    When posting_mode = 'connected', approved transactions are NOT written to
    journal_entries (that stays Full ERP only). Instead, each approved
    expense report (or AP invoice, etc.) contributes its GL journal lines to
    a posting_batch row, which the finance team downloads and imports into
    their external ERP.

    One batch per approval event (can be merged by module if desired later).
    Status lifecycle: pending → exported → synced.

    In Lite mode, this table is never written to.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "i2j3k4l5m6n7"
down_revision = "h1i2j3k4l5m6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create posting_batches table with indexes for common query patterns.

    transactions JSONB structure (array of journal-line objects):
    [
      {
        "entry_date": "2026-07-11",
        "description": "Expense report EXP-2026-0023",
        "source_module": "expense",
        "source_id": "<report_uuid>",
        "lines": [
          {
            "gl_code": "5001",
            "gl_name": "Travel and Accommodation",
            "debit": 150000.00,
            "credit": 0.00,
            "dimensions": {"employee_code": "EMP-001", "cost_center": "FIN-001"}
          },
          {
            "gl_code": "2001",
            "gl_name": "Staff Imprest Payable",
            "debit": 0.00,
            "credit": 150000.00,
            "dimensions": {}
          }
        ]
      }
    ]
    """
    op.create_table(
        "posting_batches",
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
        ),
        # Human-readable batch reference, e.g. "BATCH-2026-07-001"
        sa.Column("batch_ref", sa.String(50), nullable=False),
        # Source module for this batch: expense, ap, ar, etc.
        sa.Column("module", sa.String(30), nullable=False, server_default="expense"),
        # pending → exported (downloaded) → synced (confirmed imported into external ERP)
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="pending",
        ),
        # Serialised journal lines ready for external ERP import
        sa.Column("transactions", JSONB, nullable=False, server_default="[]"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("exported_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("synced_at", sa.DateTime(timezone=True), nullable=True),
    )

    # CHECK constraint on status values
    op.create_check_constraint(
        "ck_posting_batches_status",
        "posting_batches",
        "status IN ('pending', 'exported', 'synced')",
    )

    # Indexes for the three most common query patterns
    op.create_index("ix_posting_batches_tenant_id", "posting_batches", ["tenant_id"])
    op.create_index(
        "ix_posting_batches_tenant_status",
        "posting_batches",
        ["tenant_id", "status"],
    )
    op.create_index(
        "ix_posting_batches_tenant_module",
        "posting_batches",
        ["tenant_id", "module"],
    )


def downgrade() -> None:
    """Drop posting_batches table and its indexes."""
    op.drop_index("ix_posting_batches_tenant_module", table_name="posting_batches")
    op.drop_index("ix_posting_batches_tenant_status", table_name="posting_batches")
    op.drop_index("ix_posting_batches_tenant_id", table_name="posting_batches")
    op.drop_constraint(
        "ck_posting_batches_status", "posting_batches", type_="check"
    )
    op.drop_table("posting_batches")
