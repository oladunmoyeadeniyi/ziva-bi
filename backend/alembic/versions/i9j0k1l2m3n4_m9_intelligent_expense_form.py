"""m9_intelligent_expense_form

Revision ID: i9j0k1l2m3n4
Revises: h8i9j0k1l2m3
Create Date: 2026-05-24

Milestone 9: Intelligent Expense Form — employee-facing dynamic GL selection.

Adds new columns to expense_lines so the form can record structured GL
references (from the M8 CoA), per-line dimension value selections, split-line
tracking, and employee GL-flag data.

Modified tables:
    expense_lines:
        gl_id          UUID FK → chart_of_accounts(id) ON DELETE SET NULL
                       Structured GL reference from M8 CoA table.
                       Allows linking to dimension requirements per GL.
        dimension_values JSONB {dimension_id_str: value_id_str}
                       Employee-selected dimension values keyed by dimension UUID.
        is_split_parent BOOLEAN DEFAULT false NOT NULL
                       True when this line has been split into sub-lines.
        split_parent_id UUID FK → expense_lines(id) ON DELETE SET NULL
                       Points to the parent line for split sub-lines.
        flag_incorrect BOOLEAN DEFAULT false NOT NULL
                       Level-2 coding: employee flagged the auto-assigned GL.
        flag_comment   TEXT nullable
                       Employee comment explaining why they flagged the GL.

New index:
    ix_expense_lines_gl_id — supports the suggestions query
    (employee_id + gl_id lookup joins through expense_reports)
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID


revision = "i9j0k1l2m3n4"
down_revision = "h8i9j0k1l2m3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # gl_id: structured FK to chart_of_accounts (set null when CoA row deleted)
    op.add_column(
        "expense_lines",
        sa.Column(
            "gl_id",
            UUID(as_uuid=True),
            sa.ForeignKey("chart_of_accounts.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_expense_lines_gl_id", "expense_lines", ["gl_id"])

    # dimension_values: JSONB dict {dimension_id_str: value_id_str}
    op.add_column(
        "expense_lines",
        sa.Column("dimension_values", JSONB, nullable=True),
    )

    # is_split_parent: true once this line has been split
    op.add_column(
        "expense_lines",
        sa.Column(
            "is_split_parent",
            sa.Boolean,
            nullable=False,
            server_default=sa.false(),
        ),
    )

    # split_parent_id: FK back to parent line for split sub-lines
    op.add_column(
        "expense_lines",
        sa.Column(
            "split_parent_id",
            UUID(as_uuid=True),
            sa.ForeignKey("expense_lines.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )

    # flag_incorrect + flag_comment: Level-2 employee GL flagging
    op.add_column(
        "expense_lines",
        sa.Column(
            "flag_incorrect",
            sa.Boolean,
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "expense_lines",
        sa.Column("flag_comment", sa.Text, nullable=True),
    )


def downgrade() -> None:
    op.drop_index("ix_expense_lines_gl_id", table_name="expense_lines")
    op.drop_column("expense_lines", "flag_comment")
    op.drop_column("expense_lines", "flag_incorrect")
    op.drop_column("expense_lines", "split_parent_id")
    op.drop_column("expense_lines", "is_split_parent")
    op.drop_column("expense_lines", "dimension_values")
    op.drop_column("expense_lines", "gl_id")
