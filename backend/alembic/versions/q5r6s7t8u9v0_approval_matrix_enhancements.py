"""Approval matrix enhancements.

Adds:
  - approval_policies.selected_designations  JSONB nullable
      Stores the ordered list of designation levels that participate in the
      approval chain when routing_mode = 'selective_tree'.
      Format: [{"designation": "team_lead", "role": "approve"}, ...]

  - finance_review_steps.function_code  VARCHAR(50) nullable
      Links a finance review step to a SystemFunctionMapping entry so the
      assignee picker can be filtered to employees mapped to that function.
      E.g. 'gl_validation', 'controller_review', 'fd_approval',
      'internal_audit', or any tenant-defined function code.

Revision ID: q5r6s7t8u9v0
Revises:     p4q5r6s7t8u9
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "q5r6s7t8u9v0"
down_revision: Union[str, None] = "p4q5r6s7t8u9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # approval_policies — selected designations for selective_tree routing mode
    op.add_column(
        "approval_policies",
        sa.Column(
            "selected_designations",
            JSONB,
            nullable=True,
            comment=(
                "Used when routing_mode='selective_tree'. "
                "Array of {designation, role} objects defining which levels participate."
            ),
        ),
    )

    # finance_review_steps — function code for assignee pool filtering
    op.add_column(
        "finance_review_steps",
        sa.Column(
            "function_code",
            sa.String(50),
            nullable=True,
            comment=(
                "Links step to a SystemFunctionMapping code (e.g. gl_validation, "
                "internal_audit). When set, the assignee picker filters to users "
                "mapped to that function."
            ),
        ),
    )


def downgrade() -> None:
    op.drop_column("finance_review_steps", "function_code")
    op.drop_column("approval_policies", "selected_designations")
