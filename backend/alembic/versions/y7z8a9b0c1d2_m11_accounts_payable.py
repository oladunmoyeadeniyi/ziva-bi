"""M11 — Accounts Payable: vendors, ap_invoices, ap_invoice_lines, ap_approvals, ap_invoice_snapshots

Revision ID: y7z8a9b0c1d2
Revises: x6y7z8a9b0c1
Create Date: 2026-07-25

Creates the five core tables for the Accounts Payable module:
  - vendors              : supplier master per tenant
  - ap_invoices          : AP invoice headers (bill lifecycle)
  - ap_invoice_lines     : line items with GL coding, VAT, WHT fields
  - ap_approvals         : per-step approval audit trail
  - ap_invoice_snapshots : immutable JSONB snapshot at submission

Three-mode support:
  - Lite        : workflow + CSV/Excel export
  - Connected   : + GL coding + posting_batches (posting_batch_id on header)
  - Full ERP    : + auto journal entries (journal_entry_id + payment_journal_entry_id)
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "y7z8a9b0c1d2"
down_revision = "x6y7z8a9b0c1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── vendors ──────────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS vendors (
            id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            code                VARCHAR(20) NOT NULL,
            name                VARCHAR(255) NOT NULL,
            vendor_type         VARCHAR(50) NOT NULL DEFAULT 'standard',
            tax_id              VARCHAR(50),
            email               VARCHAR(255),
            phone               VARCHAR(50),
            address             TEXT,
            bank_name           VARCHAR(100),
            bank_account_number VARCHAR(50),
            bank_sort_code      VARCHAR(20),
            is_active           BOOLEAN NOT NULL DEFAULT TRUE,
            notes               TEXT,
            created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_vendor_code_tenant UNIQUE (tenant_id, code)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_vendors_tenant_id ON vendors(tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_vendors_tenant_name ON vendors(tenant_id, name)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_vendors_tenant_active ON vendors(tenant_id, is_active)")

    # ── ap_invoices ───────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS ap_invoices (
            id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id                   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            vendor_id                   UUID NOT NULL REFERENCES vendors(id),
            reference                   VARCHAR(50) NOT NULL,
            invoice_number              VARCHAR(100) NOT NULL,
            invoice_date                DATE NOT NULL,
            received_date               DATE NOT NULL,
            due_date                    DATE,
            currency                    VARCHAR(3) NOT NULL DEFAULT 'NGN',
            exchange_rate               NUMERIC(18,6) NOT NULL DEFAULT 1,
            total_amount_foreign        NUMERIC(18,2) NOT NULL DEFAULT 0,
            total_amount_base           NUMERIC(18,2) NOT NULL DEFAULT 0,
            total_vat                   NUMERIC(18,2) NOT NULL DEFAULT 0,
            total_wht                   NUMERIC(18,2) NOT NULL DEFAULT 0,
            net_payable                 NUMERIC(18,2) NOT NULL DEFAULT 0,
            description                 TEXT,
            status                      VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
            posting_mode                VARCHAR(20),
            duplicate_flag              BOOLEAN NOT NULL DEFAULT FALSE,
            is_advance_settlement       BOOLEAN NOT NULL DEFAULT FALSE,
            -- submission
            submitted_at                TIMESTAMPTZ,
            submitted_by                UUID REFERENCES users(id) ON DELETE SET NULL,
            -- approval
            approved_at                 TIMESTAMPTZ,
            approved_by                 UUID REFERENCES users(id) ON DELETE SET NULL,
            -- rejection
            rejected_at                 TIMESTAMPTZ,
            rejected_by                 UUID REFERENCES users(id) ON DELETE SET NULL,
            rejection_reason            TEXT,
            -- cancellation
            cancelled_at                TIMESTAMPTZ,
            cancelled_by                UUID REFERENCES users(id) ON DELETE SET NULL,
            -- payment
            paid_at                     TIMESTAMPTZ,
            paid_by                     UUID REFERENCES users(id) ON DELETE SET NULL,
            payment_reference           VARCHAR(255),
            payment_bank_account_id     UUID REFERENCES bank_accounts(id) ON DELETE SET NULL,
            -- Full ERP GL links
            journal_entry_id            UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
            payment_journal_entry_id    UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
            -- Connected posting batch
            posting_batch_id            UUID REFERENCES posting_batches(id) ON DELETE SET NULL,
            -- audit
            created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
            created_by                  UUID REFERENCES users(id) ON DELETE SET NULL,
            updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_ap_invoice_number_vendor UNIQUE (tenant_id, vendor_id, invoice_number),
            CONSTRAINT chk_ap_status CHECK (status IN (
                'DRAFT','SUBMITTED','APPROVED','REJECTED','CANCELLED','PAID'
            ))
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_ap_invoices_tenant_status ON ap_invoices(tenant_id, status)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_ap_invoices_tenant_vendor ON ap_invoices(tenant_id, vendor_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_ap_invoices_due_date ON ap_invoices(tenant_id, due_date)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_ap_invoices_tenant_ref ON ap_invoices(tenant_id, reference)")

    # ── ap_invoice_lines ──────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS ap_invoice_lines (
            id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            invoice_id          UUID NOT NULL REFERENCES ap_invoices(id) ON DELETE CASCADE,
            line_number         INTEGER NOT NULL,
            description         TEXT NOT NULL,
            quantity            NUMERIC(18,4) NOT NULL DEFAULT 1,
            unit_price          NUMERIC(18,2) NOT NULL DEFAULT 0,
            amount_foreign      NUMERIC(18,2) NOT NULL DEFAULT 0,
            amount_base         NUMERIC(18,2) NOT NULL DEFAULT 0,
            -- GL coding (Connected + Full ERP)
            gl_account_id       UUID REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
            dimension_values    JSONB,
            -- tax fields
            vat_applicable      BOOLEAN NOT NULL DEFAULT FALSE,
            vat_rate            NUMERIC(6,4) NOT NULL DEFAULT 0,
            vat_amount          NUMERIC(18,2) NOT NULL DEFAULT 0,
            wht_applicable      BOOLEAN NOT NULL DEFAULT FALSE,
            wht_rate            NUMERIC(6,4) NOT NULL DEFAULT 0,
            wht_amount          NUMERIC(18,2) NOT NULL DEFAULT 0,
            net_payable_line    NUMERIC(18,2) NOT NULL DEFAULT 0,
            -- optional category hint for Lite mode reporting
            category_hint       VARCHAR(100)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_ap_invoice_lines_invoice ON ap_invoice_lines(invoice_id)")

    # ── ap_approvals ──────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS ap_approvals (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            invoice_id      UUID NOT NULL REFERENCES ap_invoices(id) ON DELETE CASCADE,
            tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            step_order      INTEGER NOT NULL,
            approver_id     UUID REFERENCES users(id) ON DELETE SET NULL,
            role_id         UUID REFERENCES approval_roles(id) ON DELETE SET NULL,
            status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
            is_advisory     BOOLEAN NOT NULL DEFAULT FALSE,
            action_at       TIMESTAMPTZ,
            comment         TEXT,
            CONSTRAINT chk_ap_approval_status CHECK (status IN (
                'PENDING','APPROVED','REJECTED','REFERRED_BACK','SKIPPED'
            ))
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_ap_approvals_invoice ON ap_approvals(invoice_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_ap_approvals_tenant ON ap_approvals(tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_ap_approvals_approver ON ap_approvals(approver_id, status)")

    # ── ap_invoice_snapshots ──────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS ap_invoice_snapshots (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            invoice_id      UUID NOT NULL REFERENCES ap_invoices(id) ON DELETE CASCADE,
            snapshot_data   JSONB NOT NULL,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_ap_snapshots_invoice ON ap_invoice_snapshots(invoice_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS ap_invoice_snapshots CASCADE")
    op.execute("DROP TABLE IF EXISTS ap_approvals CASCADE")
    op.execute("DROP TABLE IF EXISTS ap_invoice_lines CASCADE")
    op.execute("DROP TABLE IF EXISTS ap_invoices CASCADE")
    op.execute("DROP TABLE IF EXISTS vendors CASCADE")
