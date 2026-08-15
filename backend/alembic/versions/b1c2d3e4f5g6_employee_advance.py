"""Employee Advance & Retirement module.

Revision: b1c2d3e4f5g6
Down-revision: a0b1c2d3e4f5

Why this exists:
  Employees frequently need cash in advance of business travel or operational
  spend. Without a formal advance system, tracking is done via WhatsApp and
  spreadsheets, leading to un-retired advances, lost receipts, and audit risk.

  This migration introduces three tables:

  employee_advances         — the advance request lifecycle (DRAFT → ISSUED → RETIRED)
  advance_retirements       — the retirement submission (employee accounts for spend)
  advance_retirement_lines  — individual line items within a retirement

  GL treatment (Full ERP mode):
    Advance issuance : DR Employee Advance (asset) / CR Cash/Bank
    Retirement       : DR Expense GL(s)           / CR Employee Advance
    Overspend        : DR Expense GL              / CR Employee Payable  (co. owes employee)
    Underspend       : DR Employee Payable         / CR Employee Advance  (employee owes co.)

Migration chain: ... → a0b1c2d3e4f5 → b1c2d3e4f5g6
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid


revision = "b1c2d3e4f5g6"
down_revision = "a0b1c2d3e4f5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. employee_advances ──────────────────────────────────────────────────
    op.create_table(
        "employee_advances",
        sa.Column("id",            UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("tenant_id",     UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("employee_id",   UUID(as_uuid=True), sa.ForeignKey("users.id",   ondelete="CASCADE"), nullable=False),

        # Human-readable reference number auto-assigned by the router
        sa.Column("advance_number", sa.String(50), nullable=False),

        # Advance type: TRAVEL | OPERATIONAL | OTHER
        sa.Column("advance_type",  sa.String(30), nullable=False, server_default="TRAVEL"),
        sa.Column("purpose",       sa.Text(),     nullable=False),

        # Financials
        sa.Column("amount",    sa.Numeric(18, 2), nullable=False),
        sa.Column("currency",  sa.String(3),      nullable=False, server_default="NGN"),

        # Status: DRAFT → SUBMITTED → APPROVED → ISSUED → PARTIALLY_RETIRED → FULLY_RETIRED
        #         DRAFT → SUBMITTED → REJECTED
        #         DRAFT/SUBMITTED → CANCELLED
        sa.Column("status", sa.String(30), nullable=False, server_default="DRAFT"),

        # Dates
        sa.Column("request_date",          sa.Date(),                  nullable=False),
        sa.Column("required_by_date",      sa.Date(),                  nullable=True),
        sa.Column("due_retirement_date",   sa.Date(),                  nullable=True),

        # Approval state (mirrors expense_reports pattern)
        sa.Column("current_approval_level", sa.Integer(), nullable=True),
        sa.Column("rejection_comment",      sa.Text(),    nullable=True),
        sa.Column("rejected_at_level",      sa.Integer(), nullable=True),

        # GL accounts (Full ERP mode)
        sa.Column("gl_advance_account_id", UUID(as_uuid=True), sa.ForeignKey("chart_of_accounts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("gl_cash_account_id",    UUID(as_uuid=True), sa.ForeignKey("chart_of_accounts.id", ondelete="SET NULL"), nullable=True),

        # Issuance tracking
        sa.Column("issued_by",   UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("issued_at",   sa.DateTime(timezone=True), nullable=True),

        # Retirement summary (updated as retirements are approved)
        sa.Column("total_retired", sa.Numeric(18, 2), nullable=False, server_default="0"),

        # Audit
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("approved_at",  sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes",        sa.Text(),                  nullable=True),
        sa.Column("created_at",   sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at",   sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_employee_advances_tenant_id",   "employee_advances", ["tenant_id"])
    op.create_index("ix_employee_advances_employee_id", "employee_advances", ["employee_id"])
    op.create_index("ix_employee_advances_status",      "employee_advances", ["status"])
    op.create_index("ix_employee_advances_number",      "employee_advances", ["advance_number"])

    # ── 2. advance_retirements ────────────────────────────────────────────────
    op.create_table(
        "advance_retirements",
        sa.Column("id",          UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("tenant_id",   UUID(as_uuid=True), sa.ForeignKey("tenants.id",         ondelete="CASCADE"), nullable=False),
        sa.Column("advance_id",  UUID(as_uuid=True), sa.ForeignKey("employee_advances.id", ondelete="CASCADE"), nullable=False),
        sa.Column("employee_id", UUID(as_uuid=True), sa.ForeignKey("users.id",            ondelete="CASCADE"), nullable=False),

        sa.Column("retirement_number", sa.String(50), nullable=False),
        sa.Column("retirement_date",   sa.Date(),     nullable=False),

        # Financials — set by router when lines are added
        sa.Column("advance_amount", sa.Numeric(18, 2), nullable=False),  # snapshot of advance.amount
        sa.Column("total_claimed",  sa.Numeric(18, 2), nullable=False, server_default="0"),
        # balance = total_claimed - advance_amount
        # positive  → employee over-spent (company reimburses the difference)
        # negative  → employee under-spent (employee refunds the difference)
        sa.Column("balance",        sa.Numeric(18, 2), nullable=False, server_default="0"),

        # Status: DRAFT → SUBMITTED → APPROVED → POSTED | REJECTED
        sa.Column("status", sa.String(30), nullable=False, server_default="DRAFT"),
        sa.Column("current_approval_level", sa.Integer(), nullable=True),
        sa.Column("rejection_comment",      sa.Text(),    nullable=True),
        sa.Column("rejected_at_level",      sa.Integer(), nullable=True),

        # GL posting (Full ERP mode)
        sa.Column("journal_entry_id",  UUID(as_uuid=True), nullable=True),  # loose FK — avoids circular import
        sa.Column("posting_batch_id",  UUID(as_uuid=True), nullable=True),  # Connected mode

        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("approved_at",  sa.DateTime(timezone=True), nullable=True),
        sa.Column("posted_at",    sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes",        sa.Text(),                  nullable=True),
        sa.Column("created_at",   sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at",   sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_advance_retirements_tenant_id",  "advance_retirements", ["tenant_id"])
    op.create_index("ix_advance_retirements_advance_id", "advance_retirements", ["advance_id"])
    op.create_index("ix_advance_retirements_employee",   "advance_retirements", ["employee_id"])
    op.create_index("ix_advance_retirements_status",     "advance_retirements", ["status"])

    # ── 3. advance_retirement_lines ───────────────────────────────────────────
    op.create_table(
        "advance_retirement_lines",
        sa.Column("id",            UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("tenant_id",     UUID(as_uuid=True), sa.ForeignKey("tenants.id",            ondelete="CASCADE"), nullable=False),
        sa.Column("retirement_id", UUID(as_uuid=True), sa.ForeignKey("advance_retirements.id", ondelete="CASCADE"), nullable=False),
        sa.Column("advance_id",    UUID(as_uuid=True), sa.ForeignKey("employee_advances.id",   ondelete="CASCADE"), nullable=False),

        sa.Column("description",   sa.String(500), nullable=False),
        sa.Column("amount",        sa.Numeric(18, 2), nullable=False),
        sa.Column("currency",      sa.String(3),      nullable=False, server_default="NGN"),
        sa.Column("receipt_date",  sa.Date(),         nullable=True),

        # GL coding (optional, Full ERP)
        sa.Column("gl_id",            UUID(as_uuid=True), sa.ForeignKey("chart_of_accounts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("dimension_values", JSONB,              nullable=True),

        # Category (mirrors expense_lines pattern)
        sa.Column("category_id",    UUID(as_uuid=True), nullable=True),
        sa.Column("subcategory_id", UUID(as_uuid=True), nullable=True),

        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_arl_tenant_id",     "advance_retirement_lines", ["tenant_id"])
    op.create_index("ix_arl_retirement_id", "advance_retirement_lines", ["retirement_id"])


def downgrade() -> None:
    op.drop_table("advance_retirement_lines")
    op.drop_table("advance_retirements")
    op.drop_table("employee_advances")
