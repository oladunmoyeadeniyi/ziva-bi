"""m4_approval_workflow

Revision ID: f1e2d3c4b5a6
Revises: 87e40b59d47f
Create Date: 2026-05-19 00:00:00.000000

Adds the approval workflow tables and columns for Milestone 4:
  - approval_matrix       (one row per tenant — levels, role labels, amount thresholds)
  - expense_approvals     (one row per report × level — approver, status, comment)
  - expense_reports.current_approval_level  (INTEGER, nullable)
  - expense_reports.rejection_comment       (TEXT, nullable)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f1e2d3c4b5a6'
down_revision: Union[str, None] = '87e40b59d47f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── approval_matrix ───────────────────────────────────────────────────────
    op.create_table(
        'approval_matrix',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('levels', sa.Integer(), nullable=False),
        sa.Column('level1_role', sa.String(length=100), nullable=False),
        sa.Column('level2_role', sa.String(length=100), nullable=True),
        sa.Column('level3_role', sa.String(length=100), nullable=True),
        sa.Column('amount_threshold_l2', sa.NUMERIC(precision=15, scale=2), nullable=True),
        sa.Column('amount_threshold_l3', sa.NUMERIC(precision=15, scale=2), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id'),
    )
    op.create_index(op.f('ix_approval_matrix_tenant_id'), 'approval_matrix', ['tenant_id'], unique=True)

    # ── expense_approvals ─────────────────────────────────────────────────────
    op.create_table(
        'expense_approvals',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('report_id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('level', sa.Integer(), nullable=False),
        sa.Column('approver_id', sa.UUID(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('actioned_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['approver_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['report_id'], ['expense_reports.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_expense_approvals_approver_id'), 'expense_approvals', ['approver_id'], unique=False)
    op.create_index(op.f('ix_expense_approvals_report_id'), 'expense_approvals', ['report_id'], unique=False)
    op.create_index(op.f('ix_expense_approvals_tenant_id'), 'expense_approvals', ['tenant_id'], unique=False)

    # ── expense_reports: new columns ──────────────────────────────────────────
    op.add_column('expense_reports', sa.Column('current_approval_level', sa.Integer(), nullable=True))
    op.add_column('expense_reports', sa.Column('rejection_comment', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('expense_reports', 'rejection_comment')
    op.drop_column('expense_reports', 'current_approval_level')

    op.drop_index(op.f('ix_expense_approvals_tenant_id'), table_name='expense_approvals')
    op.drop_index(op.f('ix_expense_approvals_report_id'), table_name='expense_approvals')
    op.drop_index(op.f('ix_expense_approvals_approver_id'), table_name='expense_approvals')
    op.drop_table('expense_approvals')

    op.drop_index(op.f('ix_approval_matrix_tenant_id'), table_name='approval_matrix')
    op.drop_table('approval_matrix')
