"""Bank Accounts register + journal_lines.bank_account_id

Revision ID: e1f2g3h4i5j6
Revises: d0e1f2g3h4i5
Create Date: 2026-06-19

Two additive changes:

1. Create bank_accounts table:
   - Tenant-scoped register of bank/cash accounts (replaces removed default_bank/cash roles).
   - Multiple accounts per currency; multiple may share one GL account.
   - is_default: at most one per (tenant_id, currency) — enforced in app logic.
   - GL must be BS/SOFP — validated in the router.

2. Add nullable bank_account_id to journal_lines:
   - For per-account reconciliation/reporting tagging only.
   - Does NOT change posting behaviour — existing lines and callers unaffected.
   - SET NULL on delete so removing a bank account doesn't orphan lines.
   - Reconciliation tooling is a FUTURE module.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "e1f2g3h4i5j6"
down_revision = "d0e1f2g3h4i5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. bank_accounts ─────────────────────────────────────────────────────
    op.create_table(
        "bank_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("bank_name", sa.String(255), nullable=False),
        sa.Column("account_name", sa.String(255), nullable=False),
        sa.Column("account_number", sa.String(100), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column(
            "gl_account_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("chart_of_accounts.id"),
            nullable=False,
        ),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
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
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_bank_accounts_tenant_id", "bank_accounts", ["tenant_id"])
    op.create_index("ix_bank_accounts_currency", "bank_accounts", ["currency"])
    op.create_index("ix_bank_accounts_gl_account_id", "bank_accounts", ["gl_account_id"])

    # ── 2. journal_lines.bank_account_id ─────────────────────────────────────
    op.add_column(
        "journal_lines",
        sa.Column(
            "bank_account_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("bank_accounts.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_jl_bank_account_id", "journal_lines", ["bank_account_id"])


def downgrade() -> None:
    op.drop_index("ix_jl_bank_account_id", table_name="journal_lines")
    op.drop_column("journal_lines", "bank_account_id")

    op.drop_index("ix_bank_accounts_gl_account_id", table_name="bank_accounts")
    op.drop_index("ix_bank_accounts_currency", table_name="bank_accounts")
    op.drop_index("ix_bank_accounts_tenant_id", table_name="bank_accounts")
    op.drop_table("bank_accounts")
