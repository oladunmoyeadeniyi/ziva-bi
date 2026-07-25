"""M11c — Bank Reconciliation (bank_statements, bank_statement_lines, bank_recon_matches)

Revision ID: a9b0c1d2e3f4
Revises: z8a9b0c1d2e3
Create Date: 2026-07-25

Design decisions:
- Three tables only: statement header, statement lines, and the match junction.
  No separate "sessions" table — statement.status tracks reconciliation progress.
- match_type discriminator ('journal_line' | 'posting_batch' | 'manual') drives
  which FK is populated — exactly one of matched_journal_line_id /
  matched_posting_batch_id is non-null (or both null for manual notes-only matches).
- bank_statement_lines.match_status is a denormalised cache updated by the match
  engine; it avoids a JOIN on every statement-list query.
- statement_ref unique per (tenant_id): "STMT-2026-001" format.
- No ON DELETE CASCADE from bank_accounts — statements survive account deactivation.
- posting_batches FK uses SET NULL (not RESTRICT) so batches may be deleted without
  blocking recon cleanup.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = "a9b0c1d2e3f4"
down_revision = "z8a9b0c1d2e3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── bank_statements ──────────────────────────────────────────────────────
    op.create_table(
        "bank_statements",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "bank_account_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("bank_accounts.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("statement_ref", sa.String(30), nullable=False),
        sa.Column("statement_date", sa.Date, nullable=False),
        sa.Column("period_start", sa.Date, nullable=True),
        sa.Column("period_end", sa.Date, nullable=True),
        sa.Column("file_name", sa.String(255), nullable=True),
        sa.Column("opening_balance", sa.Numeric(18, 2), nullable=False),
        sa.Column("closing_balance", sa.Numeric(18, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        # status: DRAFT | IN_PROGRESS | RECONCILED
        sa.Column("status", sa.String(20), nullable=False, server_default="DRAFT"),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column(
            "uploaded_by",
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
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("tenant_id", "statement_ref", name="uq_stmt_tenant_ref"),
    )
    op.create_index("ix_bank_statements_tenant", "bank_statements", ["tenant_id"])
    op.create_index(
        "ix_bank_statements_tenant_account",
        "bank_statements",
        ["tenant_id", "bank_account_id"],
    )

    # ── bank_statement_lines ─────────────────────────────────────────────────
    op.create_table(
        "bank_statement_lines",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "statement_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("bank_statements.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("line_number", sa.Integer, nullable=False),
        sa.Column("transaction_date", sa.Date, nullable=False),
        sa.Column("value_date", sa.Date, nullable=True),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("reference", sa.String(255), nullable=True),
        # debit / credit from the bank's perspective (one is zero)
        sa.Column("debit", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("credit", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("running_balance", sa.Numeric(18, 2), nullable=True),
        # match_status: UNMATCHED | MATCHED | PARTIAL | EXCLUDED
        sa.Column(
            "match_status", sa.String(20), nullable=False, server_default="UNMATCHED"
        ),
    )
    op.create_index(
        "ix_bsl_statement_match",
        "bank_statement_lines",
        ["statement_id", "match_status"],
    )

    # ── bank_recon_matches ───────────────────────────────────────────────────
    op.create_table(
        "bank_recon_matches",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "statement_line_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("bank_statement_lines.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        # match_type: 'journal_line' (Full ERP) | 'posting_batch' (Connected) | 'manual' (Lite)
        sa.Column("match_type", sa.String(20), nullable=False),
        # Exactly one of these is populated (or both null for manual/notes-only)
        sa.Column(
            "matched_journal_line_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("journal_lines.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "matched_posting_batch_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("posting_batches.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("matched_amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("notes", sa.String(500), nullable=True),
        sa.Column(
            "matched_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "matched_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_brm_journal_line",
        "bank_recon_matches",
        ["matched_journal_line_id"],
    )
    op.create_index(
        "ix_brm_posting_batch",
        "bank_recon_matches",
        ["matched_posting_batch_id"],
    )


def downgrade() -> None:
    op.drop_table("bank_recon_matches")
    op.drop_table("bank_statement_lines")
    op.drop_table("bank_statements")
