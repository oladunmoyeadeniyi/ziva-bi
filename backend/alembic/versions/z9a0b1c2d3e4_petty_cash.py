"""Petty Cash Funds & Transactions.

Revision: z9a0b1c2d3e4
Down-revision: y8z9a0b1c2d3

Why this exists:
  Many organisations maintain one or more petty cash funds (physical cash floats)
  from which small expenses are disbursed and later retired with receipts.

  petty_cash_funds        — each fund (e.g. "Head Office Petty Cash", "Branch Fund")
  petty_cash_transactions — DISBURSEMENT / RETIREMENT / REPLENISHMENT / ADJUSTMENT

  Fund current_balance is updated atomically on every transaction so it always
  reflects the correct available float without needing a running total query.

Migration chain: ... → y8z9a0b1c2d3 → z9a0b1c2d3e4
"""

from alembic import op
import sqlalchemy as sa

revision = "z9a0b1c2d3e4"
down_revision = "y8z9a0b1c2d3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── petty_cash_funds ──────────────────────────────────────────────────────
    op.create_table(
        "petty_cash_funds",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", sa.UUID(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("custodian_id", sa.UUID(), sa.ForeignKey("employees.id", ondelete="SET NULL"), nullable=True),
        sa.Column("gl_account_id", sa.UUID(), sa.ForeignKey("chart_of_accounts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("expense_gl_account_id", sa.UUID(), sa.ForeignKey("chart_of_accounts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("currency_code", sa.String(3), nullable=False, server_default="NGN"),
        sa.Column("float_amount", sa.Numeric(18, 2), nullable=False, server_default="0"),   # authorised float size
        sa.Column("current_balance", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_by", sa.UUID(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("NOW()"), onupdate=sa.text("NOW()"), nullable=False),
    )
    op.create_index("ix_petty_cash_funds_tenant_id", "petty_cash_funds", ["tenant_id"])

    # ── petty_cash_transactions ───────────────────────────────────────────────
    op.create_table(
        "petty_cash_transactions",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", sa.UUID(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("fund_id", sa.UUID(), sa.ForeignKey("petty_cash_funds.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("transaction_type", sa.String(20), nullable=False),  # DISBURSEMENT / RETIREMENT / REPLENISHMENT / ADJUSTMENT
        sa.Column("employee_id", sa.UUID(), sa.ForeignKey("employees.id", ondelete="SET NULL"), nullable=True),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("description", sa.String(500), nullable=False),
        sa.Column("reference", sa.String(100), nullable=True),
        sa.Column("transaction_date", sa.Date(), nullable=False),
        sa.Column("expense_report_id", sa.UUID(), nullable=True),  # soft link — no FK to avoid circular deps
        sa.Column("journal_entry_id", sa.UUID(), sa.ForeignKey("journal_entries.id", ondelete="SET NULL"), nullable=True),
        sa.Column("balance_after", sa.Numeric(18, 2), nullable=False),  # snapshot of fund balance after this txn
        sa.Column("recorded_by", sa.UUID(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("approved_by", sa.UUID(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("NOW()"), nullable=False),
    )
    op.create_index("ix_pct_tenant_id", "petty_cash_transactions", ["tenant_id"])
    op.create_index("ix_pct_fund_id", "petty_cash_transactions", ["fund_id"])
    op.create_index("ix_pct_txn_date", "petty_cash_transactions", ["transaction_date"])


def downgrade() -> None:
    op.drop_table("petty_cash_transactions")
    op.drop_table("petty_cash_funds")
