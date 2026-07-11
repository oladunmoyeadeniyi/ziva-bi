"""employee_user_link

Revision ID: g1h2i3j4k5l6
Revises: f1g2h3i4j5k6
Create Date: 2026-07-11 00:00:00.000000

Links employees directly to their portal user accounts and adds a user_type
discriminator to user_tenants so employee (internal) users can be distinguished
from externally invited users.

Changes:
  employees.user_id          — UUID FK → users.id (ON DELETE SET NULL), nullable
  user_tenants.user_type     — VARCHAR(20) NOT NULL default 'employee'
                               values: 'employee' | 'external'

Backfill:
  employees.user_id          — joined on employees.email = users.email
  user_tenants.user_type     — all existing rows → 'employee' (they were all
                               created via the employee onboarding flow)

Why:
  - Previously employee↔user link was email-based (brittle, O(n) join at query time).
  - user_type lets the SA portal and tenant admin distinguish internal staff from
    external collaborators (auditors, consultants, etc.).
  - Direct FK enables O(1) cascade operations (deactivate employee → deactivate user).
"""

from alembic import op


revision = "g1h2i3j4k5l6"
down_revision = "f1g2h3i4j5k6"
depends_on = None


def upgrade() -> None:
    # ── 1. Add employees.user_id ───────────────────────────────────────────────
    op.execute("""
        ALTER TABLE employees
        ADD COLUMN IF NOT EXISTS user_id UUID
        REFERENCES users(id) ON DELETE SET NULL
    """)

    # ── 2. Backfill employees.user_id via email match ─────────────────────────
    op.execute("""
        UPDATE employees e
        SET user_id = u.id
        FROM users u
        WHERE lower(e.email) = lower(u.email)
          AND e.user_id IS NULL
    """)

    # ── 3. Add user_tenants.user_type ─────────────────────────────────────────
    op.execute("""
        ALTER TABLE user_tenants
        ADD COLUMN IF NOT EXISTS user_type VARCHAR(20) NOT NULL DEFAULT 'employee'
    """)

    # ── 4. Backfill: all existing user_tenants rows came from employee onboarding
    # (Nothing to do — the DEFAULT 'employee' already covers all existing rows.)


def downgrade() -> None:
    op.execute("ALTER TABLE employees DROP COLUMN IF EXISTS user_id")
    op.execute("ALTER TABLE user_tenants DROP COLUMN IF EXISTS user_type")
