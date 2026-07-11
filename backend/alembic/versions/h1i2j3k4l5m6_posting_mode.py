"""Add posting_mode to tenant_org_config.

Revision ID: h1i2j3k4l5m6
Revises: g1h2i3j4k5l6
Create Date: 2026-07-11

Why this exists:
    Three-Mode Architecture decision (2026-07-11, docs/BRIEF_three_mode_architecture.md).
    Every tenant operates in one of three GL posting modes:
        'lite'      — workflow only, no GL coding required, no posting
        'connected' — GL coding in Ziva BI, posts exported to an external ERP
        'full_erp'  — GL coding in Ziva BI, posts to internal journal_entries

    The column lives on tenant_org_config (one row per tenant) and is set by
    a Ziva BI consultant in the SA portal before implementation begins.
    Tenant-facing pages never expose this setting.

    DEFAULT 'full_erp' means all existing tenants continue working exactly as
    before — no data migration, no behaviour change.
"""

from alembic import op
import sqlalchemy as sa

# Alembic revision identifiers
revision = "h1i2j3k4l5m6"
down_revision = "g1h2i3j4k5l6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add posting_mode VARCHAR(20) NOT NULL DEFAULT 'full_erp' to tenant_org_config.

    A CHECK constraint enforces the three valid values. Existing rows get 'full_erp'
    automatically from the server default — zero application downtime.
    """
    op.add_column(
        "tenant_org_config",
        sa.Column(
            "posting_mode",
            sa.String(20),
            nullable=False,
            server_default="full_erp",
        ),
    )
    op.create_check_constraint(
        "ck_tenant_org_config_posting_mode",
        "tenant_org_config",
        "posting_mode IN ('lite', 'connected', 'full_erp')",
    )


def downgrade() -> None:
    """Remove posting_mode column (drops the check constraint first)."""
    op.drop_constraint(
        "ck_tenant_org_config_posting_mode",
        "tenant_org_config",
        type_="check",
    )
    op.drop_column("tenant_org_config", "posting_mode")
