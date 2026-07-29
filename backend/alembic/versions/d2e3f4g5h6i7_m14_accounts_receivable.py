"""M14: Accounts Receivable — customers, ar_invoices, ar_invoice_lines, ar_approvals, ar_invoice_snapshots.

Revision ID: d2e3f4g5h6i7
Revises: c1d2e3f4g5h6
Create Date: 2026-07-28

Why this migration exists:
    M14 adds the Accounts Receivable (O2C) module. This mirrors M11's AP structure on
    the revenue side: a customer master, customer invoices, line-item GL coding, a per-step
    approval trail, and an immutable submission snapshot.

    Three-mode behaviour (snapshotted onto each invoice at submission):
      Lite      — workflow only; no GL coding. CSV / Excel export of approved invoices.
      Connected — GL coding per line + posting_batches entry on final approval.
      Full ERP  — journal_entries on approval (DR AR control / CR revenue) and on
                  receipt (DR bank / CR AR control).

    The accounts_receivable posting role is already in the catalogue
    (migration c9d0e1f2g3h4). No new posting role is needed.

Tables created:
    customers              — customer master per tenant
    ar_invoices            — AR invoice headers
    ar_invoice_lines       — line items (GL, dimensions, VAT, WHT)
    ar_approvals           — per-step approval audit trail
    ar_invoice_snapshots   — immutable JSONB snapshot at submission
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "d2e3f4g5h6i7"
down_revision: str = "c1d2e3f4g5h6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── customers ──────────────────────────────────────────────────────────────
    op.create_table(
        "customers",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", UUID(as_uuid=True),
                  sa.ForeignKey("tenants.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("code", sa.String(20), nullable=False,
                  comment="Auto-generated C-{NNNN} if not supplied"),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("customer_type", sa.String(50), nullable=False,
                  server_default="standard",
                  comment="standard | government | ngo | corporate | individual | non_resident"),
        sa.Column("tax_id", sa.String(50), nullable=True,
                  comment="RC number / TIN / tax registration"),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("address", sa.Text, nullable=True),
        # payment / banking
        sa.Column("credit_limit", sa.Numeric(18, 2), nullable=True,
                  comment="Maximum outstanding AR balance allowed"),
        sa.Column("credit_terms", sa.String(30), nullable=True,
                  comment="net_30 | net_60 | net_90 | immediate | custom"),
        sa.Column("credit_terms_days", sa.Integer, nullable=True,
                  comment="Populated when credit_terms='custom'"),
        # lifecycle
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("tenant_id", "code", name="uq_customer_code_tenant"),
    )

    # ── ar_invoices ────────────────────────────────────────────────────────────
    op.create_table(
        "ar_invoices",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", UUID(as_uuid=True),
                  sa.ForeignKey("tenants.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("customer_id", UUID(as_uuid=True),
                  sa.ForeignKey("customers.id"),
                  nullable=False, index=True),

        # identity
        sa.Column("reference", sa.String(50), nullable=False,
                  comment="Internal AR ref e.g. AR-2026-0001"),
        sa.Column("invoice_number", sa.String(100), nullable=False,
                  comment="Customer-facing invoice number (may equal reference)"),
        sa.Column("invoice_date", sa.Date, nullable=False),
        sa.Column("due_date", sa.Date, nullable=True,
                  comment="Derived from credit_terms at creation; editable"),
        sa.Column("service_period_start", sa.Date, nullable=True),
        sa.Column("service_period_end", sa.Date, nullable=True),

        # amounts
        sa.Column("currency", sa.String(3), nullable=False, server_default="NGN"),
        sa.Column("exchange_rate", sa.Numeric(18, 6), nullable=False, server_default="1"),
        sa.Column("total_amount_foreign", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("total_amount_base", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("total_vat", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("total_wht", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("net_receivable", sa.Numeric(18, 2), nullable=False, server_default="0",
                  comment="total_amount_base + total_vat - total_wht"),

        # metadata
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="DRAFT"),
        sa.Column("posting_mode", sa.String(20), nullable=True,
                  comment="Snapshot of tenant posting_mode at submission"),
        sa.Column("duplicate_flag", sa.Boolean, nullable=False, server_default="false"),

        # submission
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("submitted_by", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),

        # approval
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("approved_by", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),

        # rejection
        sa.Column("rejected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rejected_by", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("rejection_reason", sa.Text, nullable=True),

        # cancellation
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_by", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),

        # receipt (customer payment received)
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("received_by", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("receipt_reference", sa.String(255), nullable=True),
        sa.Column("receipt_bank_account_id", UUID(as_uuid=True),
                  sa.ForeignKey("bank_accounts.id", ondelete="SET NULL"), nullable=True),

        # Full ERP GL links
        sa.Column("journal_entry_id", UUID(as_uuid=True),
                  sa.ForeignKey("journal_entries.id", ondelete="SET NULL"), nullable=True),
        sa.Column("receipt_journal_entry_id", UUID(as_uuid=True),
                  sa.ForeignKey("journal_entries.id", ondelete="SET NULL"), nullable=True),

        # Connected posting batch
        sa.Column("posting_batch_id", UUID(as_uuid=True),
                  sa.ForeignKey("posting_batches.id", ondelete="SET NULL"), nullable=True),

        # audit
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),

        sa.UniqueConstraint("tenant_id", "reference", name="uq_ar_invoice_reference"),
        sa.CheckConstraint(
            "status IN ('DRAFT','SUBMITTED','APPROVED','REJECTED','CANCELLED','RECEIVED')",
            name="chk_ar_status",
        ),
    )

    # ── ar_invoice_lines ───────────────────────────────────────────────────────
    op.create_table(
        "ar_invoice_lines",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("invoice_id", UUID(as_uuid=True),
                  sa.ForeignKey("ar_invoices.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("line_number", sa.Integer, nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("quantity", sa.Numeric(18, 4), nullable=False, server_default="1"),
        sa.Column("unit_price", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("amount_foreign", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("amount_base", sa.Numeric(18, 2), nullable=False, server_default="0"),

        # GL coding (Connected + Full ERP)
        sa.Column("gl_account_id", UUID(as_uuid=True),
                  sa.ForeignKey("chart_of_accounts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("dimension_values", JSONB, nullable=True),

        # VAT
        sa.Column("vat_applicable", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("vat_rate", sa.Numeric(6, 4), nullable=False, server_default="0"),
        sa.Column("vat_amount", sa.Numeric(18, 2), nullable=False, server_default="0"),

        # WHT (customer withholding on service fees)
        sa.Column("wht_applicable", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("wht_rate", sa.Numeric(6, 4), nullable=False, server_default="0"),
        sa.Column("wht_amount", sa.Numeric(18, 2), nullable=False, server_default="0"),

        # net receivable for this line
        sa.Column("net_receivable_line", sa.Numeric(18, 2), nullable=False, server_default="0",
                  comment="amount_base + vat_amount - wht_amount"),

        sa.Column("category_hint", sa.String(100), nullable=True),
    )

    # ── ar_approvals ───────────────────────────────────────────────────────────
    op.create_table(
        "ar_approvals",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("invoice_id", UUID(as_uuid=True),
                  sa.ForeignKey("ar_invoices.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("tenant_id", UUID(as_uuid=True),
                  sa.ForeignKey("tenants.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("step_order", sa.Integer, nullable=False),
        sa.Column("approver_id", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("role_id", UUID(as_uuid=True),
                  sa.ForeignKey("approval_roles.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="PENDING"),
        sa.Column("is_advisory", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("action_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("comment", sa.Text, nullable=True),
        sa.CheckConstraint(
            "status IN ('PENDING','APPROVED','REJECTED','REFERRED_BACK','SKIPPED')",
            name="chk_ar_approval_status",
        ),
    )

    # ── ar_invoice_snapshots ───────────────────────────────────────────────────
    op.create_table(
        "ar_invoice_snapshots",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("invoice_id", UUID(as_uuid=True),
                  sa.ForeignKey("ar_invoices.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("snapshot_data", JSONB, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("ar_invoice_snapshots")
    op.drop_table("ar_approvals")
    op.drop_table("ar_invoice_lines")
    op.drop_table("ar_invoices")
    op.drop_table("customers")
