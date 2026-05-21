"""m5_user_management

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-05-21 01:00:00.000000

Milestone 5 — Tenant User Management:
  users table:
    - employee_code (VARCHAR 100, nullable)
    - department    (VARCHAR 255, nullable)
    - job_title     (VARCHAR 255, nullable)
    - phone         (VARCHAR 50, nullable)

  tenant_invitations table (new):
    Tracks pending / accepted / expired invitations sent by Tenant Admins.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── users: new profile columns ────────────────────────────────────────────
    op.add_column('users', sa.Column('employee_code', sa.String(length=100), nullable=True))
    op.add_column('users', sa.Column('department', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('job_title', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('phone', sa.String(length=50), nullable=True))

    # ── tenant_invitations ────────────────────────────────────────────────────
    op.create_table(
        'tenant_invitations',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('invited_by', sa.UUID(), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=100), nullable=False),
        sa.Column('token', sa.String(length=64), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('accepted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['invited_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token'),
    )
    op.create_index('ix_tenant_invitations_tenant_id', 'tenant_invitations', ['tenant_id'])
    op.create_index('ix_tenant_invitations_email', 'tenant_invitations', ['email'])
    op.create_index('ix_tenant_invitations_token', 'tenant_invitations', ['token'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_tenant_invitations_token', table_name='tenant_invitations')
    op.drop_index('ix_tenant_invitations_email', table_name='tenant_invitations')
    op.drop_index('ix_tenant_invitations_tenant_id', table_name='tenant_invitations')
    op.drop_table('tenant_invitations')

    op.drop_column('users', 'phone')
    op.drop_column('users', 'job_title')
    op.drop_column('users', 'department')
    op.drop_column('users', 'employee_code')
