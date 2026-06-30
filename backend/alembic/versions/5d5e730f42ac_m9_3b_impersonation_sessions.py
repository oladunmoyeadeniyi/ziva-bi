"""m9_3b_impersonation_sessions

Adds the impersonation_sessions audit table for user-level impersonation (M9.3b).
The autogenerate run also detected pre-existing model/DB drift (index renames,
dropped constraints, etc.) — those are left out intentionally to avoid touching
live DB state that is already correct. Only the new table is included here.

Revision ID: 5d5e730f42ac
Revises: l8m9n0o1p2q3
Create Date: 2026-06-30 21:29:37.778733

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '5d5e730f42ac'
down_revision: Union[str, None] = 'l8m9n0o1p2q3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'impersonation_sessions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('impersonator_id', sa.UUID(), nullable=False),
        sa.Column('impersonator_role', sa.String(length=50), nullable=False),
        sa.Column('target_user_id', sa.UUID(), nullable=False),
        sa.Column('target_tenant_id', sa.UUID(), nullable=False),
        sa.Column('environment', sa.String(length=10), nullable=False),
        sa.Column('entry_point', sa.String(length=30), nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['impersonator_id'], ['users.id']),
        sa.ForeignKeyConstraint(['target_tenant_id'], ['tenants.id']),
        sa.ForeignKeyConstraint(['target_user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_impersonation_sessions_impersonator_id', 'impersonation_sessions', ['impersonator_id'], unique=False)
    op.create_index('ix_impersonation_sessions_target_tenant_id', 'impersonation_sessions', ['target_tenant_id'], unique=False)
    op.create_index('ix_impersonation_sessions_target_user_id', 'impersonation_sessions', ['target_user_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_impersonation_sessions_target_user_id', table_name='impersonation_sessions')
    op.drop_index('ix_impersonation_sessions_target_tenant_id', table_name='impersonation_sessions')
    op.drop_index('ix_impersonation_sessions_impersonator_id', table_name='impersonation_sessions')
    op.drop_table('impersonation_sessions')
