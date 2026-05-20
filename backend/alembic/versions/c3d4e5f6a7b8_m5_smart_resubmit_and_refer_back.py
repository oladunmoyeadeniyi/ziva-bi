"""m5_smart_resubmit_and_refer_back

Revision ID: c3d4e5f6a7b8
Revises: a2b3c4d5e6f7
Create Date: 2026-05-20 00:00:00.000000

Supports Milestone 5 approval workflow improvements:
  - expense_reports.rejected_at_level:
      Stores the level that rejected the report (or referred it back to the requestor).
      On resubmit, the approval chain resumes from this level so already-approved
      lower levels are not re-reviewed.
  - expense_reports.referred_back_from_level:
      Set during a refer-back-to-approver flow. Tracks the higher level to return
      to once the lower (target) approver completes their action.
  - expense_reports.status: widened from VARCHAR(20) to VARCHAR(30) to accommodate
      the new REFERRED_TO_REQUESTOR status value (21 characters).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'a2b3c4d5e6f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Widen status column to hold REFERRED_TO_REQUESTOR (21 chars)
    op.alter_column(
        'expense_reports',
        'status',
        existing_type=sa.String(length=20),
        type_=sa.String(length=30),
        existing_nullable=False,
    )

    # Track which level rejected / referred-back-to-requestor for smart resubmission
    op.add_column(
        'expense_reports',
        sa.Column('rejected_at_level', sa.Integer(), nullable=True),
    )

    # Track the referring level during approver-to-approver refer-back flows
    op.add_column(
        'expense_reports',
        sa.Column('referred_back_from_level', sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('expense_reports', 'referred_back_from_level')
    op.drop_column('expense_reports', 'rejected_at_level')
    op.alter_column(
        'expense_reports',
        'status',
        existing_type=sa.String(length=30),
        type_=sa.String(length=20),
        existing_nullable=False,
    )
