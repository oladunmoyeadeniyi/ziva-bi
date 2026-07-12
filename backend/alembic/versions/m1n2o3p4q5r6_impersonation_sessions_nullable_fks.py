"""impersonation_sessions: make user/tenant FKs nullable with ON DELETE SET NULL

Revision ID: m1n2o3p4q5r6
Revises: c1d2e3f4a5b6, d5e6f7a8b9c0, d3e4f5a6b7c8, k2l3m4n5o6p7, l9m0n1o2p3q4
Create Date: 2026-07-12

Why
---
impersonation_sessions has three FKs to users/tenants with no ondelete behaviour
(PostgreSQL default: NO ACTION).  This blocks hard-deleting any user who has ever
been impersonated or acted as an impersonator, and any tenant that has ever had a
user impersonated within it.

Fix: make all three columns nullable and add ON DELETE SET NULL so that:
  - the audit record is preserved (the session row is NOT deleted)
  - the user/tenant reference is NULLed out when the referenced row is deleted
  - hard-deletes of users and tenants proceed without FK errors

Affects:
  - purge_test_tenant_users.py (hard-deletes test users)
  - nuke_tenant DELETE endpoint (hard-deletes users + tenant)
  - any future hard-delete of a User or Tenant row
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'm1n2o3p4q5r6'
down_revision: Union[str, tuple] = (
    'c1d2e3f4a5b6',
    'd5e6f7a8b9c0',
    'd3e4f5a6b7c8',
    'k2l3m4n5o6p7',
    'l9m0n1o2p3q4',
)
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop existing FK constraints (PostgreSQL auto-names them)
    op.drop_constraint(
        'impersonation_sessions_impersonator_id_fkey',
        'impersonation_sessions',
        type_='foreignkey',
    )
    op.drop_constraint(
        'impersonation_sessions_target_user_id_fkey',
        'impersonation_sessions',
        type_='foreignkey',
    )
    op.drop_constraint(
        'impersonation_sessions_target_tenant_id_fkey',
        'impersonation_sessions',
        type_='foreignkey',
    )

    # Make columns nullable
    op.alter_column('impersonation_sessions', 'impersonator_id', nullable=True)
    op.alter_column('impersonation_sessions', 'target_user_id', nullable=True)
    op.alter_column('impersonation_sessions', 'target_tenant_id', nullable=True)

    # Re-add FK constraints with ON DELETE SET NULL
    op.create_foreign_key(
        'impersonation_sessions_impersonator_id_fkey',
        'impersonation_sessions', 'users',
        ['impersonator_id'], ['id'],
        ondelete='SET NULL',
    )
    op.create_foreign_key(
        'impersonation_sessions_target_user_id_fkey',
        'impersonation_sessions', 'users',
        ['target_user_id'], ['id'],
        ondelete='SET NULL',
    )
    op.create_foreign_key(
        'impersonation_sessions_target_tenant_id_fkey',
        'impersonation_sessions', 'tenants',
        ['target_tenant_id'], ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    # Remove SET NULL constraints
    op.drop_constraint(
        'impersonation_sessions_impersonator_id_fkey',
        'impersonation_sessions',
        type_='foreignkey',
    )
    op.drop_constraint(
        'impersonation_sessions_target_user_id_fkey',
        'impersonation_sessions',
        type_='foreignkey',
    )
    op.drop_constraint(
        'impersonation_sessions_target_tenant_id_fkey',
        'impersonation_sessions',
        type_='foreignkey',
    )

    # Make columns NOT NULL again
    op.alter_column('impersonation_sessions', 'impersonator_id', nullable=False)
    op.alter_column('impersonation_sessions', 'target_user_id', nullable=False)
    op.alter_column('impersonation_sessions', 'target_tenant_id', nullable=False)

    # Re-add original FK constraints (no ondelete)
    op.create_foreign_key(
        'impersonation_sessions_impersonator_id_fkey',
        'impersonation_sessions', 'users',
        ['impersonator_id'], ['id'],
    )
    op.create_foreign_key(
        'impersonation_sessions_target_user_id_fkey',
        'impersonation_sessions', 'users',
        ['target_user_id'], ['id'],
    )
    op.create_foreign_key(
        'impersonation_sessions_target_tenant_id_fkey',
        'impersonation_sessions', 'tenants',
        ['target_tenant_id'], ['id'],
    )
