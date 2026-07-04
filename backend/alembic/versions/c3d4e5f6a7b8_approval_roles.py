"""Add approval_roles table

Revision ID: d5e6f7a8b9c0
Revises: b2c3d4e5f6a7
Create Date: 2026-07-03

Stores the org-level approver role registry per tenant.
Each role (e.g. "CFO", "Finance Director") is referenced by module-specific
approval configs (Expense, AP, AR, Payroll, etc.) rather than each module
storing its own freetext role labels.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "d5e6f7a8b9c0"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "approval_roles",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column("display_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("tenant_id", "name", name="uq_approval_role_tenant_name"),
    )


def downgrade() -> None:
    op.drop_table("approval_roles")
