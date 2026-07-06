"""system_function_mapping

Revision ID: c1d2e3f4a5b6
Revises: b0c1d2e3f4a5
Create Date: 2026-07-05 00:00:00.000000

Creates the system_function_mappings table.

A function mapping tells Ziva BI which OrgStructureNode (cost centre / department)
represents a given system-level business function (Finance, HR, Procurement, Sales,
Operations, Internal Audit) for a tenant.

- finance   is always required.
- hr        matters when module 'payroll' is active.
- procurement  → 'accounts_payable'
- sales        → 'accounts_receivable'
- operations   → 'inventory'
- audit        → optional, always shown but not required.

Connected tables:
    tenants      → CASCADE delete
    org_structure → CASCADE delete
"""

import uuid

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "c1d2e3f4a5b6"
down_revision = "b0c1d2e3f4a5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "system_function_mappings",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column(
            "tenant_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "function_code",
            sa.String(50),
            nullable=False,
            comment="finance | hr | procurement | sales | operations | audit",
        ),
        sa.Column(
            "cost_center_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("org_structure.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "is_primary",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
            comment="True = canonical mapping; False = secondary/branch mapping",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "tenant_id",
            "function_code",
            "cost_center_id",
            name="uq_system_function_mappings_tenant_fn_cc",
        ),
    )


def downgrade() -> None:
    op.drop_table("system_function_mappings")
