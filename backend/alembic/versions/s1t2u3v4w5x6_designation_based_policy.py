"""Designation-based approval policy fields.

Replaces role-ID-based ceiling/threshold/finance fields with designation strings
so the frontend's designation-picker UI matches what the backend stores.

Changes:
  approval_policies:
    + ceiling_designation VARCHAR(50)
    + finance_l1_designation VARCHAR(50)
    + finance_l2_designation VARCHAR(50)
    + finance_l3_designation VARCHAR(50)

  approval_role_thresholds:
    + designation VARCHAR(50) NOT NULL DEFAULT ''  (will be populated by migration)
    - approval_role_id FK dropped (no real data; save always failed due to this bug)
    - unique constraint updated to (policy_id, designation)

Revision ID: s1t2u3v4w5x6
Revises:     r6s7t8u9v0w1
"""

from alembic import op
import sqlalchemy as sa

revision = "s1t2u3v4w5x6"
down_revision = "r6s7t8u9v0w1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── approval_policies: add designation-based columns ─────────────────────
    op.add_column(
        "approval_policies",
        sa.Column("ceiling_designation", sa.String(50), nullable=True),
    )
    op.add_column(
        "approval_policies",
        sa.Column("finance_l1_designation", sa.String(50), nullable=True),
    )
    op.add_column(
        "approval_policies",
        sa.Column("finance_l2_designation", sa.String(50), nullable=True),
    )
    op.add_column(
        "approval_policies",
        sa.Column("finance_l3_designation", sa.String(50), nullable=True),
    )

    # ── approval_role_thresholds: replace role FK with designation string ─────
    # The save has always failed (this is the bug we're fixing), so no real rows exist.
    # Drop old unique constraint, drop FK column, add designation column + new constraint.
    op.drop_constraint(
        "uq_threshold_policy_role", "approval_role_thresholds", type_="unique"
    )
    op.drop_column("approval_role_thresholds", "approval_role_id")
    op.add_column(
        "approval_role_thresholds",
        sa.Column("designation", sa.String(50), nullable=False, server_default=""),
    )
    op.create_unique_constraint(
        "uq_threshold_policy_desig",
        "approval_role_thresholds",
        ["policy_id", "designation"],
    )


def downgrade() -> None:
    import uuid as _uuid

    # Reverse threshold changes
    op.drop_constraint(
        "uq_threshold_policy_desig", "approval_role_thresholds", type_="unique"
    )
    op.drop_column("approval_role_thresholds", "designation")
    op.add_column(
        "approval_role_thresholds",
        sa.Column(
            "approval_role_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=str(_uuid.uuid4()),
        ),
    )
    op.create_unique_constraint(
        "uq_threshold_policy_role",
        "approval_role_thresholds",
        ["policy_id", "approval_role_id"],
    )

    # Reverse policy columns
    op.drop_column("approval_policies", "finance_l3_designation")
    op.drop_column("approval_policies", "finance_l2_designation")
    op.drop_column("approval_policies", "finance_l1_designation")
    op.drop_column("approval_policies", "ceiling_designation")
