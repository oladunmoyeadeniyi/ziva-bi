"""Advisory approval steps.

Adds:
  - expense_approvals.is_advisory  BOOLEAN NOT NULL DEFAULT FALSE

    Marks a step in the approval chain as advisory (non-blocking).
    Advisory steps are created for designation levels configured as
    "Reviews only" in an approval policy's selected_designations list
    (selective_tree routing mode).

    Behavioural contract:
      - Advisory reviewers receive a notification and can action their step
        (add comments / sign off) at any time.
      - Their step DOES NOT block the chain from advancing — the chain
        automatically skips advisory steps when determining the next
        current_approval_level.
      - Advisory reviewers cannot reject; rejection is reserved for
        blocking approvers.

Revision ID: r6s7t8u9v0w1
Revises: q5r6s7t8u9v0
"""

from alembic import op
import sqlalchemy as sa

revision = "r6s7t8u9v0w1"
down_revision = "q5r6s7t8u9v0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "expense_approvals",
        sa.Column(
            "is_advisory",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )


def downgrade() -> None:
    op.drop_column("expense_approvals", "is_advisory")
