"""finance_review_steps table

Revision ID: b0c1d2e3f4a5
Revises: e6f7a8b9c0d1
Create Date: 2026-07-05

Adds the finance_review_steps table which replaces the legacy
finance_l1/l2/l3_designation columns on approval_policies with a
fully-flexible, named-person step chain for finance review workflows.

The legacy columns are kept (not dropped) for backward compat with any
tenants who haven't migrated yet; they will be formally deprecated in a
future migration once all tenants have adopted the new step builder.

NOTE: down_revision changed from "5d5e730f42ac" to "e6f7a8b9c0d1" to
enforce ordering on a fresh database. finance_review_steps has a FK to
approval_policies (created by e6f7a8b9c0d1_approval_engine). When both
migrations were children of the same parent (5d5e730f42ac) Alembic's
topological sort ran them in alphabetical order — b0c1d2e3f4a5 before
e6f7a8b9c0d1 — causing "relation approval_policies does not exist" on
first deploy. This explicit dependency fixes that.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "b0c1d2e3f4a5"
down_revision = "e6f7a8b9c0d1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "finance_review_steps",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("policy_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("level", sa.Integer(), nullable=False),
        sa.Column(
            "step_type",
            sa.String(length=20),
            nullable=False,
            comment="capture | validate | review | approve",
        ),
        sa.Column(
            "label",
            sa.String(length=100),
            nullable=False,
            comment="Display name shown to reviewers, e.g. 'Document Intake'",
        ),
        sa.Column(
            "assigned_employee_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
            comment="Named employee who performs this step (takes precedence over designation)",
        ),
        sa.Column(
            "assigned_designation",
            sa.String(length=50),
            nullable=True,
            comment="Fallback: first active Finance employee holding this designation",
        ),
        sa.Column(
            "min_amount",
            sa.NUMERIC(precision=15, scale=2),
            nullable=True,
            comment="Skip this step when submission total < min_amount. NULL = always run.",
        ),
        sa.Column(
            "can_send_back",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
            comment="Reviewer may return the submission to the submitter for corrections",
        ),
        sa.Column(
            "can_correct_gl",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
            comment="Reviewer may edit GL coding on line items inline (audit-logged)",
        ),
        sa.Column(
            "is_required",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
            comment="If False, step is advisory only and does not block the chain",
        ),
        sa.Column(
            "instructions",
            sa.Text(),
            nullable=True,
            comment="Guidance displayed to the reviewer when the item arrives at this step",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["assigned_employee_id"],
            ["employees.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["policy_id"],
            ["approval_policies.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "policy_id", "level", name="uq_finance_step_policy_level"
        ),
    )
    op.create_index(
        "ix_finance_review_steps_policy_id",
        "finance_review_steps",
        ["policy_id"],
    )
    op.create_index(
        "ix_finance_review_steps_tenant_id",
        "finance_review_steps",
        ["tenant_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_finance_review_steps_tenant_id", table_name="finance_review_steps")
    op.drop_index("ix_finance_review_steps_policy_id", table_name="finance_review_steps")
    op.drop_table("finance_review_steps")
