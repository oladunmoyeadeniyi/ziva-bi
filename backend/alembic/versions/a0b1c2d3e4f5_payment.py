"""Expense Payment Queue & Paystack Integration.

Revision: a0b1c2d3e4f5
Down-revision: z9a0b1c2d3e4

Why this exists:
  After an expense report is fully approved, the payment team needs to
  track and execute reimbursements. Two rails are supported:

  MANUAL  — finance marks payments as paid outside the system (no API call)
  PAYSTACK — Paystack Transfers API is used for direct bank transfer to employees

Tables:
  expense_payment_configs      — one row per tenant; payment_mode + encrypted Paystack keys
  employee_bank_accounts       — bank account details per employee (for Paystack recipient)
  expense_payments             — one payment record per approved expense report
                                 status: QUEUED → PROCESSING → PAID | FAILED | CANCELLED

Migration chain: ... → z9a0b1c2d3e4 → a0b1c2d3e4f5
"""

from alembic import op
import sqlalchemy as sa

revision = "a0b1c2d3e4f5"
down_revision = "z9a0b1c2d3e4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── expense_payment_configs ───────────────────────────────────────────────
    op.create_table(
        "expense_payment_configs",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", sa.UUID(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("payment_mode", sa.String(20), nullable=False, server_default="MANUAL"),  # MANUAL | PAYSTACK
        # Paystack keys stored encrypted at rest — never in plaintext
        sa.Column("paystack_secret_key_encrypted", sa.Text(), nullable=True),
        sa.Column("paystack_public_key_encrypted", sa.Text(), nullable=True),
        sa.Column("paystack_subaccount", sa.String(100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_by", sa.UUID(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("NOW()"), nullable=False),
    )
    op.create_index("ix_epc_tenant_id", "expense_payment_configs", ["tenant_id"])

    # ── employee_bank_accounts ────────────────────────────────────────────────
    op.create_table(
        "employee_bank_accounts",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", sa.UUID(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("employee_id", sa.UUID(), sa.ForeignKey("employees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("bank_name", sa.String(100), nullable=False),
        sa.Column("bank_code", sa.String(10), nullable=True),            # Paystack bank code
        sa.Column("account_number", sa.String(20), nullable=False),
        sa.Column("account_name", sa.String(200), nullable=False),       # as returned by bank verify
        sa.Column("currency", sa.String(3), nullable=False, server_default="NGN"),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("paystack_recipient_code", sa.String(100), nullable=True),  # cached after first transfer
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_by", sa.UUID(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("NOW()"), nullable=False),
    )
    op.create_index("ix_eba_tenant_id", "employee_bank_accounts", ["tenant_id"])
    op.create_index("ix_eba_employee_id", "employee_bank_accounts", ["employee_id"])

    # ── expense_payments ──────────────────────────────────────────────────────
    op.create_table(
        "expense_payments",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", sa.UUID(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("expense_report_id", sa.UUID(), nullable=False),        # soft link (no FK, circular)
        sa.Column("employee_id", sa.UUID(), sa.ForeignKey("employees.id", ondelete="SET NULL"), nullable=True),
        sa.Column("bank_account_id", sa.UUID(), sa.ForeignKey("employee_bank_accounts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="NGN"),
        sa.Column("status", sa.String(20), nullable=False, server_default="QUEUED"),  # QUEUED | PROCESSING | PAID | FAILED | CANCELLED
        # Paystack-specific fields
        sa.Column("paystack_transfer_code", sa.String(100), nullable=True),
        sa.Column("paystack_reference", sa.String(100), nullable=True, unique=True),
        sa.Column("paystack_response", sa.Text(), nullable=True),        # raw JSON from webhook
        sa.Column("failure_reason", sa.Text(), nullable=True),
        # Manual payment fields
        sa.Column("payment_date", sa.Date(), nullable=True),
        sa.Column("payment_reference", sa.String(200), nullable=True),
        sa.Column("payment_notes", sa.Text(), nullable=True),
        # Audit
        sa.Column("initiated_by", sa.UUID(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("approved_by", sa.UUID(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("NOW()"), nullable=False),
    )
    op.create_index("ix_ep_tenant_id", "expense_payments", ["tenant_id"])
    op.create_index("ix_ep_expense_report_id", "expense_payments", ["expense_report_id"])
    op.create_index("ix_ep_status", "expense_payments", ["status"])


def downgrade() -> None:
    op.drop_table("expense_payments")
    op.drop_table("employee_bank_accounts")
    op.drop_table("expense_payment_configs")
