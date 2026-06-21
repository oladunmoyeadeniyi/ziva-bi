"""GL Engine #1 — journal_entries + journal_lines tables

Revision ID: a7b8c9d0e1f2
Revises: z6a7b8c9d0e1
Create Date: 2026-06-18

Additive, fully reversible migration.

Creates two tables:
  journal_entries  — GL journal header (date, source, status, reference_number, reversal links)
  journal_lines    — Double-entry lines with JSONB dimensions column

Design notes:
  - reference_number is unique per tenant (unique constraint uq_je_tenant_ref).
  - JSONB dimensions: {str(dimension_id): str(dimension_value_id)}.
  - Self-referential FKs (reverses_entry_id, reversed_by_entry_id) — schema-ready,
    reversal logic is a future brief.
  - No environment column — tenant_id already scopes live vs test tenants.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "a7b8c9d0e1f2"
down_revision = "z6a7b8c9d0e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── journal_entries ───────────────────────────────────────────────────────
    op.create_table(
        "journal_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("entry_date", sa.Date(), nullable=False),
        sa.Column("description", sa.String(500), nullable=False),
        sa.Column("source", sa.String(50), nullable=False),
        sa.Column("source_reference", sa.String(255), nullable=True),
        sa.Column("reference_number", sa.String(30), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="POSTED"),
        # Reversal links — self-referential; logic is a later brief.
        sa.Column(
            "reverses_entry_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("journal_entries.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "reversed_by_entry_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("journal_entries.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("posted_at", sa.DateTime(timezone=True), nullable=True),
        # Unique reference per tenant
        sa.UniqueConstraint("tenant_id", "reference_number", name="uq_je_tenant_ref"),
    )
    op.create_index("ix_je_tenant_id", "journal_entries", ["tenant_id"])
    op.create_index("ix_je_tenant_date", "journal_entries", ["tenant_id", "entry_date"])

    # ── journal_lines ─────────────────────────────────────────────────────────
    op.create_table(
        "journal_lines",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "journal_entry_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("journal_entries.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "gl_account_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("chart_of_accounts.id"),
            nullable=False,
        ),
        sa.Column(
            "debit",
            sa.Numeric(18, 2),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "credit",
            sa.Numeric(18, 2),
            nullable=False,
            server_default="0",
        ),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column("line_number", sa.Integer(), nullable=False),
        sa.Column("dimensions", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.create_index("ix_jl_tenant_id", "journal_lines", ["tenant_id"])
    op.create_index("ix_jl_journal_entry_id", "journal_lines", ["journal_entry_id"])
    op.create_index("ix_jl_gl_account_id", "journal_lines", ["gl_account_id"])


def downgrade() -> None:
    op.drop_index("ix_jl_gl_account_id", table_name="journal_lines")
    op.drop_index("ix_jl_journal_entry_id", table_name="journal_lines")
    op.drop_index("ix_jl_tenant_id", table_name="journal_lines")
    op.drop_table("journal_lines")

    op.drop_index("ix_je_tenant_date", table_name="journal_entries")
    op.drop_index("ix_je_tenant_id", table_name="journal_entries")
    op.drop_table("journal_entries")
