"""Asset Issuance & Tracking — asset_issuances + asset_maintenance_costs tables.

Revision: x7y8z9a0b1c2
Down-revision: w6x7y8z9a0b1

Why this exists:
  The existing `assets` table (M18) covers the asset register (value, depreciation, GL).
  This migration adds two new tracking tables:

  asset_issuances
    Tracks who an asset is currently issued to and the full issuance history.
    An asset can be issued to a *staff member* (via employee_id) OR to a *location* (free-text).
    One asset can have many issuance records over its lifetime — each issuance row covers
    one period (issue_date .. returned_at) or is open-ended while still with the assignee.
    Status: ACTIVE | RETURNED | TRANSFERRED
    Supports IT assets (laptops, phones → staff) and POSM/field assets (coolers → outlets).

  asset_maintenance_costs
    Records maintenance or repair spend for an asset.
    Used to track total cost of ownership (TCO) per asset beyond depreciation.
    Links to the GL via a journal_entry_id if the cost was posted.

No model changes to `assets` — the two new tables FK to assets.id.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "x7y8z9a0b1c2"
down_revision = "w6x7y8z9a0b1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── asset_issuances ────────────────────────────────────────────────────────
    op.create_table(
        "asset_issuances",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", sa.UUID(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("asset_id", sa.UUID(), sa.ForeignKey("assets.id", ondelete="CASCADE"), nullable=False),

        # Assignee — one of these two is set (both can be null for unassigned)
        sa.Column("employee_id", sa.UUID(), sa.ForeignKey("employees.id", ondelete="SET NULL"), nullable=True),
        sa.Column("location_name", sa.String(200), nullable=True),  # e.g. "Ikeja outlet", "Lagos warehouse"

        # Dates
        sa.Column("issue_date", sa.Date(), nullable=False),
        sa.Column("expected_return_date", sa.Date(), nullable=True),
        sa.Column("returned_at", sa.Date(), nullable=True),

        # Status
        sa.Column("status", sa.String(20), nullable=False, server_default="ACTIVE"),
        # ACTIVE — currently with assignee
        # RETURNED — asset returned to store
        # TRANSFERRED — re-issued to another person (closed by new issuance)

        # Notes
        sa.Column("condition_at_issue", sa.String(50), nullable=True),   # GOOD / FAIR / POOR
        sa.Column("condition_at_return", sa.String(50), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("issued_by", sa.UUID(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("returned_by", sa.UUID(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),

        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_asset_issuances_tenant_id", "asset_issuances", ["tenant_id"])
    op.create_index("ix_asset_issuances_asset_id", "asset_issuances", ["asset_id"])
    op.create_index("ix_asset_issuances_employee_id", "asset_issuances", ["employee_id"])
    op.create_index("ix_asset_issuances_status", "asset_issuances", ["status"])

    # ── asset_maintenance_costs ────────────────────────────────────────────────
    op.create_table(
        "asset_maintenance_costs",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", sa.UUID(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("asset_id", sa.UUID(), sa.ForeignKey("assets.id", ondelete="CASCADE"), nullable=False),

        # Cost details
        sa.Column("maintenance_date", sa.Date(), nullable=False),
        sa.Column("description", sa.String(500), nullable=False),
        sa.Column("cost", sa.Numeric(18, 2), nullable=False),
        sa.Column("currency_code", sa.String(3), nullable=False, server_default="NGN"),
        sa.Column("maintenance_type", sa.String(50), nullable=True),
        # e.g. REPAIR / PREVENTIVE / INSPECTION / UPGRADE / OTHER

        # GL link (optional — Full ERP mode)
        sa.Column("journal_entry_id", sa.UUID(), sa.ForeignKey("journal_entries.id", ondelete="SET NULL"), nullable=True),
        sa.Column("gl_account_id", sa.UUID(), sa.ForeignKey("chart_of_accounts.id", ondelete="SET NULL"), nullable=True),

        # Vendor / contractor
        sa.Column("vendor_name", sa.String(200), nullable=True),
        sa.Column("reference", sa.String(100), nullable=True),  # invoice or work order ref

        sa.Column("recorded_by", sa.UUID(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_asset_maintenance_tenant_id", "asset_maintenance_costs", ["tenant_id"])
    op.create_index("ix_asset_maintenance_asset_id", "asset_maintenance_costs", ["asset_id"])
    op.create_index("ix_asset_maintenance_date", "asset_maintenance_costs", ["maintenance_date"])


def downgrade() -> None:
    op.drop_table("asset_maintenance_costs")
    op.drop_table("asset_issuances")
