"""M11b — Purchase Orders, GRN, and 3-Way Match

Revision ID: z8a9b0c1d2e3
Revises: y7z8a9b0c1d2
Create Date: 2026-07-25

Creates eight tables for the Purchase Order / Goods Receipt / 3-Way Match module:
  purchase_orders        — PO header per tenant (DRAFT → SUBMITTED → APPROVED → SENT → RECEIVED → CLOSED)
  purchase_order_lines   — PO line items (qty, price, GL coding, VAT/WHT)
  po_approvals           — per-step PO approval audit trail
  po_snapshots           — immutable JSONB snapshot at submission
  goods_receipt_notes    — GRN header (DRAFT → CONFIRMED)
  grn_lines              — received quantities per PO line
  ap_invoice_po_matches  — junction table linking invoice lines ↔ GRN lines for 3-way match
  po_tolerance_config    — per-tenant price/qty tolerance thresholds

Also seeds the po_commitment posting role (GRNI / grni already exists from
catalogue-redesign migration c9d0e1f2g3h4).

Three-mode support:
  Lite      → workflow only (no GL)
  Connected → + GL coding on lines + posting_batches on PO approval / GRN confirmation
  Full ERP  → + journal entries (GRNI accrual on GRN, GRNI clearance on invoice match)
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "z8a9b0c1d2e3"
down_revision = "y7z8a9b0c1d2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── purchase_orders ───────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS purchase_orders (
            id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            vendor_id            UUID NOT NULL REFERENCES vendors(id),
            po_number            VARCHAR(50) NOT NULL,
            requester_id         UUID REFERENCES users(id) ON DELETE SET NULL,
            department_id        UUID REFERENCES org_structure(id) ON DELETE SET NULL,
            title                VARCHAR(255) NOT NULL,
            delivery_date        DATE,
            delivery_address     TEXT,
            currency             VARCHAR(3) NOT NULL DEFAULT 'NGN',
            exchange_rate        NUMERIC(18,6) NOT NULL DEFAULT 1,
            total_amount_foreign NUMERIC(18,2) NOT NULL DEFAULT 0,
            total_amount_base    NUMERIC(18,2) NOT NULL DEFAULT 0,
            amount_received      NUMERIC(18,2) NOT NULL DEFAULT 0,
            amount_invoiced      NUMERIC(18,2) NOT NULL DEFAULT 0,
            status               VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
            posting_mode         VARCHAR(20),
            notes                TEXT,
            -- submission
            submitted_at         TIMESTAMPTZ,
            submitted_by         UUID REFERENCES users(id) ON DELETE SET NULL,
            -- approval
            approved_at          TIMESTAMPTZ,
            approved_by          UUID REFERENCES users(id) ON DELETE SET NULL,
            -- rejection
            rejected_at          TIMESTAMPTZ,
            rejected_by          UUID REFERENCES users(id) ON DELETE SET NULL,
            rejection_reason     TEXT,
            -- sent to vendor
            sent_at              TIMESTAMPTZ,
            sent_by              UUID REFERENCES users(id) ON DELETE SET NULL,
            -- closed
            closed_at            TIMESTAMPTZ,
            closed_by            UUID REFERENCES users(id) ON DELETE SET NULL,
            -- cancelled
            cancelled_at         TIMESTAMPTZ,
            cancelled_by         UUID REFERENCES users(id) ON DELETE SET NULL,
            -- Full ERP commitment journal (optional)
            journal_entry_id     UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
            -- Connected mode posting batch
            posting_batch_id     UUID REFERENCES posting_batches(id) ON DELETE SET NULL,
            -- audit
            created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
            created_by           UUID REFERENCES users(id) ON DELETE SET NULL,
            updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_po_number_tenant UNIQUE (tenant_id, po_number),
            CONSTRAINT chk_po_status CHECK (status IN (
                'DRAFT','SUBMITTED','APPROVED','REJECTED','SENT',
                'PARTIALLY_RECEIVED','FULLY_RECEIVED','CLOSED','CANCELLED'
            ))
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_po_tenant_status    ON purchase_orders(tenant_id, status)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_po_tenant_vendor    ON purchase_orders(tenant_id, vendor_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_po_tenant_delivery  ON purchase_orders(tenant_id, delivery_date)")

    # ── purchase_order_lines ──────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS purchase_order_lines (
            id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            po_id             UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
            line_number       INTEGER NOT NULL,
            description       TEXT NOT NULL,
            unit_of_measure   VARCHAR(30) NOT NULL DEFAULT 'units',
            quantity_ordered  NUMERIC(18,4) NOT NULL DEFAULT 1,
            unit_price        NUMERIC(18,2) NOT NULL DEFAULT 0,
            amount_foreign    NUMERIC(18,2) NOT NULL DEFAULT 0,
            amount_base       NUMERIC(18,2) NOT NULL DEFAULT 0,
            quantity_received NUMERIC(18,4) NOT NULL DEFAULT 0,
            quantity_invoiced NUMERIC(18,4) NOT NULL DEFAULT 0,
            -- GL coding (Connected + Full ERP)
            gl_account_id     UUID REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
            dimension_values  JSONB,
            -- tax fields
            vat_applicable    BOOLEAN NOT NULL DEFAULT FALSE,
            vat_rate          NUMERIC(6,4) NOT NULL DEFAULT 0,
            wht_applicable    BOOLEAN NOT NULL DEFAULT FALSE,
            wht_rate          NUMERIC(6,4) NOT NULL DEFAULT 0,
            -- Lite mode reporting hint
            category_hint     VARCHAR(100)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_pol_po_id ON purchase_order_lines(po_id)")

    # ── po_approvals ──────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS po_approvals (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            po_id       UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
            tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            step_order  INTEGER NOT NULL,
            approver_id UUID REFERENCES users(id) ON DELETE SET NULL,
            role_id     UUID REFERENCES approval_roles(id) ON DELETE SET NULL,
            status      VARCHAR(20) NOT NULL DEFAULT 'PENDING',
            is_advisory BOOLEAN NOT NULL DEFAULT FALSE,
            action_at   TIMESTAMPTZ,
            comment     TEXT,
            CONSTRAINT chk_po_approval_status CHECK (status IN (
                'PENDING','APPROVED','REJECTED','REFERRED_BACK','SKIPPED'
            ))
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_poa_po_id    ON po_approvals(po_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_poa_tenant   ON po_approvals(tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_poa_approver ON po_approvals(approver_id, status)")

    # ── po_snapshots ──────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS po_snapshots (
            id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            po_id         UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
            snapshot_data JSONB NOT NULL,
            created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_pos_po_id ON po_snapshots(po_id)")

    # ── goods_receipt_notes ───────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS goods_receipt_notes (
            id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id              UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            po_id                  UUID NOT NULL REFERENCES purchase_orders(id),
            grn_number             VARCHAR(50) NOT NULL,
            received_by            UUID REFERENCES users(id) ON DELETE SET NULL,
            receipt_date           DATE NOT NULL,
            delivery_note_number   VARCHAR(100),
            notes                  TEXT,
            status                 VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
            confirmed_at           TIMESTAMPTZ,
            confirmed_by           UUID REFERENCES users(id) ON DELETE SET NULL,
            -- Full ERP GRNI accrual journal
            grni_journal_entry_id  UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
            -- Connected mode GRNI posting batch
            grni_posting_batch_id  UUID REFERENCES posting_batches(id) ON DELETE SET NULL,
            created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
            created_by             UUID REFERENCES users(id) ON DELETE SET NULL,
            CONSTRAINT uq_grn_number_tenant UNIQUE (tenant_id, grn_number),
            CONSTRAINT chk_grn_status CHECK (status IN ('DRAFT','CONFIRMED'))
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_grn_tenant_status ON goods_receipt_notes(tenant_id, status)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_grn_po_id         ON goods_receipt_notes(po_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_grn_receipt_date  ON goods_receipt_notes(tenant_id, receipt_date)")

    # ── grn_lines ─────────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS grn_lines (
            id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            grn_id            UUID NOT NULL REFERENCES goods_receipt_notes(id) ON DELETE CASCADE,
            po_line_id        UUID NOT NULL REFERENCES purchase_order_lines(id),
            line_number       INTEGER NOT NULL,
            description       TEXT NOT NULL,
            quantity_received NUMERIC(18,4) NOT NULL DEFAULT 0,
            unit_price_on_po  NUMERIC(18,2) NOT NULL DEFAULT 0,
            amount_base       NUMERIC(18,2) NOT NULL DEFAULT 0,
            condition_notes   TEXT
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_grnl_grn_id    ON grn_lines(grn_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_grnl_po_line   ON grn_lines(po_line_id)")

    # ── ap_invoice_po_matches ─────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS ap_invoice_po_matches (
            id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            invoice_id          UUID NOT NULL REFERENCES ap_invoices(id) ON DELETE CASCADE,
            invoice_line_id     UUID NOT NULL REFERENCES ap_invoice_lines(id) ON DELETE CASCADE,
            grn_id              UUID NOT NULL REFERENCES goods_receipt_notes(id),
            grn_line_id         UUID NOT NULL REFERENCES grn_lines(id),
            po_id               UUID NOT NULL REFERENCES purchase_orders(id),
            po_line_id          UUID NOT NULL REFERENCES purchase_order_lines(id),
            matched_quantity    NUMERIC(18,4) NOT NULL DEFAULT 0,
            matched_amount_base NUMERIC(18,2) NOT NULL DEFAULT 0,
            price_variance      NUMERIC(18,2) NOT NULL DEFAULT 0,
            price_variance_pct  NUMERIC(6,4)  NOT NULL DEFAULT 0,
            qty_variance        NUMERIC(18,4) NOT NULL DEFAULT 0,
            match_status        VARCHAR(30) NOT NULL DEFAULT 'MATCHED',
            override_comment    TEXT,
            created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
            created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
            CONSTRAINT chk_match_status CHECK (match_status IN (
                'MATCHED','PRICE_VARIANCE','QTY_VARIANCE',
                'OVER_INVOICED','UNDER_INVOICED','MANUAL_OVERRIDE'
            ))
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_match_invoice    ON ap_invoice_po_matches(invoice_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_match_tenant     ON ap_invoice_po_matches(tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_match_grn        ON ap_invoice_po_matches(grn_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_match_po         ON ap_invoice_po_matches(po_id)")

    # ── po_tolerance_config ───────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS po_tolerance_config (
            id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id                  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            price_tolerance_pct        NUMERIC(6,4) NOT NULL DEFAULT 0.02,
            qty_tolerance_pct          NUMERIC(6,4) NOT NULL DEFAULT 0.05,
            auto_approve_within_tolerance  BOOLEAN NOT NULL DEFAULT FALSE,
            block_payment_on_variance  BOOLEAN NOT NULL DEFAULT TRUE,
            updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_by                 UUID REFERENCES users(id) ON DELETE SET NULL,
            CONSTRAINT uq_po_tolerance_tenant UNIQUE (tenant_id)
        )
    """)

    # ── Seed po_commitment posting role ──────────────────────────────────────
    # grni (role_key="grni") already seeded in c9d0e1f2g3h4_catalogue_redesign.
    # po_commitment is new — off-balance-sheet memo role for PO commitment accounting.
    op.execute("""
        INSERT INTO posting_roles (
            role_key, label, statement, "group", subgroup,
            display_order, expected_account_type, is_control_account, description
        )
        VALUES (
            'po_commitment',
            'PO Commitment (memo)',
            'BS',
            'memo',
            'commitments',
            999,
            'BS',
            FALSE,
            'Off-balance-sheet memo account for purchase order commitments. '
            'Used only when commitment accounting is enabled in tenant config.'
        )
        ON CONFLICT (role_key) DO NOTHING
    """)


def downgrade() -> None:
    # Remove seed
    op.execute("DELETE FROM posting_roles WHERE role_key = 'po_commitment'")

    op.execute("DROP TABLE IF EXISTS po_tolerance_config CASCADE")
    op.execute("DROP TABLE IF EXISTS ap_invoice_po_matches CASCADE")
    op.execute("DROP TABLE IF EXISTS grn_lines CASCADE")
    op.execute("DROP TABLE IF EXISTS goods_receipt_notes CASCADE")
    op.execute("DROP TABLE IF EXISTS po_snapshots CASCADE")
    op.execute("DROP TABLE IF EXISTS po_approvals CASCADE")
    op.execute("DROP TABLE IF EXISTS purchase_order_lines CASCADE")
    op.execute("DROP TABLE IF EXISTS purchase_orders CASCADE")
