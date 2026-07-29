"""m19_tax_engine_transaction

Revision ID: g5h6i7j8k9l0
Revises: f4g5h6i7j8k9
Create Date: 2026-07-28 13:00:00.000000

M19 — Tax Engine (transaction level).

Extends the existing tenant_tax_config (JSONB rate tables from M8.4) with
transaction-level tax tracking:

  tax_returns       — period-level VAT/WHT/PAYE return filings
  wht_certificates  — WHT certificate records (issued when WHT is deducted)

Tax computation (filling vat_amount / wht_amount on AP/AR lines) is done by
the tax_compute_service and called at invoice creation/update — no new columns
needed since AP and AR models already have these fields.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "g5h6i7j8k9l0"
down_revision = "f4g5h6i7j8k9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── tax_returns ───────────────────────────────────────────────────────
    op.create_table(
        "tax_returns",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tax_type", sa.String(20), nullable=False),    # VAT | WHT | PAYE | LEVY
        sa.Column("period_start", sa.Date, nullable=False),
        sa.Column("period_end", sa.Date, nullable=False),
        sa.Column("filing_deadline", sa.Date, nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="DRAFT"),  # DRAFT|FILED|ACCEPTED|REJECTED
        sa.Column("total_tax_collected", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("total_tax_paid", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("net_payable", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("filing_reference", sa.String(100), nullable=True),
        sa.Column("filed_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("filed_by_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("payment_reference", sa.String(100), nullable=True),
        sa.Column("payment_date", sa.Date, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("line_detail", JSONB, nullable=True),   # aggregated breakdown of transactions
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("tax_type IN ('VAT','WHT','PAYE','LEVY')", name="ck_tax_return_type"),
        sa.CheckConstraint("status IN ('DRAFT','FILED','ACCEPTED','REJECTED')", name="ck_tax_return_status"),
    )
    op.create_index("ix_tax_returns_tenant_id", "tax_returns", ["tenant_id"])
    op.create_index("ix_tax_returns_tax_type", "tax_returns", ["tenant_id", "tax_type"])
    op.create_index("ix_tax_returns_period", "tax_returns", ["tenant_id", "period_start", "period_end"])

    # ── wht_certificates ──────────────────────────────────────────────────
    op.create_table(
        "wht_certificates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("certificate_number", sa.String(50), nullable=False),
        sa.Column("certificate_type", sa.String(10), nullable=False, server_default="VENDOR"),  # VENDOR | CUSTOMER
        sa.Column("vendor_id", UUID(as_uuid=True), sa.ForeignKey("vendors.id", ondelete="SET NULL"), nullable=True),
        sa.Column("customer_id", UUID(as_uuid=True), sa.ForeignKey("customers.id", ondelete="SET NULL"), nullable=True),
        sa.Column("ap_invoice_id", UUID(as_uuid=True), sa.ForeignKey("ap_invoices.id", ondelete="SET NULL"), nullable=True),
        sa.Column("ar_invoice_id", UUID(as_uuid=True), sa.ForeignKey("ar_invoices.id", ondelete="SET NULL"), nullable=True),
        sa.Column("gross_amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("wht_rate", sa.Numeric(5, 4), nullable=False),
        sa.Column("wht_amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("transaction_date", sa.Date, nullable=False),
        sa.Column("issue_date", sa.Date, nullable=False),
        sa.Column("tax_return_id", UUID(as_uuid=True), sa.ForeignKey("tax_returns.id", ondelete="SET NULL"), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_by_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("tenant_id", "certificate_number", name="uq_wht_cert_number"),
    )
    op.create_index("ix_wht_certificates_tenant_id", "wht_certificates", ["tenant_id"])
    op.create_index("ix_wht_certificates_vendor_id", "wht_certificates", ["vendor_id"])
    op.create_index("ix_wht_certificates_customer_id", "wht_certificates", ["customer_id"])


def downgrade() -> None:
    op.drop_table("wht_certificates")
    op.drop_table("tax_returns")
