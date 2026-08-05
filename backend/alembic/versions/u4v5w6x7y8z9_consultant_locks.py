"""Consultant locks — per-section configuration locks set by PRAD consultants.

A consultant entering a tenant in implementation mode can lock any setup
section so that power_admin and functional_admin users cannot modify it.
Locked sections display an amber banner and have all their form controls
disabled.

This enables the classic ERP consultant workflow: configure → lock →
hand over to the client. The client sees the data but cannot accidentally
break a configuration that took hours to set up.

Revision ID: u4v5w6x7y8z9
Revises: t3u4v5w6x7y8
Create Date: 2026-08-04
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "u4v5w6x7y8z9"
down_revision = "t3u4v5w6x7y8"
branch_labels = None
depends_on = None

# All valid section keys. Checked at the application layer (not DB-level
# CHECK constraint) so new sections can be added without a migration.
_VALID_SECTION_KEYS = [
    "organisation",
    "module_activation",
    "chart_of_accounts",
    "dimensions",
    "employees",
    "currencies",
    "tax",
    "roles",
    "approval_workflows",
    "account_mapping",
    "bank_accounts",
    "periods",
    "document_rules",
    "expense_config",
    "posm_config",
    "vendor_portal_config",
    "customer_portal_config",
]


def upgrade() -> None:
    op.create_table(
        "consultant_locks",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "tenant_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
            comment="Tenant this lock belongs to.",
        ),
        sa.Column(
            "section_key",
            sa.String(50),
            nullable=False,
            comment=(
                "Identifies which setup section is locked. "
                "Valid keys: organisation, chart_of_accounts, dimensions, "
                "employees, currencies, tax, roles, approval_workflows, "
                "account_mapping, bank_accounts, periods, document_rules, "
                "expense_config, module_activation, posm_config, "
                "vendor_portal_config, customer_portal_config."
            ),
        ),
        sa.Column(
            "is_locked",
            sa.Boolean(),
            nullable=False,
            server_default="true",
            comment="True = section is currently locked. False = consultant unlocked it.",
        ),
        sa.Column(
            "lock_note",
            sa.Text(),
            nullable=True,
            comment="Optional message the consultant left explaining why this section is locked.",
        ),
        sa.Column(
            "locked_by",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
            comment="Super admin user who set this lock.",
        ),
        sa.Column(
            "locked_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
            comment="When the lock was last set.",
        ),
        sa.Column(
            "unlocked_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
            comment="When the lock was last cleared (is_locked = false).",
        ),
        sa.UniqueConstraint(
            "tenant_id",
            "section_key",
            name="uq_consultant_locks_tenant_section",
        ),
    )


def downgrade() -> None:
    op.drop_table("consultant_locks")
