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

NOTE: All operations use conditional SQL (IF NOT EXISTS / IF EXISTS / DO blocks)
because a1b2c3d4e5f7 (an ancestor migration) adds the same approval_policies
columns and partially reshapes approval_role_thresholds. On a fresh database
a1b2c3d4e5f7 runs first; on the existing dev DB this migration ran before
a1b2c3d4e5f7 was inserted into the graph. Both scenarios must work.
"""

from alembic import op
import sqlalchemy as sa

revision = "s1t2u3v4w5x6"
down_revision = "r6s7t8u9v0w1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── approval_policies: idempotent column additions ────────────────────────
    # a1b2c3d4e5f7 (ancestor on fresh DB) may have already added these columns.
    op.execute(
        sa.text(
            "ALTER TABLE approval_policies"
            " ADD COLUMN IF NOT EXISTS ceiling_designation VARCHAR(50),"
            " ADD COLUMN IF NOT EXISTS finance_l1_designation VARCHAR(50),"
            " ADD COLUMN IF NOT EXISTS finance_l2_designation VARCHAR(50),"
            " ADD COLUMN IF NOT EXISTS finance_l3_designation VARCHAR(50)"
        )
    )

    # ── approval_role_thresholds: replace role FK with designation string ─────
    # On a fresh DB, a1b2c3d4e5f7 has already run and:
    #   - dropped uq_threshold_policy_role
    #   - added designation as nullable
    #   - created uq_threshold_policy_designation (different name)
    #   - made approval_role_id nullable (not dropped)
    # All operations are therefore conditional.

    # 1. Drop old unique constraints (either may or may not exist)
    op.execute(
        sa.text(
            "ALTER TABLE approval_role_thresholds"
            " DROP CONSTRAINT IF EXISTS uq_threshold_policy_role,"
            " DROP CONSTRAINT IF EXISTS uq_threshold_policy_designation"
        )
    )

    # 2. Drop approval_role_id if it still exists
    op.execute(
        sa.text(
            "ALTER TABLE approval_role_thresholds"
            " DROP COLUMN IF EXISTS approval_role_id"
        )
    )

    # 3. Add designation if not already there (a1b2c3d4e5f7 may have added it as nullable)
    op.execute(
        sa.text(
            "ALTER TABLE approval_role_thresholds"
            " ADD COLUMN IF NOT EXISTS designation VARCHAR(50)"
        )
    )
    # Backfill NULLs before enforcing NOT NULL
    op.execute(
        sa.text(
            "UPDATE approval_role_thresholds SET designation = '' WHERE designation IS NULL"
        )
    )
    op.execute(
        sa.text(
            "ALTER TABLE approval_role_thresholds"
            " ALTER COLUMN designation SET NOT NULL,"
            " ALTER COLUMN designation SET DEFAULT ''"
        )
    )

    # 4. Create definitive unique constraint if it does not already exist
    op.execute(
        sa.text(
            "DO $$ BEGIN\n"
            "  IF NOT EXISTS (\n"
            "    SELECT 1 FROM pg_constraint WHERE conname = 'uq_threshold_policy_desig'\n"
            "  ) THEN\n"
            "    ALTER TABLE approval_role_thresholds\n"
            "      ADD CONSTRAINT uq_threshold_policy_desig UNIQUE (policy_id, designation);\n"
            "  END IF;\n"
            "END $$"
        )
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
