"""m5_cleanup_audit_snapshot

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-05-21 00:00:00.000000

Supports M4/M5 cleanup enhancements:

expense_approvals:
  - visible_to_requestor (BOOLEAN, default false) — whether the requestor can see
    a referral comment; false = "Pending internal review"
  - response_comment (TEXT, nullable) — referred approver's reply to the referring approver

expense_reports:
  - referred_back_levels (JSONB, nullable) — queue of additional levels to visit in
    a multi-level refer-back; consumed sequentially as each level approves

expense_report_snapshots (new table):
  - Immutable point-in-time copy of report + lines at each submission
  - version increments per resubmission (1, 2, 3…)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── expense_approvals new columns ─────────────────────────────────────────
    op.add_column(
        'expense_approvals',
        sa.Column('visible_to_requestor', sa.Boolean(), nullable=False, server_default='false'),
    )
    op.add_column(
        'expense_approvals',
        sa.Column('response_comment', sa.Text(), nullable=True),
    )

    # ── expense_reports new column ────────────────────────────────────────────
    op.add_column(
        'expense_reports',
        sa.Column('referred_back_levels', JSONB(), nullable=True),
    )

    # ── expense_report_snapshots table ────────────────────────────────────────
    op.create_table(
        'expense_report_snapshots',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('report_id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('snapshot_data', JSONB(), nullable=False),
        sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['report_id'], ['expense_reports.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_expense_report_snapshots_report_id', 'expense_report_snapshots', ['report_id'])
    op.create_index('ix_expense_report_snapshots_tenant_id', 'expense_report_snapshots', ['tenant_id'])


def downgrade() -> None:
    op.drop_index('ix_expense_report_snapshots_tenant_id', table_name='expense_report_snapshots')
    op.drop_index('ix_expense_report_snapshots_report_id', table_name='expense_report_snapshots')
    op.drop_table('expense_report_snapshots')
    op.drop_column('expense_reports', 'referred_back_levels')
    op.drop_column('expense_approvals', 'response_comment')
    op.drop_column('expense_approvals', 'visible_to_requestor')
