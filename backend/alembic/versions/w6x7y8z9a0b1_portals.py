"""Vendor Portal + Customer Portal schema additions.

Adds portal access infrastructure to existing vendor and customer tables,
plus a shared `portal_sessions` table for issued portal JWTs.

Changes:
  ALTER vendors       — add portal_enabled, portal_token columns
  ALTER customers     — add portal_enabled, portal_token columns
  CREATE portal_sessions — short-lived vendor/customer portal auth sessions
  CREATE vendor_invoice_submissions — vendor-submitted invoices awaiting review
  CREATE customer_portal_payments   — customer payment requests submitted via portal

Revision ID: w6x7y8z9a0b1
Revises: v5w6x7y8z9a0
Create Date: 2026-08-05
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "w6x7y8z9a0b1"
down_revision = "v5w6x7y8z9a0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Vendor portal columns ──────────────────────────────────────────────────
    op.add_column("vendors", sa.Column(
        "portal_enabled", sa.Boolean(), nullable=False,
        server_default="false",
        comment="True = vendor has access to the self-service portal.",
    ))
    op.add_column("vendors", sa.Column(
        "portal_token", sa.String(100), nullable=True,
        comment=(
            "Long random token embedded in the vendor portal link. "
            "Regenerating this token invalidates any previously shared link."
        ),
    ))

    # ── Customer portal columns (mirrors vendor) ───────────────────────────────
    # Customers table was created in M14. Same pattern.
    op.add_column("customers", sa.Column(
        "portal_enabled", sa.Boolean(), nullable=False,
        server_default="false",
    ))
    op.add_column("customers", sa.Column(
        "portal_token", sa.String(100), nullable=True,
    ))

    # ── Vendor-submitted invoices ──────────────────────────────────────────────
    # Vendors can submit their own invoices via the portal; finance team
    # reviews and converts to an ApInvoice once approved.
    op.create_table(
        "vendor_invoice_submissions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("vendor_id", UUID(as_uuid=True), sa.ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("invoice_number", sa.String(100), nullable=False),
        sa.Column("invoice_date", sa.Date(), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("currency_code", sa.String(3), nullable=False, server_default="NGN"),
        sa.Column("total_amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="PENDING",
                  comment="PENDING | REVIEWED | CONVERTED | REJECTED"),
        sa.Column("reviewed_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reviewed_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("converted_ap_invoice_id", UUID(as_uuid=True), sa.ForeignKey("ap_invoices.id", ondelete="SET NULL"), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("submitted_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    # ── Customer payment requests ──────────────────────────────────────────────
    # Customers can submit payment remittance / dispute notes via portal.
    op.create_table(
        "customer_portal_messages",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("customer_id", UUID(as_uuid=True), sa.ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("ar_invoice_id", UUID(as_uuid=True), sa.ForeignKey("ar_invoices.id", ondelete="SET NULL"), nullable=True),
        sa.Column("message_type", sa.String(30), nullable=False,
                  comment="PAYMENT_NOTICE | DISPUTE | QUERY | REMITTANCE"),
        sa.Column("subject", sa.String(200), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("amount", sa.Numeric(18, 2), nullable=True,
                  comment="Amount quoted (e.g. remittance amount)"),
        sa.Column("status", sa.String(20), nullable=False, server_default="OPEN",
                  comment="OPEN | RESOLVED | CLOSED"),
        sa.Column("resolved_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("resolved_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("customer_portal_messages")
    op.drop_table("vendor_invoice_submissions")
    op.drop_column("customers", "portal_token")
    op.drop_column("customers", "portal_enabled")
    op.drop_column("vendors", "portal_token")
    op.drop_column("vendors", "portal_enabled")
