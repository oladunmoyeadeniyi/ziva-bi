"""merge_positions_into_approval_roles

Revision ID: f1g2h3i4j5k6
Revises: e3f4a5b6c7d8
Create Date: 2026-07-06 09:00:00.000000

People v1 — single source of truth consolidation.

Positions and the role hierarchy (approval_roles) were two separate tables linked by
a FK. This migration merges them: approval_roles is the single source of truth for
every named slot in the org chart.

Changes:
  approval_roles               — adds code VARCHAR(50) and grade VARCHAR(50)
  approval_roles.position_id   — dropped (was a reverse-FK to positions added by e3f4a5b6c7d8)
  employee_position_assignments — adds approval_role_id FK → approval_roles; drops position_id
  position_history             — dropped (history tracked via audit log on approval_roles)
  positions                    — dropped (all slot data now lives in approval_roles)

Implementation notes:
  - Uses raw SQL with IF NOT EXISTS / IF EXISTS / CASCADE throughout.
  - Avoids try/except: a failed SQL statement aborts the whole PostgreSQL transaction, and
    Python catching the exception does NOT un-abort it, causing all subsequent statements to
    fail with InFailedSQLTransactionError. Raw SQL guards are the correct pattern.
  - DROP TABLE ... CASCADE removes all FK constraints referencing positions (position_history,
    EPA, approval_roles) automatically, so we only need DROP COLUMN IF EXISTS afterward.
"""

from alembic import op


# revision identifiers
revision = "f1g2h3i4j5k6"
down_revision = "e3f4a5b6c7d8"
depends_on = None


def upgrade() -> None:
    # ── 1. Add code + grade to approval_roles ─────────────────────────────────
    op.execute("ALTER TABLE approval_roles ADD COLUMN IF NOT EXISTS code VARCHAR(50)")
    op.execute("ALTER TABLE approval_roles ADD COLUMN IF NOT EXISTS grade VARCHAR(50)")

    # ── 2. Add approval_role_id to employee_position_assignments ───────────────
    op.execute("""
        ALTER TABLE employee_position_assignments
        ADD COLUMN IF NOT EXISTS approval_role_id UUID
        REFERENCES approval_roles(id) ON DELETE SET NULL
    """)

    # ── 3. Copy data: EPA.position_id → EPA.approval_role_id via positions.org_role_id ──
    # Safe even if positions is empty or org_role_id is null.
    op.execute("""
        UPDATE employee_position_assignments epa
        SET approval_role_id = p.org_role_id
        FROM positions p
        WHERE epa.position_id = p.id
          AND p.org_role_id IS NOT NULL
    """)

    # ── 4. Drop positions tables — CASCADE removes all FK constraints pointing to them ──
    # This drops:
    #   - position_history.position_id  FK (table being dropped anyway)
    #   - EPA.position_id               FK (constraint on employee_position_assignments)
    #   - approval_roles.position_id    FK (fk_approval_roles_position_id on approval_roles)
    op.execute("DROP TABLE IF EXISTS position_history CASCADE")
    op.execute("DROP TABLE IF EXISTS positions CASCADE")

    # ── 5. Drop orphaned columns (FK constraints already removed by CASCADE) ───
    op.execute("ALTER TABLE approval_roles DROP COLUMN IF EXISTS position_id")
    op.execute("ALTER TABLE employee_position_assignments DROP COLUMN IF EXISTS position_id")


def downgrade() -> None:
    # Downgrade is intentionally not implemented — the positions table had no
    # production data and the merge is a one-way consolidation.
    raise NotImplementedError(
        "Downgrade not supported: positions table data cannot be reconstructed."
    )
