"""approval_role_scopes — per-role section access configuration

Revision ID: d3e4f5a6b7c8
Revises: 423f009c637b
Create Date: 2026-07-05

Adds approval_role_scopes table so permission scope (which setup sections
an org role can access and at what level) can be configured per role rather
than per individual user.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "d3e4f5a6b7c8"
down_revision = "423f009c637b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "approval_role_scopes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role_id", UUID(as_uuid=True), sa.ForeignKey("approval_roles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("section", sa.String(100), nullable=False),
        sa.Column("access_level", sa.String(20), nullable=False, server_default="none"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("role_id", "section", name="uq_approval_role_scope_section"),
    )
    op.create_index("ix_approval_role_scopes_tenant_id", "approval_role_scopes", ["tenant_id"])
    op.create_index("ix_approval_role_scopes_role_id", "approval_role_scopes", ["role_id"])


def downgrade() -> None:
    op.drop_index("ix_approval_role_scopes_role_id", table_name="approval_role_scopes")
    op.drop_index("ix_approval_role_scopes_tenant_id", table_name="approval_role_scopes")
    op.drop_table("approval_role_scopes")
