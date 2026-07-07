"""merge_positions_into_approval_roles

Revision ID: f1g2h3i4j5k6
Revises: e3f4a5b6c7d8
Create Date: 2026-07-06 09:00:00.000000

People v1 — single source of truth consolidation.

Positions and the role hierarchy (approval_roles) were two separate tables linked by
a FK. This migration merges them: approval_roles is the single source of truth for
every named slot in the org chart.

Changes:
  approval_roles          — adds code VARCHAR(50) and grade VARCHAR(50)
  employee_position_assignments — position_id FK → approval_role_id FK (approval_roles)
  position_history        — dropped (history is now tracked via audit log on approval_roles)
  positions               — dropped (all slot data now lives in approval_roles)
  approval_roles.position_id — drops the reverse FK that the previous migration added

No data is lost because positions and employee_position_assignments were empty at the
time of this migration (People v1 was never used in production with real data).
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = "f1g2h3i4j5k6"
down_revision = "e3f4a5b6c7d8"
depends_on = None


def upgrade() -> None:
    # ── 1. Add code + grade to approval_roles ─────────────────────────────────
    op.add_column(
        "approval_roles",
        sa.Column("code", sa.String(50), nullable=True,
                  comment="Short position code e.g. 'CFO-001', 'DPM-LAG'"),
    )
    op.add_column(
        "approval_roles",
        sa.Column("grade", sa.String(50), nullable=True,
                  comment="Salary/job grade e.g. 'G8', 'SM', 'Director'"),
    )

    # ── 2. Drop position_id FK that was added to approval_roles by previous migration ──
    # First drop the FK constraint, then the column
    try:
        op.drop_constraint(
            "fk_approval_roles_position_id",
            "approval_roles",
            type_="foreignkey",
        )
    except Exception:
        pass  # constraint may not exist if previous migration was never applied
    try:
        op.drop_column("approval_roles", "position_id")
    except Exception:
        pass  # column may not exist

    # ── 3. Retarget employee_position_assignments ──────────────────────────────
    # Add approval_role_id column
    op.add_column(
        "employee_position_assignments",
        sa.Column(
            "approval_role_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("approval_roles.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
            comment="Which approval_role (org position) this employee occupies",
        ),
    )

    # Copy any existing data (position_id → approval_role_id via positions.org_role_id)
    op.execute("""
        UPDATE employee_position_assignments epa
        SET approval_role_id = p.org_role_id
        FROM positions p
        WHERE epa.position_id = p.id
          AND p.org_role_id IS NOT NULL
    """)

    # Drop old FK + column
    try:
        op.drop_constraint(
            "fk_epa_position_id",
            "employee_position_assignments",
            type_="foreignkey",
        )
    except Exception:
        pass
    try:
        op.drop_column("employee_position_assignments", "position_id")
    except Exception:
        pass

    # ── 4. Drop position_history (no FK dependents) ───────────────────────────
    op.drop_table("position_history")

    # ── 5. Drop positions ─────────────────────────────────────────────────────
    # employee_position_assignments no longer references positions so this is safe
    op.drop_table("positions")


def downgrade() -> None:
    # Downgrade is intentionally not implemented — the positions table had no
    # production data and the merge is a one-way consolidation.
    raise NotImplementedError(
        "Downgrade not supported: positions table data cannot be reconstructed."
    )
