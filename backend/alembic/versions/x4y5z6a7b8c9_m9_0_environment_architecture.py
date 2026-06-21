"""M9.0 — Environment architecture (shadow-tenant model)

Revision ID: x4y5z6a7b8c9
Revises: w3x4y5z6a7b8
Create Date: 2026-06-18

Additive, fully reversible migration. Adds four columns to the tenants table:

  environment              — "live" | "test". All existing tenants get "live".
  parent_tenant_id         — FK → tenants.id (nullable). Set on test shadows;
                             null for live tenants. Index added for lookup speed.
  lifecycle_status         — "trial" | "in_implementation" | "live" | "suspended".
                             Existing tenants get "in_implementation" (mid-build).
  test_data_retention_days — int (nullable). Days to retain test transactional
                             data before scheduled purge. Null = system default 90.

No data tables are touched. Config/transactional tables remain unchanged.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "x4y5z6a7b8c9"
down_revision = "w3x4y5z6a7b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Add columns to tenants ────────────────────────────────────────────────
    op.add_column(
        "tenants",
        sa.Column("environment", sa.String(20), nullable=False, server_default="live"),
    )
    op.add_column(
        "tenants",
        sa.Column(
            "parent_tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "tenants",
        sa.Column(
            "lifecycle_status",
            sa.String(50),
            nullable=False,
            server_default="in_implementation",
        ),
    )
    op.add_column(
        "tenants",
        sa.Column("test_data_retention_days", sa.Integer(), nullable=True),
    )

    # ── Set existing tenants to sensible defaults ─────────────────────────────
    # environment = "live"  — all pre-M9.0 tenants are live tenants.
    # lifecycle_status = "in_implementation" — all existing tenants are mid-build.
    op.execute(
        "UPDATE tenants SET environment = 'live', lifecycle_status = 'in_implementation' "
        "WHERE environment IS NULL OR lifecycle_status IS NULL"
    )

    # ── Index on parent_tenant_id for fast shadow lookup ──────────────────────
    op.create_index(
        "ix_tenants_parent_tenant_id",
        "tenants",
        ["parent_tenant_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_tenants_parent_tenant_id", table_name="tenants")
    op.drop_column("tenants", "test_data_retention_days")
    op.drop_column("tenants", "lifecycle_status")
    op.drop_column("tenants", "parent_tenant_id")
    op.drop_column("tenants", "environment")
